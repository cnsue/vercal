import type { Subpage } from '../App'

interface Props {
  title: string
  scope: string
  context: unknown
  compact?: boolean
  onNavigate: (subpage: Subpage) => void
}

export default function AIAnalysisPanel({ title, scope, context, compact = false, onNavigate }: Props) {
  return (
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      padding: compact ? 12 : 14, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 13 : 15, fontWeight: 800, color: 'var(--text-strong)' }}>
            AI 分析
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>
            {title} · 进入独立页面生成并保存结果
          </div>
        </div>
        <button type="button" onClick={() => onNavigate({ kind: 'ai-analysis', request: { title, scope, context } })} style={{
          border: 'none', borderRadius: 10, padding: '8px 11px',
          background: 'var(--primary)', color: '#fff',
          fontSize: 12, fontWeight: 800, cursor: 'pointer',
          flexShrink: 0,
        }}>
          开始
        </button>
      </div>
    </section>
  )
}
