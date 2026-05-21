import type { AssetPlatform, AssetClass, SnapshotItem } from '../types/models'
import { PLATFORM_LABELS, CLASS_LABELS, PLATFORM_DEFAULT_CURRENCY } from '../types/models'
import { findAIProviderPreset, type AISettings } from '../types/ai'
import { v4 as uuidv4 } from './uuid'

export interface ParsedSnapshotItem {
  /** 解析到内置 platform key 时使用；解析为自定义时填 'other' */
  platform: AssetPlatform
  /** 当 platform = 'other' 时的中文名（用户已有的自定义平台优先复用，新名也保留） */
  customPlatformName: string
  assetClass: AssetClass
  customAssetClassName: string
  /** 用户原文里可能没明确写资产名（如"理财通"），此时填用户输入的简短标签 */
  assetLabel: string
  amount: number
  currency: 'CNY' | 'USD'
  note: string
  /** AI 解析原始片段（用于 UI 显示「来自原文哪一段」） */
  originalText?: string
}

export interface ParseSnapshotResult {
  items: ParsedSnapshotItem[]
  /** 未识别的原文片段，便于用户回看 */
  unrecognized: string[]
  rawText: string
}

const SYSTEM_PROMPT = [
  '你是一个把中文自然语言资产描述转换成结构化快照条目的助手。',
  '用户会用一段口语化文字（如"招行卡 20 万、雪球 50 万、A 股账户 80 万、币安 3000 美元、车贷剩 8 万"）描述自己的资产分布。',
  '你的任务是把它解析为 JSON，每条资产一个 item。',
  '',
  '严格按下面 Schema 输出，整段响应**只**包含一个 JSON 对象，不要任何 Markdown、解释或前后缀文字。',
  '',
  'Schema:',
  '{',
  '  "items": [',
  '    {',
  '      "platform": "string，从允许的 platform key 列表里选最匹配的；都不匹配时填 \\"other\\"",',
  '      "customPlatformName": "string，仅当 platform=\\"other\\" 或用户输入的平台名不在内置列表里时，填用户原文中的平台名（中文）",',
  '      "assetClass": "string，从允许的 assetClass key 列表里选最匹配的",',
  '      "customAssetClassName": "string，仅当 assetClass=\\"other\\" 或需要进一步说明",',
  '      "assetLabel": "string，可选，简短资产标签或产品名（如 \\"招行朝朝盈\\"、\\"沪深300ETF\\"），不知道就留空",',
  '      "amount": "number，必填，资产金额（不要乘以汇率，保持用户原始数值）",',
  '      "currency": "CNY | USD，按用户原文判断；只说\\"万\\"默认 CNY；明确说美元/USD/u 时填 USD",',
  '      "note": "string，可选，原文里的备注信息（如\\"建行定期\\"、\\"年化 3%\\"）",',
  '      "originalText": "string，原文里对应这条资产的那个片段（用于人工核对）"',
  '    }',
  '  ],',
  '  "unrecognized": ["string，原文里没解析出的片段（如负债、收入等非资产描述），不要瞎猜"]',
  '}',
  '',
  '解析规则（重要）：',
  '- "10 万" = 100000，"20 万" = 200000，"1.5 万" = 15000，"100w" = 1000000',
  '- "3000 美元" / "3000 u" / "3000 USD" → amount=3000, currency="USD"',
  '- 单位元/￥/CNY/RMB → currency="CNY"',
  '- 没单位且数字偏大（>5000）默认 CNY；没单位且 < 5000 + 提到币/美 → USD',
  '- 负债（车贷、房贷、信用卡欠款）**不要**当作资产；放入 unrecognized 里返回',
  '- 同一平台多个资产（"招行：定期 10 万 + 活期 5 万"）拆成多条 item',
  '- 用户没说明"账户类型"时 assetClass 用判断：',
  '  - 银行存款 / 余额宝 / 理财通 / 朝朝盈 → cash 或 wealth',
  '  - 股票账户 / 雪球持仓 → stock',
  '  - 基金 / ETF → fund',
  '  - 加密货币 / BTC / ETH / U → crypto',
  '  - 期货 / 杠杆 / 合约 → futures',
  '  - 房产 / 车辆 / 收藏品 / 其他 → other',
  '',
  '严禁：',
  '- 编造用户没提到的资产',
  '- 把金额换算成另一种货币（保持原币种）',
  '- 把"-8 万"（负债）当作 amount: 80000 写入 items',
  '- 在 JSON 外包裹 ```json``` 代码块或加任何说明文字',
].join('\n')

function buildAllowedListsPrompt(customPlatforms: string[], customClasses: string[]): string {
  const platforms = (Object.entries(PLATFORM_LABELS) as [AssetPlatform, string][])
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n')
  const classes = (Object.entries(CLASS_LABELS) as [AssetClass, string][])
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n')
  const customP = customPlatforms.length > 0
    ? `\n用户自定义平台（如果用户原文匹配这些名字，platform 填 "other"，customPlatformName 填这个中文名）：\n${customPlatforms.map(n => `  - ${n}`).join('\n')}`
    : ''
  const customC = customClasses.length > 0
    ? `\n用户自定义类别：\n${customClasses.map(n => `  - ${n}`).join('\n')}`
    : ''
  return [
    '允许的 platform key 列表（必须从这里选，匹配不上才填 "other"）：',
    platforms,
    customP,
    '',
    '允许的 assetClass key 列表：',
    classes,
    customC,
  ].filter(Boolean).join('\n')
}

