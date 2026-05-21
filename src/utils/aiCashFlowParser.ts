import type { AssetPlatform } from '../types/models'
import { PLATFORM_LABELS } from '../types/models'
import {
  BUILTIN_INCOME_CATEGORIES, BUILTIN_EXPENSE_CATEGORIES,
  type CashFlowType, type PaymentMethod,
} from '../types/cashFlow'
import { findAIProviderPreset, type AISettings } from '../types/ai'

export interface ParsedCashFlowEvent {
  date: string                    // YYYY-MM-DD
  type: CashFlowType
  amount: number                  // 正数
  currency: 'CNY' | 'USD'
  category: string                // 内置 key 或自定义中文名
  paymentMethod: PaymentMethod    // expense 才有意义；income 永远 'asset'
  platform?: AssetPlatform
  customPlatformName?: string
  note: string
  /** AI 原文片段，用于 UI 显示来源 */
  originalText?: string
}

export interface ParseCashFlowResult {
  events: ParsedCashFlowEvent[]
  unrecognized: string[]
  rawText: string
}

const SYSTEM_PROMPT = [
  '你是一个把中文自然语言收支描述转换成结构化记账条目的助手。',
  '用户用一段口语化文字（如"工资发了 1.5w，午餐 38，滴滴 18，星巴克 35，信用卡还了 5000"）描述当天或最近的现金流。',
  '你的任务是把它解析为 JSON，每笔一个 event。',
  '',
  '严格按 Schema 输出，整段响应**只**包含一个 JSON 对象，不要任何 Markdown、解释或前后缀文字。',
  '',
  'Schema:',
  '{',
  '  "events": [',
  '    {',
  '      "date": "string，YYYY-MM-DD。用户没指明就填今天；说\\"昨天\\"/\\"前天\\"/\\"上周三\\"按今天回推",',
  '      "type": "income | expense",',
  '      "amount": "number，正数，原币种金额",',
  '      "currency": "CNY | USD，默认 CNY；明确说美元/USD/u 才填 USD",',
  '      "category": "string，从允许的 key 列表里选；按行为关键词匹配最近的；都不匹配填 \\"otherIncome\\" 或 \\"otherExpense\\"",',
  '      "paymentMethod": "asset | credit，仅 expense 需要；\\"信用卡刷\\"=credit；\\"信用卡还\\"是 expense+creditRepay+asset",',
  '      "platform": "string，可选；用户明确说\\"招行/支付宝/富途/币安\\"等才填对应 enum key，否则留空",',
  '      "customPlatformName": "string，可选；用户提到的平台不在 enum 里时填中文名",',
  '      "note": "string，4-10 字简短描述（如\\"工作日午餐\\"\\"打车回家\\"）",',
  '      "originalText": "string，原文里对应这笔的片段"',
  '    }',
  '  ],',
  '  "unrecognized": ["string，原文里没解析出的片段（无金额或非现金流的部分）"]',
  '}',
  '',
  'Income 类别（按关键词匹配，必须从这里选 key）：',
  '  - salary（工资 / 薪水 / 月薪）',
  '  - bonus（奖金 / 年终奖 / 提成 / 绩效）',
  '  - redPocket（红包 / 礼金 / 压岁钱）',
  '  - reimburse（报销）',
  '  - interestRent（利息 / 房租收入 / 股息分红）',
  '  - otherIncome（其他）',
  '',
  'Expense 类别（按关键词匹配，必须从这里选 key）：',
  '  - daily（日常餐饮 / 外卖 / 打车 / 公交 / 日用品 / 咖啡 / 超市等 < ¥500 的日常）',
  '  - housing（房贷 / 房租 / 水电煤 / 物业 / 网费）',
  '  - bigPurchase（数码 / 家电 / 装修 / 旅行 / 衣服等 > ¥500 的大额）',
  '  - creditRepay（信用卡还款。注意只有"还信用卡 / 还卡"才填这个；信用卡刷消费的填实际类别 daily/bigPurchase）',
  '  - transferGift（转账 / 给家人 / 给朋友 / 红包出 / 借出）',
  '  - otherExpense（其他）',
  '',
  '关键判断规则：',
  '- "工资 / 收到 / 进账 / 转给我 / 报销下来" → income',
  '- "花 / 付 / 刷 / 买 / 给 / 还 / 充值" → expense',
  '- "1.5w" / "1.5万" → 15000；"3k" → 3000；"38 块" / "38 元" → 38',
  '- "信用卡刷 200" → expense + paymentMethod=credit（实际类别按消费内容判断，如餐饮就是 daily）',
  '- "还信用卡 5000" → expense + category=creditRepay + paymentMethod=asset',
  '- "今天 / 今" → 今天；"昨天" → 今天 -1 天；"前天" → -2 天；"上周X" → 推算',
  '- 同一句多笔（"午餐 38、奶茶 25"）拆成 2 条 event',
  '- 没有金额的描述（"今天上班"）放入 unrecognized',
  '',
  '严禁：',
  '- 编造用户没提到的事件',
  '- 把信用卡欠款余额当作 event',
  '- 在 JSON 外包裹 ```json``` 代码块',
].join('\n')

