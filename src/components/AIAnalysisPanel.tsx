import { useState } from 'react'
import { StorageService } from '../store/storage'
import { findAIProviderPreset } from '../types/ai'

interface Props {
  title: string
  scope: string
  context: unknown
  compact?: boolean
}

const SYSTEM_PROMPT = [
  '你是 Coinsight 内置的个人资产与股息数据分析助手。',
  '所有输入数据都来自用户本地记录、应用内置库或确定性数据接口。',
  '不要编造分红、价格、研报、ETF 分派、收益率或任何来源。',
  '如果数据缺失、过旧、来源不清或口径冲突，必须明确写“需要补充/核验”。',
  '输出应是中文，简洁、可执行，重点关注集中度、现金流、退休覆盖、股息可持续性和数据完整性。',
  '不要给出买入/卖出指令，不构成投资建议。',
].join('\n')

export default function AIAnalysisPanel({ title, scope, context, compact = false }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  async function run() {
    const settings = StorageService.getAISettings()
    if (!settings.apiKey || !settings.model || !settings.baseUrl) {
      setError('请先到「设置 → AI 设置」填写 API Key、Model 和 Base URL。')
      setResult('')
      return
    }
    setLoading(true)
    setError('')
    try {
      const preset = findAIProviderPreset(settings.provider)
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          title,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: buildUserPrompt(title, scope),
          context,
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

  return (
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      padding: compact ? 12 : 14, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 13 : 15, fontWeight: 800, color: 'var(--text-strong)' }}>
            🤖 {title}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>
            使用本机 API Key 发起一次分析，不保存分析内容
          </div>
        </div>
        <button type="button" onClick={run} disabled={loading} style={{
          border: 'none', borderRadius: 10, padding: '8px 11px',
          background: loading ? 'var(--button-secondary-bg)' : 'var(--primary)',
          color: loading ? 'var(--muted)' : '#fff',
          fontSize: 12, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}>
          {loading ? '分析中' : 'AI 分析'}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>
          {error}
        </div>
      )}
      {result && (
        <div style={{
          marginTop: 10, padding: 10, borderRadius: 10,
          background: 'var(--surface-muted)', color: 'var(--text)',
          fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap',
        }}>
          {result}
        </div>
      )}
    </section>
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
  ].join('\n')
}
