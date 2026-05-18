import type {
  AIPriceConfidence,
  AIProviderKey,
  AIRequestLogEntry,
  AISettings,
  DividendPriceRefreshItem,
} from '../types/ai'
import { findAIProviderPreset } from '../types/ai'
import { StorageService } from '../store/storage'
import { v4 as uuidv4 } from './uuid'

const RAW_RESPONSE_MAX = 8000

/**
 * 只有 Gemini grounding 在生产中验证过可靠返回真实搜索结果；
 * 其他 provider（千问/智谱）的联网搜索工具调用是否真正触发不可靠，
 * 因此即使它们自报 high 置信度也要降级到 medium，强制走用户审核。
 */
const TRUSTED_HIGH_CONFIDENCE_PROVIDERS = new Set<AIProviderKey>(['gemini'])

export interface RefreshHoldingInput {
  code: string
  name: string
  lastReferencePrice: number
}

export interface RefreshHoldingResult {
  items: DividendPriceRefreshItem[]
  missing: string[]
  rawText: string
  modelUsed: string
}

const SYSTEM_PROMPT = [
  '你是一个面向中国 A 股 / 沪深 ETF 的最新行情查询助手，只回答用户列表里的标的。',
  '使用你的实时联网搜索能力（必须）打开真实的行情页面，从页面文本中读取价格。',
  '不要凭训练数据中的记忆给价格——任何 2025 年以后的价格都必须来自当下网页搜索结果。',
  '',
  'A 股交易规则（强约束）：',
  '- 仅周一至周五开盘（节假日另算），周末、节假日**没有**收盘价',
  '- priceAsOf 必须是真实交易日；如果今天是周末/节假日，priceAsOf 必须回退到最近一个交易日',
  '- 如果你查到的最新页面价格的日期就是今天且尚未收盘，可标 confidence: "medium" 并在 sourceNote 注明「实时价 非收盘」',
  '',
  '严格按 JSON Schema 输出，整段响应**只**包含一个 JSON 对象，不要任何 Markdown、解释或前后缀文字。',
  '',
  'Schema:',
  '{',
  '  "items": [',
  '    {',
  '      "code": "string，与请求中的 code 完全一致（A 股 6 位、ETF 6 位）",',
  '      "name": "string，标的中文名",',
  '      "referencePrice": "number，单位元，正数，正常 0.5~1000 元之间",',
  '      "priceAsOf": "string，YYYY-MM-DD，必须是 A 股交易日，不能是周末",',
  '      "confidence": "high | medium | low",',
  '      "sourceUrl": "string，真实打开过的行情页 URL，例如 quote.eastmoney.com/sh600036.html",',
  '      "sourceNote": "string，必须包含你在 sourceUrl 页面上看到的原始价格行文本，例如 \'东方财富页面显示「37.47 -0.18 -0.48%」收盘 2026-05-15\'。不要只写「收盘价」三个字。"',
  '    }',
  '  ],',
  '  "missing": ["string，未查到价格的 code 列表，不要瞎猜，没查到就放这里"]',
  '}',
  '',
  'confidence 评级标准（必须按此选择）：',
  '- high：联网工具确实返回了具体页面文本，且你可以在 sourceNote 里**逐字摘录**页面上的价格文本；priceAsOf 是最近一个交易日',
  '- medium：联网工具返回了内容但不够完整（例如只有近期成交价没有收盘价、或者多源数据轻微不一致）',
  '- low：你不确定数据是否来自实时搜索；任何用旧记忆补全的数据都必须标 low',
  '',
  '严禁：',
  '- 编造价格、来源链接、或 sourceNote 里的页面文本',
  '- 把请求日期当成 priceAsOf',
  '- priceAsOf 写成周六或周日',
  '- 在 JSON 外包裹 ```json``` 代码块或加任何说明文字',
  '- 修改用户请求里的 code',
  '- 对 2025 年之后的价格使用 high 置信度但 sourceNote 里却没有逐字摘录',
].join('\n')

function buildUserPrompt(holdings: RefreshHoldingInput[]): string {
  const lines = holdings.map(h =>
    `- code: ${h.code} · name: ${h.name} · 上次参考价 ¥${h.lastReferencePrice.toFixed(2)}`,
  )
  return [
    '请为下列 A 股 / 沪深 ETF 标的查询最新的「参考价（最近交易日收盘价或最新成交价）」。',
    '',
    lines.join('\n'),
    '',
    '注意：',
    '- 中国 A 股 / 沪深 ETF 交易日为周一至周五，节假日休市',
    '- 已停牌或退市的标的请放入 missing',
    '- 不要返回 priceAsOf 晚于今天的数据',
    '',
    '只输出 JSON 对象，不要任何解释。',
  ].join('\n')
}