function buildContextPrompt(today: string, customPlatforms: string[]): string {
  const platforms = (Object.entries(PLATFORM_LABELS) as [AssetPlatform, string][])
    .map(([k, v]) => `  - ${k}: ${v}`).join('\n')
  const customP = customPlatforms.length > 0
    ? `\n用户自定义平台（如匹配，填 platform=空 + customPlatformName=中文名）：\n${customPlatforms.map(n => `  - ${n}`).join('\n')}`
    : ''
  return [
    `今天日期：${today}`,
    '',
    '允许的 platform enum key：',
    platforms,
    customP,
  ].filter(Boolean).join('\n')
}

export async function parseCashFlowText(args: {
  settings: AISettings
  text: string
  customPlatforms: string[]
}): Promise<ParseCashFlowResult> {
  const trimmed = args.text.trim()
  if (!trimmed) return { events: [], unrecognized: [], rawText: '' }
  if (!args.settings.apiKey || !args.settings.baseUrl || !args.settings.model) {
    throw new Error('AI 配置不完整，请先到「设置 → AI 设置」填写 API Key、Base URL、Model')
  }
  const preset = findAIProviderPreset(args.settings.provider)
  const today = todayIsoDate()

  const userPrompt = [
    buildContextPrompt(today, args.customPlatforms),
    '',
    '用户原文：',
    trimmed,
    '',
    '只输出 JSON 对象。',
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
      context: { task: 'cashflow-parse', today, length: trimmed.length },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `${preset.label} 解析失败 ${res.status}`
    throw new Error(msg)
  }
  const rawText = typeof data.text === 'string' ? data.text : ''
  return parseResponse(rawText, today)
}

const VALID_INCOME_KEYS = new Set(BUILTIN_INCOME_CATEGORIES.map(c => c.key))
const VALID_EXPENSE_KEYS = new Set(BUILTIN_EXPENSE_CATEGORIES.map(c => c.key))
const VALID_PLATFORMS = new Set<AssetPlatform>(Object.keys(PLATFORM_LABELS) as AssetPlatform[])

function parseResponse(rawText: string, today: string): ParseCashFlowResult {
  const json = extractJsonObject(rawText)
  if (!json || typeof json !== 'object') {
    throw new Error('AI 返回的不是合法 JSON；可换个模型再试')
  }
  const obj = json as Record<string, unknown>
  const rawEvents = Array.isArray(obj.events) ? obj.events : []
  const events: ParsedCashFlowEvent[] = []
  for (const raw of rawEvents) {
    const normalized = normalizeEvent(raw, today)
    if (normalized) events.push(normalized)
  }
  const unrecognized = Array.isArray(obj.unrecognized)
    ? obj.unrecognized.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []
  return { events, unrecognized, rawText }
}

function normalizeEvent(raw: unknown, today: string): ParsedCashFlowEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const amount = toFiniteNumber(obj.amount)
  if (!(amount > 0)) return null

  const typeRaw = toCleanString(obj.type)?.toLowerCase()
  const type: CashFlowType = typeRaw === 'income' ? 'income' : 'expense'

  const categoryRaw = toCleanString(obj.category) ?? ''
  const lowerCat = categoryRaw.toLowerCase()
  let category = categoryRaw
  if (type === 'income') {
    if (!VALID_INCOME_KEYS.has(lowerCat)) {
      // 若是中文（自定义），保留；否则兜底
      category = categoryRaw.length > 0 ? categoryRaw : 'otherIncome'
    } else {
      category = lowerCat
    }
  } else {
    if (!VALID_EXPENSE_KEYS.has(lowerCat)) {
      category = categoryRaw.length > 0 ? categoryRaw : 'otherExpense'
    } else {
      category = lowerCat
    }
  }

  const paymentRaw = toCleanString(obj.paymentMethod)?.toLowerCase()
  let paymentMethod: PaymentMethod = paymentRaw === 'credit' ? 'credit' : 'asset'
  if (type === 'income') paymentMethod = 'asset'
  // 信用卡还款本身是 asset 付出去清账
  if (category === 'creditRepay') paymentMethod = 'asset'

  const currencyRaw = toCleanString(obj.currency)?.toUpperCase()
  const currency: 'CNY' | 'USD' = currencyRaw === 'USD' ? 'USD' : 'CNY'

  const platformRaw = toCleanString(obj.platform)?.toLowerCase()
  const platform = platformRaw && VALID_PLATFORMS.has(platformRaw as AssetPlatform)
    ? (platformRaw as AssetPlatform)
    : undefined
  const customPlatformName = toCleanString(obj.customPlatformName)

  const dateRaw = toCleanString(obj.date)
  const date = isIsoDate(dateRaw) ? dateRaw! : today

  return {
    date,
    type,
    amount,
    currency,
    category,
    paymentMethod,
    platform,
    customPlatformName,
    note: (toCleanString(obj.note) ?? '').slice(0, 60),
    originalText: toCleanString(obj.originalText),
  }
}

function isIsoDate(s: string | undefined): boolean {
  return Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s))
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function extractJsonObject(text: string): unknown {
  if (!text) return null
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
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
    const cleaned = value.replace(/[¥￥,\s元]/g, '')
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
