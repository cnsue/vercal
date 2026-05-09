import { useMemo, useState } from 'react'
import MarkdownText from '../components/MarkdownText'
import { StorageService } from '../store/storage'
import { findAIProviderPreset, type AIAnalysisRecord, type AIAnalysisRequest } from '../types/ai'
import { v4 as uuidv4 } from '../utils/uuid'

interface Props {
  request: AIAnalysisRequest
}

const SYSTEM_PROMPT = [
  '你是 Coinsight 内置的个人资产与股息数据分析助手。',
  '所有输入数据都来自用户本地记录、应用内置库或确定性数据接口。',
  '不要编造分红、价格、研报、ETF 分派、收益率或任何来源。',
  '如果数据缺失、过旧、来源不清或口径冲突，必须明确写“需要补充/核验”。',
  '输出应是中文，简洁、可执行，重点关注集中度、现金流、退休覆盖、股息可持续性和数据完整性。',
  '不要给出买入/卖出指令，不构成投资建议。',
].join('\n')

export default function AIAnalysisPage({ request }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState('')
  const [history, setHistory] = useState<AIAnalysisRecord[]>(() => StorageService.getAIAnalysisHistory())
  const contextPreview = useMemo(() => summarizeContext(request.context), [request.context])

  async function run() {
    const settings = StorageService.getAISettings()
    if (!settings.apiKey || !settings.model || !settings.baseUrl) {
      setError('请先到「设置 → AI 设置」填写 API Key、Model 和 Base URL。')
      setResult('')
      return
    }
    setLoading(true)
    setError('')
    setSavedId('')
    try {
      const preset = findAIProviderPreset(settings.provider)
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          title: request.title,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: buildUserPrompt(request.title, request.scope),
          context: request.context,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `${preset.label} 分析失败`)
      setResult(String(data.text ?? '').trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setResult('')
    } finally {
      setLoading(false)
    }
  }

  function saveResult() {
    if (!result.trim()) return
    const settings = StorageService.getAISettings()
    const preset = findAIProviderPreset(settings.provider)
    const record: AIAnalysisRecord = {
      id: uuidv4(),
      title: request.title,
      scope: request.scope,
      provider: settings.provider,
      providerLabel: preset.label,
      model: settings.model,
      createdAt: new Date().toISOString(),
      result: result.trim(),
    }
    const next = [record, ...history].slice(0, 50)
    StorageService.saveAIAnalysisHistory(next)
    setHistory(next)
    setSavedId(record.id)
  }

  function deleteRecord(id: string) {
    const next = history.filter(r => r.id !== id)
    StorageService.saveAIAnalysisHistory(next)
    setHistory(next)
    if (savedId === id) setSavedId('')
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <section style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
          独立分析页
        </div>
        <div style={{ fontSize: 22, fontWeight: 850, color: 'var(--text-strong)', marginBottom: 8 }}>
          {request.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          {request.scope}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>本次数据摘要</div>
        <pre style={previewStyle}>{contextPreview}</pre>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={run} disabled={loading} style={{
            ...btnStyle,
            flex: 2,
            background: loading ? 'var(--button-secondary-bg)' : 'var(--primary)',
            color: loading ? 'var(--muted)' : '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '分析中...' : result ? '重新分析' : '开始分析'}
          </button>
          <button type="button" onClick={saveResult} disabled={!result.trim()} style={{
            ...btnStyle,
            flex: 1,
            background: result.trim() ? 'var(--button-secondary-bg)' : 'var(--surface-muted)',
            color: result.trim() ? 'var(--button-secondary-text)' : 'var(--muted)',
            cursor: result.trim() ? 'pointer' : 'not-allowed',
          }}>
            保存结果
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
          分析结果只在你点击保存后进入本机历史；不会上传到同步数据。
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>{error}</div>}
        {savedId && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--primary-strong)' }}>已保存到本机历史</div>}
        {result && (
          <div style={{
            marginTop: 12, padding: 12, borderRadius: 12,
            background: 'var(--surface-muted)',
          }}>
            <MarkdownText content={result} />
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>历史分析</div>
        {history.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
            暂无保存记录
          </div>
        ) : history.map(record => (
          <details key={record.id} style={{
            background: 'var(--surface-muted)', borderRadius: 12, padding: 10, marginBottom: 8,
          }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>{record.title}</div>
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>
                    {new Date(record.createdAt).toLocaleString()} · {record.providerLabel} · {record.model}
                  </div>
                </div>
                <button type="button" onClick={e => { e.preventDefault(); deleteRecord(record.id) }} style={{
                  border: 'none', background: 'transparent', color: 'var(--danger)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}>
                  删除
                </button>
              </div>
            </summary>
            <div style={{
              marginTop: 10,
            }}>
              <MarkdownText content={record.result} compact />
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}

function buildUserPrompt(title: string, scope: string): string {
  return [
    `请分析「${title}」。`,
    `分析范围：${scope}`,
    '请按以下结构输出：',
    '1. 关键结论：3 条以内',
    '2. 风险/异常：只写数据支持的发现',
    '3. 可执行动作：优先列数据核验和配置建议',
    '4. 数据完整性：指出缺失、过旧、来源不清或需要人工确认的字段',
    '请使用 Markdown 格式输出，允许使用三级标题、列表、加粗和行内代码。',
  ].join('\n')
}

function summarizeContext(context: unknown): string {
  try {
    const json = JSON.stringify(context, null, 2)
    return json.length > 3000 ? `${json.slice(0, 3000)}\n...` : json
  } catch {
    return '无法预览本次上下文'
  }
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16, marginBottom: 12,
}

const previewStyle: React.CSSProperties = {
  margin: 0, maxHeight: 180, overflow: 'auto',
  background: 'var(--surface-muted)', borderRadius: 10, padding: 10,
  color: 'var(--muted)', fontSize: 11, lineHeight: 1.5,
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
}

const btnStyle: React.CSSProperties = {
  padding: '11px 10px', borderRadius: 10, border: 'none',
  fontSize: 14, fontWeight: 800,
}
