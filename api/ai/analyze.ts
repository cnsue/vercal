import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AIProtocol, AIProviderKey } from '../../src/types/ai.js'

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
  /** 启用供应商联网/搜索增强（目前仅 Gemini grounding 支持） */
  enableWebSearch?: boolean
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

  try {
    const text = protocol === 'gemini'
      ? await callGemini({ apiKey, baseUrl, model, systemPrompt, prompt, enableWebSearch })
      : await callOpenAICompatible({ apiKey, baseUrl, model, systemPrompt, prompt })
    return res.status(200).json({ text })
  } catch (err) {
    return res.status(502).json({ error: sanitizeError(err) })
  }
}

async function callOpenAICompatible(input: {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  prompt: string
}): Promise<string> {
  const url = `${input.baseUrl}/chat/completions`
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.prompt },
      ],
      temperature: 0.2,
    }),
  })
  const rawText = await response.text().catch(() => '')
  let data: { choices?: Array<{ message?: { content?: string } }>; error?: string | { message?: string; code?: string } }
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
  return text
}

async function callGemini(input: {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  prompt: string
}): Promise<string> {
  const url = `${input.baseUrl}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
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
