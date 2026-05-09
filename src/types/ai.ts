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

export interface AIProviderPreset {
  key: AIProviderKey
  label: string
  protocol: AIProtocol
  baseUrl: string
  model: string
  note: string
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

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    key: 'qwen',
    label: '千问',
    protocol: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    note: '阿里云 DashScope OpenAI-compatible 接口',
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
    note: 'Google Gemini generateContent 接口',
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
    baseUrl: '',
    model: '',
    note: '请填 MiMo 的 OpenAI-compatible base URL 与 model',
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