export async function parseSnapshotText(args: {
  settings: AISettings
  text: string
  customPlatforms: string[]
  customClasses: string[]
}): Promise<ParseSnapshotResult> {
  const trimmed = args.text.trim()
  if (!trimmed) {
    return { items: [], unrecognized: [], rawText: '' }
  }
  if (!args.settings.apiKey || !args.settings.baseUrl || !args.settings.model) {
    throw new Error('AI 配置不完整，请先到「设置 → AI 设置」填写 API Key、Base URL、Model')
  }

  const preset = findAIProviderPreset(args.settings.provider)
  const userPrompt = [
    buildAllowedListsPrompt(args.customPlatforms, args.customClasses),
    '',
    '用户原文：',
    trimmed,
    '',
    '只输出 JSON 对象，不要任何解释。',
  ].join('\n')

  const res = await fetch('/api/ai/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: args.settings.provider,
      protocol: args.settings.protocol,
      apiKey: args.settings.apiKey,
      baseUrl: args.settings.baseUrl,
      model: args.settings.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      context: { task: 'snapshot-parse', length: trimmed.length },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `${preset.label} 解析失败 ${res.status}`
    throw new Error(msg)
  }
  const rawText = typeof data.text === 'string' ? data.text : ''
  return parseResponse(rawText, args.customPlatforms, args.customClasses)
}

function parseResponse(rawText: string, customPlatforms: string[], customClasses: string[]): ParseSnapshotResult {
  const json = extractJsonObject(rawText)
  if (!json || typeof json !== 'object') {
    throw new Error('AI 返回的不是合法 JSON；可换个模型或简化输入再试')
  }
  const obj = json as Record<string, unknown>
  const rawItems = Array.isArray(obj.items) ? obj.items : []
  const items: ParsedSnapshotItem[] = []
  for (const raw of rawItems) {
    const normalized = normalizeItem(raw, customPlatforms, customClasses)
    if (normalized) items.push(normalized)
  }
  const unrecognized = Array.isArray(obj.unrecognized)
    ? obj.unrecognized.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []
  return { items, unrecognized, rawText }
}

const VALID_PLATFORMS = new Set<AssetPlatform>(Object.keys(PLATFORM_LABELS) as AssetPlatform[])
const VALID_CLASSES = new Set<AssetClass>(Object.keys(CLASS_LABELS) as AssetClass[])

function normalizeItem(raw: unknown, customPlatforms: string[], customClasses: string[]): ParsedSnapshotItem | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const amount = toFiniteNumber(obj.amount)
  if (!(amount > 0)) return null

  const platformRaw = toCleanString(obj.platform)?.toLowerCase()
  const customPlatformName = toCleanString(obj.customPlatformName) ?? ''
  let platform: AssetPlatform = 'other'
  let finalCustomName = customPlatformName
  if (platformRaw && VALID_PLATFORMS.has(platformRaw as AssetPlatform)) {
    platform = platformRaw as AssetPlatform
    if (platform === 'other') {
      finalCustomName = customPlatformName || (toCleanString(obj.platform) ?? '')
    } else {
      finalCustomName = ''
    }
  } else if (customPlatformName) {
    const matched = customPlatforms.find(n => n === customPlatformName)
    platform = 'other'
    finalCustomName = matched ?? customPlatformName
  }

  const classRaw = toCleanString(obj.assetClass)?.toLowerCase()
  const customClassName = toCleanString(obj.customAssetClassName) ?? ''
  let assetClass: AssetClass = 'other'
  let finalCustomClassName = customClassName
  if (classRaw && VALID_CLASSES.has(classRaw as AssetClass)) {
    assetClass = classRaw as AssetClass
    if (assetClass === 'other') {
      finalCustomClassName = customClassName || (toCleanString(obj.assetClass) ?? '')
    } else {
      finalCustomClassName = ''
    }
  } else if (customClassName) {
    const matched = customClasses.find(n => n === customClassName)
    assetClass = 'other'
    finalCustomClassName = matched ?? customClassName
  }

  const currencyRaw = toCleanString(obj.currency)?.toUpperCase()
  const currency: 'CNY' | 'USD' = currencyRaw === 'USD'
    ? 'USD'
    : currencyRaw === 'CNY'
      ? 'CNY'
      : platform !== 'other' ? PLATFORM_DEFAULT_CURRENCY[platform] : 'CNY'

  return {
    platform,
    customPlatformName: finalCustomName,
    assetClass,
    customAssetClassName: finalCustomClassName,
    assetLabel: toCleanString(obj.assetLabel) ?? '',
    amount,
    currency,
    note: toCleanString(obj.note) ?? '',
    originalText: toCleanString(obj.originalText),
  }
}

/** 把 AI 解析出的条目转成 SnapshotItem（valueCNY 由调用方根据汇率算）。 */
export function toSnapshotItem(parsed: ParsedSnapshotItem): SnapshotItem {
  return {
    id: uuidv4(),
    platform: parsed.platform,
    customPlatformName: parsed.customPlatformName,
    accountType: '',
    assetClass: parsed.assetClass,
    customAssetClassName: parsed.customAssetClassName,
    assetLabel: parsed.assetLabel,
    amount: parsed.amount,
    currency: parsed.currency,
    valueCNY: 0,
    note: parsed.note,
  }
}

function extractJsonObject(text: string): unknown {
  if (!text) return null
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // try fenced code block
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i)
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()) } catch { /* fall through */ }
  }
  const first = trimmed.indexOf('{')
  const last = trimmed.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)) } catch { /* give up */ }
  }
  return null
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
  const t = value.trim()
  return t.length > 0 ? t : undefined
}
