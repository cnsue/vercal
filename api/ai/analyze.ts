import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AIProtocol, AIProviderKey, AIWebSearchMode } from '../../src/types/ai.js'

interface AnalyzeBody {
  provider?: AIProviderKey
  protocol?: AIProtocol
  apiKey?: string
  baseUrl?: string
  model?: string
  title?: string
  systemPrompt?: string
  userPrompt?: string
  context?: unknown
  /** 启用供应商联网/搜索增强；不传或 false 时关闭。具体怎么挂取决于 webSearchMode。 */
  enableWebSearch?: boolean
  /** 联网模式标识，决定向上游请求体注入哪种字段 */
  webSearchMode?: AIWebSearchMode
}

const DEFAULT_TIMEOUT_MS = 55_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as AnalyzeBody
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
  const baseUrl = trimTrailingSlash(typeof body.baseUrl === 'string' ? body.baseUrl : '')
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  const protocol: AIProtocol = body.protocol === 'gemini' ? 'gemini' : 'openai-compatible'

  if (!apiKey || !baseUrl || !model) {
    return res.status(400).json({ error: 'AI 配置不完整，请先填写 API Key、Base URL 和 Model' })
  }

  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : ''
  const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt : ''
  const context = safeJson(body.context)
  const prompt = `${userPrompt}\n\n【本次分析数据】\n${context}`
  const enableWebSearch = body.enableWebSearch === true
  const webSearchMode = enableWebSearch ? body.webSearchMode : undefined

  try {
    const result = protocol === 'gemini'
      ? await callGemini({ apiKey, baseUrl, model, systemPrompt, prompt, enableWebSearch })
      : await callOpenAICompatible({ apiKey, baseUrl, model, systemPrompt, prompt, webSearchMode })
    return res.status(200).json(result)
  } catch (err) {
    return res.status(502).json({ error: sanitizeError(err) })
  }
}

export interface AnalyzeUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

interface AnalyzeResult {
  text: string
  usage?: AnalyzeUsage
}

async function callOpenAICompatible(input: {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  prompt: string
  webSearchMode?: AIWebSearchMode
}): Promise<AnalyzeResult> {
  const url = `${input.baseUrl}/chat/completions`
  const body: Record<string, unknown> = {
    model: input.model,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.prompt },
    ],
    temperature: 0.2,
  }
  // 各家自有的联网搜索字段（OpenAI-compatible 协议下的方言）
  if (input.webSearchMode === 'qwen-enable_search') {
    // 阿里 DashScope: 顶层 enable_search; qwen-plus 等模型原生支持
    body.enable_search = true
  } else if (input.webSearchMode === 'zhipu-web-search') {
    // 智谱 GLM: tools 中声明 web_search 工具
    body.tools = [{ type: 'web_search', web_search: { enable: true } }]
  }
  // doubao-web 暂未支持（需切换 bot endpoint），其他 mode 忽略
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const rawText = await response.text().catch(() => '')
  let data: {
    choices?: Array<{ message?: { content?: string } }>
    error?: string | { message?: string; code?: string }
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  try { data = JSON.parse(rawText) } catch { data = {} }

  if (!response.ok) {
    const err = data.error
    const msg = typeof err === 'string'
      ? err
      : err?.message ?? `AI 请求失败 ${response.status}`
    console.error('[ai/analyze] upstream error', response.status, url, rawText.slice(0, 600))
    throw new Error(`${msg}（HTTP ${response.status}）`)
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) {
    console.error('[ai/analyze] empty response', url, rawText.slice(0, 400))
    throw new Error('AI 返回为空')
  }
  const usage = normalizeOpenAIUsage(data.usage)
  return usage ? { text, usage } : { text }
}

function normalizeOpenAIUsage(raw: {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
} | undefined): AnalyzeUsage | undefined {
  if (!raw) return undefined
  const prompt = toFiniteNonNegative(raw.prompt_tokens)
  const completion = toFiniteNonNegative(raw.completion_tokens)
  const total = toFiniteNonNegative(raw.total_tokens)
  if (prompt + completion + total === 0) return undefined
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total > 0 ? total : prompt + completion,
  }
}

function toFiniteNonNegative(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function callGemini(input: {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  prompt: string
  enableWebSearch?: boolean
}): Promise<string> {
  const url = `${input.baseUrl}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`
  // 注意：Gemini 启用 google_search 工具时不能同时设置 responseMimeType: application/json，
  // 因此 JSON 输出统一通过 prompt 强约束 + 前端容错解析实现。
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: input.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
    generationConfig: { temperature: 0.2 },
  }
  if (input.enableWebSearch) {
    body.tools = [{ google_search: {} }]
  }
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({})) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(data.error?.message ?? `Gemini 请求失败：${response.status}`)
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim()
  if (!text) throw new Error('AI 返回为空')
  return text
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  return fetch(url, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2).slice(0, 24_000)
  } catch {
    return '{}'
  }
}

function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [redacted]')
    .replace(/key=([^&\s]+)/g, 'key=[redacted]')
    .replace(/sk-[A-Za-z0-9._\-]+/g, 'sk-[redacted]')
    .slice(0, 500)
}