export async function refreshHoldingPrices(args: {
  settings: AISettings
  holdings: RefreshHoldingInput[]
  /** 业务任务名，便于日志识别批量 vs 单只 */
  task?: string
}): Promise<RefreshHoldingResult> {
  const { settings, holdings } = args
  const task = args.task ?? (holdings.length === 1
    ? 'dividend-price-refresh-single'
    : 'dividend-price-refresh-batch')

  if (holdings.length === 0) {
    return { items: [], missing: [], rawText: '', modelUsed: settings.model }
  }
  const preset = findAIProviderPreset(settings.provider)
  if (!preset.webSearch) {
    throw new Error(`${preset.label} 当前未接通联网搜索；请切换到 Gemini 等支持联网的 AI 供应商`)
  }
  if (!settings.apiKey || !settings.baseUrl || !settings.model) {
    throw new Error('AI 配置不完整：请先到「设置 → AI 设置」填写 API Key、Base URL、Model')
  }

  const inputSummary = holdings.map(h => `${h.code}(${h.name})`).join(', ')
  const startedAt = Date.now()
  let rawText = ''

  try {
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: settings.provider,
        protocol: settings.protocol,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(holdings),
        context: { task: 'dividend-price-refresh', count: holdings.length },
        enableWebSearch: true,
        webSearchMode: preset.webSearch,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = typeof data?.error === 'string' ? data.error : `AI 调用失败 ${res.status}`
      throw new Error(msg)
    }
    rawText = typeof data.text === 'string' ? data.text : ''
    const parsed = parseRefreshResponse(rawText, holdings, settings.provider)

    writeLog({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      task,
      provider: settings.provider,
      providerLabel: preset.label,
      model: settings.model,
      protocol: settings.protocol,
      webSearchMode: preset.webSearch,
      durationMs: Date.now() - startedAt,
      status: 'ok',
      inputSummary,
      rawResponseText: truncate(rawText, RAW_RESPONSE_MAX),
      parsedItemCount: parsed.items.length,
      missingCount: parsed.missing.length,
    })

    return {
      items: parsed.items,
      missing: parsed.missing,
      rawText,
      modelUsed: settings.model,
    }
  } catch (err) {
    writeLog({
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      task,
      provider: settings.provider,
      providerLabel: preset.label,
      model: settings.model,
      protocol: settings.protocol,
      webSearchMode: preset.webSearch,
      durationMs: Date.now() - startedAt,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
      inputSummary,
      rawResponseText: rawText ? truncate(rawText, RAW_RESPONSE_MAX) : undefined,
    })
    throw err
  }
}

function writeLog(entry: AIRequestLogEntry): void {
  try {
    StorageService.appendAIRequestLog(entry)
  } catch {
    // 日志失败不影响主流程
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n) + `\n…（已截断，原始 ${s.length} 字符）`
}

interface ParsedResponse {
  items: DividendPriceRefreshItem[]
  missing: string[]
}

