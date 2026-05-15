export type AIProviderKey =
  | 'qwen'
  | 'doubao'
  | 'deepseek'
  | 'gemini'
  | 'openai'
  | 'mimo'
  | 'zhipu'
  | 'minimax'
  | 'custom'

export type AIProtocol = 'openai-compatible' | 'gemini'

export type AIWebSearchMode = 'gemini-grounding' | 'qwen-enable_search' | 'zhipu-web-search' | 'doubao-web'

export interface AIProviderPreset {
  key: AIProviderKey
  label: string
  protocol: AIProtocol
  baseUrl: string
  model: string
  note: string
  /** 该供应商是否声明支持联网搜索；不填表示本应用尚未接通，禁止用于需要实时数据的任务。 */
  webSearch?: AIWebSearchMode
}

export interface AISettings {
  provider: AIProviderKey
  protocol: AIProtocol
  apiKey: string
  baseUrl: string
  model: string
}

export interface AIAnalysisRequest {
  title: string
  scope: string
  context: unknown
}

export type AIAnalysisAction =
  | { kind: 'retirement'; focus: 'dividend-holdings' | 'target-simulator' | 'decent-standard' }
  | { kind: 'pension-settings' }

export interface AIAnalysisRecord {
  id: string
  title: string
  scope: string
  provider: AIProviderKey
  providerLabel: string
  model: string
  createdAt: string
  result: string
}

export type AIPriceConfidence = 'high' | 'medium' | 'low'

export interface DividendPriceRefreshItem {
  code: string
  /** AI 返回时的展示名，用于和原数据对照；前端会以本地 ref 为准 */
  name?: string
  referencePrice: number
  /** YYYY-MM-DD，AI 给出的真实数据日期（如收盘日） */
  priceAsOf: string
  confidence: AIPriceConfidence
  /** AI 引用的数据源 URL，便于人眼复核 */
  sourceUrl?: string
  /** 简短来源说明，例如「东方财富 2026-05-14 收盘」 */
  sourceNote?: string
}

export interface DividendPriceRefreshLogEntry {
  id: string
  code: string
  previousPrice: number
  previousPriceAsOf?: string
  newPrice: number
  newPriceAsOf: string
  confidence: AIPriceConfidence
  provider: AIProviderKey
  providerLabel: string
  model: string
  sourceUrl?: string
  sourceNote?: string
  appliedAt: string
  /** 'auto' = 高置信度直接应用；'manual' = 用户在 Sheet 中勾选应用 */
  appliedBy: 'auto' | 'manual'
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    key: 'qwen',
    label: '千问',
    protocol: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    note: '阿里云 DashScope OpenAI-compatible 接口（已接通 enable_search 联网）',
    webSearch: 'qwen-enable_search',
  },
  {
    key: 'doubao',
    label: '豆包',
    protocol: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-1-6-250615',
    note: '火山方舟 OpenAI-compatible 接口，model 填你的 endpoint/model id',
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    note: 'DeepSeek Chat Completions 接口',
  },
  {
    key: 'gemini',
    label: 'Gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    note: 'Google Gemini generateContent 接口（已接通 Google Search 联网）',
    webSearch: 'gemini-grounding',
  },
  {
    key: 'openai',
    label: 'OpenAI',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    note: 'OpenAI Chat Completions 接口',
  },
  {
    key: 'mimo',
    label: 'MiMo',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'MiMo-7B-RL',
    note: '小米 MiMo OpenAI-compatible 接口，model 可填 MiMo-7B-RL 等',
  },
  {
    key: 'zhipu',
    label: '智谱',
    protocol: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    note: '智谱 GLM OpenAI-compatible 接口',
  },
  {
    key: 'minimax',
    label: 'MiniMax',
    protocol: 'openai-compatible',
    baseUrl: 'https://api.minimax.chat/v1',
    model: 'MiniMax-Text-01',
    note: 'MiniMax OpenAI-compatible 接口',
  },
  {
    key: 'custom',
    label: '自定义',
    protocol: 'openai-compatible',
    baseUrl: '',
    model: '',
    note: '任何 OpenAI-compatible 服务',
  },
]

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  protocol: 'gemini',
  apiKey: '',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-2.5-flash',
}

export function findAIProviderPreset(provider: AIProviderKey): AIProviderPreset {
  return AI_PROVIDER_PRESETS.find(p => p.key === provider) ?? AI_PROVIDER_PRESETS[0]
}
