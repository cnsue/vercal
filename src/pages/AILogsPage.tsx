import { useMemo, useState, type CSSProperties } from 'react'
import { StorageService } from '../store/storage'
import type { AIRequestLogEntry } from '../types/ai'

export default function AILogsPage() {
  const [logs, setLogs] = useState<AIRequestLogEntry[]>(() => StorageService.getAIRequestLog())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ok' | 'error'>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return logs
    return logs.filter(l => l.status === filter)
  }, [logs, filter])

  function refresh() {
    setLogs(StorageService.getAIRequestLog())
  }

  function clearAll() {
    if (!confirm('确认清空所有 AI 请求日志？此操作不可撤销。')) return
    StorageService.clearAIRequestLog()
    setLogs([])
    setExpandedId(null)
  }

  async function copyRaw(entry: AIRequestLogEntry) {
    const payload = JSON.stringify({
      task: entry.task,
      timestamp: entry.timestamp,
      provider: entry.providerLabel,
      model: entry.model,
      input: entry.inputSummary,
      status: entry.status,
      error: entry.errorMessage,
      raw: entry.rawResponseText,
    }, null, 2)
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <section style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
          本机保存 · 不参与多设备同步
        </div>
        <div style={{ fontSize: 22, fontWeight: 850, color: 'var(--text-strong)', marginBottom: 8 }}>
          AI 请求日志
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          记录最近 30 次 AI 联网请求的输入摘要与原始返回，用于排查「未返回有效价格」等问题。日志只保存在当前浏览器，不上传。
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <FilterChip label="全部" active={filter === 'all'} onClick={() => setFilter('all')} count={logs.length} />
            <FilterChip label="成功" active={filter === 'ok'} onClick={() => setFilter('ok')} count={logs.filter(l => l.status === 'ok').length} />
            <FilterChip label="失败" active={filter === 'error'} onClick={() => setFilter('error')} count={logs.filter(l => l.status === 'error').length} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={refresh} style={smallBtn}>刷新</button>
            <button type="button" onClick={clearAll} style={{ ...smallBtn, color: 'var(--danger)' }} disabled={logs.length === 0}>
              清空
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            {logs.length === 0 ? '暂无请求记录' : '当前筛选下没有记录'}
          </div>
        ) : (
          filtered.map(entry => (
            <LogRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(prev => (prev === entry.id ? null : entry.id))}
              onCopy={() => copyRaw(entry)}
            />
          ))
        )}
      </section>
    </div>
  )
}

function LogRow({ entry, expanded, onToggle, onCopy }: {
  entry: AIRequestLogEntry
  expanded: boolean
  onToggle: () => void
  onCopy: () => void
}) {
  const tone = entry.status === 'ok' ? 'success' : 'danger'
  const dot = tone === 'success' ? 'var(--primary-strong)' : 'var(--danger)'
  const time = new Date(entry.timestamp).toLocaleString()
  const summary = entry.status === 'ok'
    ? `解析 ${entry.parsedItemCount ?? 0} 条 · 未返回 ${entry.missingCount ?? 0} 条`
    : (entry.errorMessage ?? '未知错误')

  return (
    <div style={{
      padding: 10, marginBottom: 8, borderRadius: 12,
      background: 'var(--surface-muted)', border: '1px solid var(--border)',
    }}>
      <button type="button" onClick={onToggle} style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit',
        fontFamily: 'inherit',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>
            {labelForTask(entry.task)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {entry.providerLabel} · {entry.model}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
            {entry.durationMs} ms
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{time}</div>
        <div style={{
          marginTop: 4, fontSize: 12, lineHeight: 1.5,
          color: entry.status === 'ok' ? 'var(--text)' : 'var(--danger)',
        }}>
          {summary}
        </div>
        {entry.inputSummary && (
          <div style={{
            marginTop: 4, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            输入：{entry.inputSummary}
          </div>
        )}
      </button>

      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <DetailRow label="任务" value={entry.task} />
          <DetailRow label="协议" value={`${entry.protocol}${entry.webSearchMode ? ` · ${entry.webSearchMode}` : ''}`} />
          {entry.errorMessage && <DetailRow label="错误" value={entry.errorMessage} tone="danger" />}
          {entry.inputSummary && <DetailRow label="输入" value={entry.inputSummary} />}
          {entry.rawResponseText && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>原始返回</div>
              <pre style={preStyle}>{entry.rawResponseText}</pre>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button type="button" onClick={onCopy} style={smallBtn}>复制为 JSON</button>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div style={{ marginBottom: 5, fontSize: 12, lineHeight: 1.55 }}>
      <span style={{ color: 'var(--muted)', marginRight: 6 }}>{label}：</span>
      <span style={{ color: tone === 'danger' ? 'var(--danger)' : 'var(--text)' }}>{value}</span>
    </div>
  )
}

function FilterChip({ label, active, onClick, count }: {
  label: string; active: boolean; onClick: () => void; count: number
}) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
      border: '1px solid var(--border)',
      background: active ? 'var(--primary)' : 'var(--surface)',
      color: active ? '#fff' : 'var(--text)',
      cursor: 'pointer',
    }}>
      {label} {count > 0 && <span style={{ opacity: 0.8 }}>· {count}</span>}
    </button>
  )
}

function labelForTask(task: string): string {
  switch (task) {
    case 'dividend-price-refresh-batch': return '股息价格批量刷新'
    case 'dividend-price-refresh-single': return '股息价格单只刷新'
    default: return task
  }
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16, marginBottom: 12,
}

const smallBtn: CSSProperties = {
  padding: '5px 10px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
}

const preStyle: CSSProperties = {
  margin: 0, maxHeight: 360, overflow: 'auto',
  background: 'var(--surface)', borderRadius: 10, padding: 10,
  color: 'var(--text)', fontSize: 11, lineHeight: 1.55,
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  border: '1px solid var(--border)',
}
