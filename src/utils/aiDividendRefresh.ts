import type {
  AIPriceConfidence,
  AISettings,
  DividendPriceRefreshItem,
} from '../types/ai'
import { findAIProviderPreset } from '../types/ai'

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
  '你是一个面向中国 A 股 / ETF 的最新行情查询助手，只回答用户列表里的标的。',
  '使用你的实时联网搜索能力查询最新的「参考价」——最近一个交易日的收盘价；',
  '如果该交易日尚未收盘，可使用当日最近一笔成交价并标记 confidence: "medium"。',
  '严格按 JSON Schema 输出，整段响应**只**包含一个 JSON 对象，不要任何 Markdown、解释或前后缀文字。',
  '',
  'Schema:',
  '{',
  '  "items": [',
  '    {',
  '      "code": "string，与请求中的 code 完全一致（A 股 6 位、ETF 6 位）",',
  '      "name": "string，标的中文名",',
  '      "referencePrice": "number，单位元，正数，正常 0.5~1000 元之间",',
  '      "priceAsOf": "string，YYYY-MM-DD，数据真实日期（如收盘日），不是请求日",',
  '      "confidence": "high | medium | low（high 仅当来源权威、日期明确、为最近交易日收盘价）",',
  '      "sourceUrl": "string，可核验的公开链接，例如东方财富/雪球/同花顺/新浪财经的实时报价页",',
  '      "sourceNote": "string，简短说明，如 \'东方财富 2026-05-14 收盘\'"',
  '    }',
  '  ],',
  '  "missing": ["string，未查到价格的 code 列表，不要瞎猜，没查到就放这里"]',
  '}',
  '',
  '严禁：',
  '- 编造价格或来源链接',
  '- 把请求日期当成 priceAsOf',
  '- 在 JSON 外包裹 ```json``` 代码块或加任何说明文字',
  '- 修改用户请求里的 code',
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
}): Promise<RefreshHoldingResult> {
  const { settings, holdings } = args
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
    throw new Error(typeof data?.error === 'string' ? data.error : `AI 调用失败 ${res.status}`)
  }
  const rawText = typeof data.text === 'string' ? data.text : ''
  const parsed = parseRefreshResponse(rawText, holdings)
  return {
    items: parsed.items,
    missing: parsed.missing,
    rawText,
    modelUsed: settings.model,
  }
}

interface ParsedResponse {
  items: DividendPriceRefreshItem[]
  missing: string[]
}

export function parseRefreshResponse(rawText: string, holdings: RefreshHoldingInput[]): ParsedResponse {
  const json = extractJsonObject(rawText)
  if (!json || typeof json !== 'object') {
    throw new Error('AI 返回的不是合法 JSON；请检查模型是否启用了联网搜索')
  }
  const lookup = new Map(holdings.map(h => [h.code, h]))
  const items: DividendPriceRefreshItem[] = []
  const missing: string[] = []
  const today = todayIsoDate()

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

    const priceAsOf = toIsoDate(raw.priceAsOf)
    if (!priceAsOf || priceAsOf > today) continue

    const confidence = toConfidence(raw.confidence)
    items.push({
      code,
      name: toCleanString(raw.name) ?? requested.name,
      referencePrice: round2(referencePrice),
      priceAsOf,
      confidence,
      sourceUrl: toCleanString(raw.sourceUrl),
      sourceNote: toCleanString(raw.sourceNote),
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