export function parseRefreshResponse(
  rawText: string,
  holdings: RefreshHoldingInput[],
  provider?: AIProviderKey,
): ParsedResponse {
  const json = extractJsonObject(rawText)
  if (!json || typeof json !== 'object') {
    throw new Error('AI 返回的不是合法 JSON；请检查模型是否启用了联网搜索')
  }
  const lookup = new Map(holdings.map(h => [h.code, h]))
  const items: DividendPriceRefreshItem[] = []
  const missing: string[] = []
  const today = todayIsoDate()
  const todayMs = Date.parse(`${today}T00:00:00`)
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
  const trustHigh = provider ? TRUSTED_HIGH_CONFIDENCE_PROVIDERS.has(provider) : false

  const rawItems = Array.isArray((json as Record<string, unknown>).items)
    ? (json as { items: unknown[] }).items
    : []

  for (const raw of rawItems) {
    if (!isRecord(raw)) continue
    const code = toCleanString(raw.code)
    if (!code || !lookup.has(code)) continue
    const requested = lookup.get(code)!

    const referencePrice = toFiniteNumber(raw.referencePrice)
    if (!(referencePrice > 0)) continue
    if (requested.lastReferencePrice > 0
      && (referencePrice > requested.lastReferencePrice * 3
        || referencePrice < requested.lastReferencePrice * 0.33)) {
      // 价格数量级偏离过大，疑似 AI 幻觉（小数点错位等），丢弃
      missing.push(code)
      continue
    }

    const rawPriceAsOf = toIsoDate(raw.priceAsOf)
    if (!rawPriceAsOf || rawPriceAsOf > today) continue

    let confidence = toConfidence(raw.confidence)
    const notes: string[] = []
    const baseNote = toCleanString(raw.sourceNote)
    if (baseNote) notes.push(baseNote)

    // 1) A 股交易日校验：priceAsOf 落在周末时自动校正到上一个工作日（5/15 周五→5/15；5/16 周六→5/15；5/17 周日→5/15）
    // 这种情况通常是模型把页面上的实时盘中价误标了收盘日期；价格本身可能是对的，所以保留但降级 + 标注
    let priceAsOf = rawPriceAsOf
    const rawWeekday = weekdayOfIsoDate(priceAsOf)
    if (rawWeekday === 0 || rawWeekday === 6) {
      const coerced = coerceToPreviousWeekday(priceAsOf)
      if (coerced) {
        notes.push(`⚠️ AI 给的 priceAsOf ${priceAsOf} 是周${rawWeekday === 0 ? '日' : '六'}（A 股不开盘），已校正到 ${coerced}`)
        priceAsOf = coerced
      }
      confidence = 'low'
    }

    // 2) 数据日期距今超过 5 天：降级
    const asOfMs = Date.parse(`${priceAsOf}T00:00:00`)
    if (Number.isFinite(asOfMs) && todayMs - asOfMs > fiveDaysMs) {
      confidence = confidence === 'high' ? 'medium' : confidence
      notes.push(`⚠️ priceAsOf 距今 ${Math.round((todayMs - asOfMs) / 86400000)} 天，可能不是最新`)
    }

    // 3) provider 信任降级：非可信 provider 的 high 一律降到 medium
    if (confidence === 'high' && !trustHigh) {
      confidence = 'medium'
      notes.push('⚠️ 当前 provider 联网搜索不可信，已自动从 high 降为 medium，请人工核对来源')
    }

    items.push({
      code,
      name: toCleanString(raw.name) ?? requested.name,
      referencePrice: round2(referencePrice),
      priceAsOf,
      confidence,
      sourceUrl: toCleanString(raw.sourceUrl),
      sourceNote: notes.join(' · ') || undefined,
    })
  }

  const rawMissing = Array.isArray((json as Record<string, unknown>).missing)
    ? (json as { missing: unknown[] }).missing
    : []
  for (const m of rawMissing) {
    const code = toCleanString(m)
    if (code && lookup.has(code) && !missing.includes(code)) {
      missing.push(code)
    }
  }
  // 请求过但 AI 既没返回价格也没列入 missing 的，统一视为 missing
  const returnedCodes = new Set(items.map(i => i.code))
  for (const h of holdings) {
    if (!returnedCodes.has(h.code) && !missing.includes(h.code)) {
      missing.push(h.code)
    }
  }
  return { items, missing }
}

function extractJsonObject(text: string): unknown {
  if (!text) return null
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // pass — try fenced or slice
  }
  // 兼容 ```json ... ``` 包裹
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i)
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      // pass
    }
  }
  // 最后兜底：截取首个 { 到最后一个 } 的子串
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1))
    } catch {
      // pass
    }
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[¥￥,\s]/g, '')
    const n = parseFloat(cleaned)
    if (Number.isFinite(n)) return n
  }
  return NaN
}

function toCleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function toIsoDate(value: unknown): string | undefined {
  const s = toCleanString(value)
  if (!s) return undefined
  // 接受 YYYY-MM-DD 或 YYYY/MM/DD
  const match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!match) return undefined
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function toConfidence(value: unknown): AIPriceConfidence {
  const s = toCleanString(value)?.toLowerCase()
  if (s === 'high' || s === 'medium' || s === 'low') return s
  return 'medium'
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 返回 ISO 日期的 weekday（0=Sunday, 6=Saturday）；解析失败时返回 -1 */
function weekdayOfIsoDate(iso: string): number {
  const ms = Date.parse(`${iso}T00:00:00`)
  if (!Number.isFinite(ms)) return -1
  return new Date(ms).getDay()
}

/** 把周末日期回退到上一个 weekday（周六→周五，周日→周五）；非周末原样返回 */
function coerceToPreviousWeekday(iso: string): string | undefined {
  const ms = Date.parse(`${iso}T00:00:00`)
  if (!Number.isFinite(ms)) return undefined
  const d = new Date(ms)
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
