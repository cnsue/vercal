import { useState, type CSSProperties } from 'react'
import type { SnapshotItem } from '../types/models'
import { PLATFORM_LABELS, CLASS_LABELS } from '../types/models'
import { StorageService } from '../store/storage'
import { useAssetStore } from '../store/useAssetStore'
import { parseSnapshotText, toSnapshotItem, type ParsedSnapshotItem } from '../utils/aiSnapshotParser'
import { findAIProviderPreset } from '../types/ai'
import VoiceInputButton from './VoiceInputButton'

interface Props {
  /** 调用方接收 AI 解析后的 SnapshotItem 列表，自己 merge 到当前 snapshot */
  onApply: (items: SnapshotItem[]) => void
}

const PLACEHOLDER = '例如：\n招行卡 20 万\n雪球 50 万\nA 股账户 80 万\n币安 3000 美元\nETF 持仓 8 万'

export default function SmartSnapshotInput({ onApply }: Props) {
  const customPlatforms = useAssetStore(s => s.customPlatforms)
  const customClasses = useAssetStore(s => s.customClasses)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParsedSnapshotItem[]>([])
  const [unrecognized, setUnrecognized] = useState<string[]>([])

  async function run() {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setParsed([])
    setUnrecognized([])
    try {
      const settings = StorageService.getAISettings()
      const result = await parseSnapshotText({
        settings, text,
        customPlatforms, customClasses,
      })
      if (result.items.length === 0) {
        setError('AI 没解析出任何资产条目。可换一种说法（如「平台 + 金额 + 币种」）再试。')
      } else {
        setParsed(result.items)
        setUnrecognized(result.unrecognized)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function removeRow(idx: number) {
    setParsed(prev => prev.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, patch: Partial<ParsedSnapshotItem>) {
    setParsed(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function applyAll() {
    if (parsed.length === 0) return
    onApply(parsed.map(toSnapshotItem))
    setOpen(false)
    setText('')
    setParsed([])
    setUnrecognized([])
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
        💬 AI 智能录入（自然语言描述资产）
      </button>
    )
  }

  const settings = StorageService.getAISettings()
  const preset = findAIProviderPreset(settings.provider)
  const aiConfigured = Boolean(settings.apiKey && settings.baseUrl && settings.model)

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>💬 AI 智能录入</div>
        <button type="button" onClick={() => setOpen(false)} style={closeBtn}>收起</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 8 }}>
        用自然语言把各平台资产列出来，AI 会拆成结构化条目让你确认。当前模型：
        <strong>{preset.label} · {settings.model || '未配置'}</strong>
      </div>

      {!aiConfigured && (
        <div style={errorBoxStyle}>
          AI 配置不完整。请先到「设置 → AI 设置」填写 API Key、Base URL、Model。
        </div>
      )}

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={5}
        disabled={loading}
        style={textareaStyle}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={run}
          disabled={loading || !text.trim() || !aiConfigured}
          style={{
            ...primaryBtnStyle,
            opacity: loading || !text.trim() || !aiConfigured ? 0.5 : 1,
            cursor: loading || !text.trim() || !aiConfigured ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '解析中...' : '解析'}
        </button>
        <button
          type="button"
          onClick={() => { setText(''); setParsed([]); setUnrecognized([]); setError('') }}
          disabled={loading}
          style={secondaryBtnStyle}
        >
          清空
        </button>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {parsed.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 6 }}>
            解析结果（{parsed.length} 条）· 检查后应用
          </div>
          {parsed.map((item, idx) => (
            <ParsedRow
              key={idx}
              item={item}
              onChange={patch => updateRow(idx, patch)}
              onRemove={() => removeRow(idx)}
            />
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => { setParsed([]); setUnrecognized([]) }} style={secondaryBtnStyle}>
              全部丢弃
            </button>
            <button type="button" onClick={applyAll} style={{ ...primaryBtnStyle, flex: 2 }}>
              应用到快照（{parsed.length} 条）
            </button>
          </div>
        </div>
      )}

      {unrecognized.length > 0 && (
        <div style={{ marginTop: 10, padding: 9, background: 'var(--warning-bg)', borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning-text)', marginBottom: 4 }}>
            未识别 / 跳过的原文片段
          </div>
          <div style={{ fontSize: 11, color: 'var(--warning-text)', lineHeight: 1.55 }}>
            {unrecognized.map((u, i) => <div key={i}>· {u}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

function ParsedRow({ item, onChange, onRemove }: {
  item: ParsedSnapshotItem
  onChange: (patch: Partial<ParsedSnapshotItem>) => void
  onRemove: () => void
}) {
  const platformLabel = item.platform === 'other'
    ? (item.customPlatformName || '其他')
    : PLATFORM_LABELS[item.platform]
  const classLabel = item.assetClass === 'other'
    ? (item.customAssetClassName || '其他')
    : CLASS_LABELS[item.assetClass]

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>
            {platformLabel} · <span style={{ fontWeight: 600, color: 'var(--text)' }}>{classLabel}</span>
          </div>
          {item.originalText && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              来自原文："{item.originalText}"
            </div>
          )}
        </div>
        <button type="button" onClick={onRemove} style={{
          border: 'none', background: 'transparent', color: 'var(--danger)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
        }}>
          移除
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="number"
          value={item.amount}
          onChange={e => onChange({ amount: parseFloat(e.target.value) || 0 })}
          style={{ ...inlineInputStyle, flex: 2 }}
        />
        <select
          value={item.currency}
          onChange={e => onChange({ currency: e.target.value as 'CNY' | 'USD' })}
          style={{ ...inlineInputStyle, width: 72 }}
        >
          <option value="CNY">CNY</option>
          <option value="USD">USD</option>
        </select>
      </div>
      {(item.assetLabel || item.note) && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
          {item.assetLabel && <span>标签：{item.assetLabel}</span>}
          {item.assetLabel && item.note && <span> · </span>}
          {item.note && <span>备注：{item.note}</span>}
        </div>
      )}
    </div>
  )
}

const triggerStyle: CSSProperties = {
  width: '100%', padding: 10, marginBottom: 8,
  border: '1px dashed var(--primary-border)',
  background: 'var(--primary-soft)', borderRadius: 10,
  color: 'var(--primary-text)', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

const panelStyle: CSSProperties = {
  padding: 12, marginBottom: 10,
  border: '1px solid var(--primary-border)',
  borderRadius: 12, background: 'var(--primary-soft)',
}

const closeBtn: CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
  padding: '2px 6px', fontFamily: 'inherit',
}

const textareaStyle: CSSProperties = {
  width: '100%', padding: 10, borderRadius: 8,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text)', fontSize: 13, lineHeight: 1.55, boxSizing: 'border-box',
  resize: 'vertical', fontFamily: 'inherit',
}

const primaryBtnStyle: CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
  background: 'var(--primary)', color: '#fff',
  fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
}

const secondaryBtnStyle: CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}

const errorBoxStyle: CSSProperties = {
  marginTop: 8, padding: 9, borderRadius: 8,
  background: 'var(--danger-bg)', color: 'var(--danger)',
  fontSize: 11, lineHeight: 1.55,
}

const rowStyle: CSSProperties = {
  padding: 10, marginBottom: 6, borderRadius: 10,
  background: 'var(--surface)', border: '1px solid var(--border)',
}

const inlineInputStyle: CSSProperties = {
  padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
}
