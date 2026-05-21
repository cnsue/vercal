import {
  DECENT_DIMENSIONS,
  type DecentBreakdownItem,
  type DecentDimensionKey,
  type FamilySize,
  type CityTier,
  FAMILY_SIZE_LABELS,
  CITY_TIER_LABELS,
} from '../types/retirement'
import { findAIProviderPreset, type AISettings } from '../types/ai'
import { v4 as uuidv4 } from './uuid'

export interface DecentRecommendation {
  breakdown: DecentBreakdownItem[]
  summary: string
  /** 每条 builtin 项目的解释（key → 解释文字），用 UI hint 展示 */
  reasons: Partial<Record<DecentDimensionKey, string>>
  /** AI 推荐了哪些自定义项（如「兴趣 / 宠物 / 学习」），同样附解释 */
  customReasons: Array<{ name: string; reason: string }>
  rawText: string
}

const SYSTEM_PROMPT = [
  '你是一个面向中国都市家庭的退休生活预算规划助手。',
  '用户会告诉你城市、家庭规模、关注偏好（如"重医疗"、"爱旅游"、"重子女教育"等），',
  '你需要给出一份月度退休生活预算（含 7 个固定维度 + 可选的自定义补充项），单位元/月（税后）。',
  '',
  '7 个固定维度（必须全部给出 monthlyAmount，按"体面/decent"档位估算，可以是 0 元，但不要漏维度）：',
  '- clothing 衣：衣着鞋袜、洗护、换季更新',
  '- food 食：三餐食材、外卖、节日',
  '- housing 住：房租 / 按揭、水电煤、物业、维护',
  '- transport 行：公共交通、打车、油费、停车、远行',
  '- medical 医：日常医疗、保健、体检、慢病、长期护理',
  '- leisure 乐：娱乐、订阅、旅行、学习成长、文体',
  '- social 爱：人情、赡养、子女教育、公益、宠物',
  '',
  '可选自定义项（仅在用户明确提到时新增，每项 50 元以上）：',
  '- 如"兴趣摄影"、"养宠"、"投资副业"、"宗教/慈善"等用户偏好',
  '',
  '城市等级参考（一线城市 > 新一线 > 二三线 > 四五线，开销约 1.4x : 1.1x : 1.0x : 0.7x）：',
  '- tier1 一线（北上广深、香港）',
  '- newTier1 新一线（杭州、成都、武汉、苏州、南京、西安、长沙、天津、重庆）',
  '- tier23 二三线（多数省会及发达地级市）',
  '- tier45 四五线（其余地级市与县城）',
  '',
  '家庭规模系数（单人 0.65、夫妻 1.0、三口 1.25、四口及以上 1.45）。',
  '',
  '严格按下面 Schema 输出，整段响应**只**包含一个 JSON 对象，不要任何 Markdown、解释或前后缀文字。',
  '',
  'Schema:',
  '{',
  '  "summary": "string，2-3 句话说明这份预算的整体定位和取舍",',
  '  "breakdown": {',
  '    "clothing": { "monthlyAmount": number, "reason": "string，一句话说明为什么这个数额" },',
  '    "food":     { "monthlyAmount": number, "reason": "string" },',
  '    "housing":  { "monthlyAmount": number, "reason": "string" },',
  '    "transport":{ "monthlyAmount": number, "reason": "string" },',
  '    "medical":  { "monthlyAmount": number, "reason": "string" },',
  '    "leisure":  { "monthlyAmount": number, "reason": "string" },',
  '    "social":   { "monthlyAmount": number, "reason": "string" }',
  '  },',
  '  "custom": [',
  '    { "name": "string，中文项目名（5 字以内）", "icon": "string，emoji 1 个", "monthlyAmount": number, "reason": "string" }',
  '  ]',
  '}',
  '',
  '严禁：',
  '- 漏掉 7 个固定维度中的任何一个',
  '- 把维度合并（如 食 + 住 合成一项）',
  '- monthlyAmount 给负数；',
  '- 在 JSON 外包裹 ```json``` 代码块或加任何说明文字',
].join('\n')

export async function recommendDecentStandard(args: {
  settings: AISettings
  city: string
  familySize: FamilySize
  cityTier: CityTier
  preferences: string
}): Promise<DecentRecommendation> {
  if (!args.settings.apiKey || !args.settings.baseUrl || !args.settings.model) {
    throw new Error('AI 配置不完整，请先到「设置 → AI 设置」填写 API Key、Base URL、Model')
  }
  const preset = findAIProviderPreset(args.settings.provider)

  const userPrompt = [
    '请为下列用户出一份体面退休生活预算：',
    `- 城市：${args.city.trim() || '（未指定）'}`,
    `- 城市等级：${CITY_TIER_LABELS[args.cityTier]}（${args.cityTier}）`,
    `- 家庭规模：${FAMILY_SIZE_LABELS[args.familySize]}（${args.familySize}）`,
    `- 偏好与关注点：${args.preferences.trim() || '（无特别偏好）'}`,
    '',
    '输出"体面/decent"档位的月度预算（既不是温饱，也不是从容），单位元/月。',
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
      context: {
        task: 'decent-standard-recommend',
        city: args.city, cityTier: args.cityTier, familySize: args.familySize,
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `${preset.label} 推荐失败 ${res.status}`
    throw new Error(msg)
  }
  const rawText = typeof data.text === 'string' ? data.text : ''
  return parseResponse(rawText)
}

function parseResponse(rawText: string): DecentRecommendation {
  const json = extractJsonObject(rawText)
  if (!json || typeof json !== 'object') {
    throw new Error('AI 返回的不是合法 JSON；可换个模型或简化输入再试')
  }
  const obj = json as Record<string, unknown>
  const breakdownRaw = obj.breakdown && typeof obj.breakdown === 'object'
    ? (obj.breakdown as Record<string, unknown>)
    : {}

  const breakdown: DecentBreakdownItem[] = []
  const reasons: Partial<Record<DecentDimensionKey, string>> = {}
  for (const dim of DECENT_DIMENSIONS) {
    const entryRaw = breakdownRaw[dim.key]
    const entry = entryRaw && typeof entryRaw === 'object'
      ? (entryRaw as Record<string, unknown>)
      : {}
    const amount = toFiniteNumber(entry.monthlyAmount)
    breakdown.push({
      id: dim.key,
      builtinKey: dim.key as DecentDimensionKey,
      name: dim.label,
      icon: dim.icon,
      monthlyAmount: amount > 0 ? Math.round(amount) : dim.defaultMonthly,
    })
    const reason = toCleanString(entry.reason)
    if (reason) reasons[dim.key as DecentDimensionKey] = reason
  }

  const customRaw = Array.isArray(obj.custom) ? obj.custom : []
  const customReasons: DecentRecommendation['customReasons'] = []
  for (const raw of customRaw) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const name = toCleanString(r.name)
    const amount = toFiniteNumber(r.monthlyAmount)
    if (!name || !(amount > 0)) continue
    const icon = toCleanString(r.icon) ?? '⭐'
    breakdown.push({
      id: uuidv4(),
      name,
      icon,
      monthlyAmount: Math.round(amount),
    })
    const reason = toCleanString(r.reason) ?? ''
    customReasons.push({ name, reason })
  }

  const summary = toCleanString(obj.summary) ?? ''
  return { breakdown, summary, reasons, customReasons, rawText }
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
