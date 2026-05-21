import { useState, type CSSProperties } from 'react'
import { StorageService } from '../store/storage'
import { useCashFlowStore } from '../store/useCashFlowStore'
import { useAssetStore } from '../store/useAssetStore'
import { findAIProviderPreset } from '../types/ai'
import {
  parseCashFlowText, type ParsedCashFlowEvent,
} from '../utils/aiCashFlowParser'
import {
  BUILTIN_INCOME_CATEGORIES, BUILTIN_EXPENSE_CATEGORIES,
  findCategoryMeta,
  type CashFlowType, type PaymentMethod,
} from '../types/cashFlow'
import { PLATFORM_LABELS } from '../types/models'
import { formatCNY } from '../utils/formatters'
import VoiceInputButton from './VoiceInputButton'

const PLACEHOLDER = '例如：\n工资 1.5w\n午餐 38、咖啡 25、滴滴 18\n昨天还信用卡 5000\n收到红包 200'

export default function SmartCashFlowInput() {
  const addEvent = useCashFlowStore(s => s.addEvent)
  const customPlatforms = useAssetStore(s => s.customPlatforms)
  const exchangeRate = useAssetStore(s => s.exchangeRate)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParsedCashFlowEvent[]>([])
  const [unrecognized, setUnrecognized] = useState<string[]>([])
  const [appliedCount, setAppliedCount] = useState(0)

  async function run() {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    setParsed([])
    setUnrecognized([])
    setAppliedCount(0)
    try {
      const settings = StorageService.getAISettings()
      const result = await parseCashFlowText({ settings, text, customPlatforms })
      if (result.events.length === 0) {
        setError('AI 没解析出任何现金流。可换种说法（"金额 + 类型描述"）再试。')
      } else {
        setParsed(result.events)
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

  function updateRow(idx: number, patch: Partial<ParsedCashFlowEvent>) {
    setParsed(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function applyAll() {
    if (parsed.length === 0) return
    const rate = exchangeRate?.rate ?? 7.2
    for (const ev of parsed) {
      const amountCNY = ev.currency === 'USD' ? ev.amount * rate : ev.amount
      addEvent({
        date: ev.date,
        type: ev.type,
        amount: ev.amount,
        currency: ev.currency,
        amountCNY,
        category: ev.category,
        paymentMethod: ev.paymentMethod,
        platform: ev.platform,
        customPlatformName: ev.customPlatformName,
        note: ev.note,
      })
    }
    setAppliedCount(parsed.length)
    setParsed([])
    setUnrecognized([])
    setText('')
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
        💬 AI 智能录入（自然语言批量记账）
      </button>
    )
  }

  const settings = StorageService.getAISettings()
  const preset = findAIProviderPreset(settings.provider)
  const aiConfigured = Boolean(settings.apiKey && settings.baseUrl && settings.model)
  const todayHint = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>💬 AI 智能录入现金流</div>
        <button type="button" onClick={() => setOpen(false)} style={closeBtn}>收起</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 8 }}>
        说一句话（或用麦克风），AI 自动拆成多条记账。今天：{todayHint}；当前模型：
        <strong>{preset.label} · {settings.model || '未配置'}</strong>
      </div>

      {!aiConfigured && (
        <div style={errorBoxStyle}>
          AI 配置不完整。请先到「设置 → AI 设置」填写 API Key、Base URL、Model。
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={4}
          disabled={loading}
          style={textareaStyle}
        />
        <div style={{ position: 'absolute', top: 6, right: 6 }}>
          <VoiceInputButton
            disabled={loading}
            onAppend={chunk => setText(prev => prev ? `${prev}\n${chunk}` : chunk)}
          />
        </div>
      </div>

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
          onClick={() => { setText(''); setParsed([]); setUnrecognized([]); setError(''); setAppliedCount(0) }}
          disabled={loading}
          style={secondaryBtnStyle}
        >
          清空
        </button>
      </div>

      {error && <div style={errorBoxStyle}>{error}</div>}

      {appliedCount > 0 && (
        <div style={successBoxStyle}>✅ 已保存 {appliedCount} 条到流水</div>
      )}

      {parsed.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary-text)', marginBottom: 6 }}>
            解析结果（{parsed.length} 条）· 检查后保存
          </div>
          {parsed.map((ev, idx) => (
            <ParsedRow
              key={idx}
              event={ev}
              onChange={patch => updateRow(idx, patch)}
              onRemove={() => removeRow(idx)}
            />
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => { setParsed([]); setUnrecognized([]) }} style={secondaryBtnStyle}>
              全部丢弃
            </button>
            <button type="button" onClick={applyAll} style={{ ...primaryBtnStyle, flex: 2 }}>
              保存 {parsed.length} 条到流水
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

function ParsedRow({ event, onChange, onRemove }: {
  event: ParsedCashFlowEvent
  onChange: (patch: Partial<ParsedCashFlowEvent>) => void
  onRemove: () => void
}) {
  const categoryMeta = findCategoryMeta(event.type, event.category)
  const categoryLabel = categoryMeta?.label ?? event.category
  const categoryIcon = categoryMeta?.icon ?? (event.type === 'income' ? '✨' : '⚠️')
  const isExpense = event.type === 'expense'
  const sign = isExpense ? '−' : '+'
  const sourceColor = isExpense ? 'var(--danger)' : 'var(--primary-strong)'
  const categoryOptions = (event.type === 'income' ? BUILTIN_INCOME_CATEGORIES : BUILTIN_EXPENSE_CATEGORIES)
  const platformLabel = event.platform
    ? PLATFORM_LABELS[event.platform]
    : event.customPlatformName || ''

  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>
            <span style={{ color: sourceColor }}>{sign}{formatCNY(event.amount)} {event.currency}</span>
            {' · '}
            <span>{categoryIcon} {categoryLabel}</span>
            {event.paymentMethod === 'credit' && (
              <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
                信用卡
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {event.date}
            {platformLabel && ` · ${platformLabel}`}
            {event.note && ` · ${event.note}`}
          </div>
          {event.originalText && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
              来自原文："{event.originalText}"
            </div>
          )}
        </div>
        <button type="button" onClick={onRemove} style={{
          border: 'none', background: 'transparent', color: 'var(--danger)',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, padding: '2px 4px',
        }}>
          移除
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            const newType: CashFlowType = isExpense ? 'income' : 'expense'
            const fallbackCat = newType === 'income' ? 'otherIncome' : 'otherExpense'
            onChange({
              type: newType,
              category: fallbackCat,
              paymentMethod: newType === 'income' ? 'asset' : event.paymentMethod,
            })
          }}
          style={smallToggleBtn(isExpense)}
        >
          切换为{isExpense ? '收入' : '支出'}
        </button>
        <input
          type="number"
          value={event.amount}
          onChange={e => onChange({ amount: parseFloat(e.target.value) || 0 })}
          style={{ ...inlineInputStyle, width: 90 }}
        />
        <select
          value={event.category}
          onChange={e => onChange({ category: e.target.value })}
          style={{ ...inlineInputStyle, flex: 1, minWidth: 100 }}
        >
          {categoryOptions.map(c => (
            <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
          ))}
          {!categoryOptions.some(c => c.key === event.category) && (
            <option value={event.category}>{event.category}（自定义）</option>
          )}
        </select>
        {isExpense && (
          <select
            value={event.paymentMethod}
            onChange={e => onChange({ paymentMethod: e.target.value as PaymentMethod })}
            style={{ ...inlineInputStyle, width: 84 }}
          >
            <option value="asset">资产付</option>
            <option value="credit">信用卡</option>
          </select>
        )}
      </div>
    </div>
  )
}

const triggerStyle: CSSProperties = {
  width: '100%', padding: 10, marginBottom: 12,
  border: '1px dashed var(--primary-border)',
  background: 'var(--primary-soft)', borderRadius: 10,
  color: 'var(--primary-text)', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
}

const panelStyle: CSSProperties = {
  padding: 12, marginBottom: 12,
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

const successBoxStyle: CSSProperties = {
  marginTop: 8, padding: 9, borderRadius: 8,
  background: 'var(--primary-soft)', color: 'var(--primary-text)',
  fontSize: 11, lineHeight: 1.55,
}

const rowStyle: CSSProperties = {
  padding: 10, marginBottom: 6, borderRadius: 10,
  background: 'var(--surface)', border: '1px solid var(--border)',
}

const inlineInputStyle: CSSProperties = {
  padding: '7px 10px', borderRadius: 8,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text)', fontSize: 12, fontFamily: 'inherit',
}

function smallToggleBtn(isExpense: boolean): CSSProperties {
  return {
    padding: '7px 10px', borderRadius: 8, border: 'none',
    background: isExpense ? 'var(--primary-soft)' : 'var(--warning-bg)',
    color: isExpense ? 'var(--primary-text)' : 'var(--warning-text)',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    flexShrink: 0,
  }
}
