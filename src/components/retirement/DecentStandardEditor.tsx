import { useState, useEffect, useMemo } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'
import {
  DECENT_DIMENSIONS, defaultDecentBreakdown, sumBreakdown,
  type DecentBreakdownItem, type DecentDimensionKey,
} from '../../types/retirement'
import { formatCNY } from '../../utils/formatters'

interface Props {
  open: boolean
  onClose: () => void
}

const STEP = 100

function cloneBreakdown(items: DecentBreakdownItem[]): DecentBreakdownItem[] {
  return DECENT_DIMENSIONS.map(d => {
    const existing = items.find(i => i.key === d.key)
    return { key: d.key, monthlyAmount: existing ? existing.monthlyAmount : d.defaultMonthly }
  })
}

export default function DecentStandardEditor({ open, onClose }: Props) {
  const decent = useRetirementStore(s => s.plan.decentStandard)
  const setDecentStandard = useRetirementStore(s => s.setDecentStandard)
  const [items, setItems] = useState<DecentBreakdownItem[]>(defaultDecentBreakdown())

  useEffect(() => {
    if (open) {
      setItems(decent.breakdown.length === DECENT_DIMENSIONS.length
        ? cloneBreakdown(decent.breakdown)
        : defaultDecentBreakdown())
    }
  }, [open, decent.breakdown])

  const total = useMemo(() => sumBreakdown(items), [items])

  if (!open) return null

  function updateItem(key: DecentDimensionKey, nextAmount: number) {
    setItems(prev => prev.map(i => (i.key === key ? { ...i, monthlyAmount: Math.max(0, Math.round(nextAmount)) } : i)))
  }

  function resetDefaults() {
    setItems(defaultDecentBreakdown())
  }

  function save() {
    setDecentStandard({
      monthlyAmount: sumBreakdown(items),
      breakdown: items.map(i => ({ key: i.key, monthlyAmount: Math.max(0, Math.round(i.monthlyAmount)) })),
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      zIndex: 100, display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 480, margin: '0 auto',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
            设定你的体面退休标准
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, marginBottom: 14 }}>
            我们帮你拆解为 6 个生活方面，可随意调整
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {items.map(item => {
            const meta = DECENT_DIMENSIONS.find(d => d.key === item.key)!
            return (
              <DimensionRow
                key={item.key}
                icon={meta.icon}
                label={meta.label}
                amount={item.monthlyAmount}
                onChange={v => updateItem(item.key, v)}
              />
            )
          })}
        </div>

        <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 12, fontSize: 13, color: 'var(--muted)',
          }}>
            <span>总计月开支</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-strong)', letterSpacing: '-0.02em' }}>
              {formatCNY(total)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', cursor: 'pointer', fontWeight: 600 }}>
              取消
            </button>
            <button onClick={resetDefaults}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', cursor: 'pointer', fontWeight: 600 }}>
              重置默认
            </button>
            <button onClick={save}
              style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
              确认体面标准
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DimensionRow({ icon, label, amount, onChange }: {
  icon: string; label: string; amount: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
      <div style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>元 / 月</div>
      </div>
      <button onClick={() => onChange(amount - STEP)} aria-label="减少"
        style={stepperStyle}>−</button>
      <input type="number" inputMode="numeric" value={amount}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{
          width: 90, padding: '8px 10px', borderRadius: 8,
          border: '1px solid var(--input-border)', background: 'var(--input-bg)',
          color: 'var(--text)', fontSize: 15, textAlign: 'right', boxSizing: 'border-box',
          fontFamily: 'inherit',
        }} />
      <button onClick={() => onChange(amount + STEP)} aria-label="增加"
        style={stepperStyle}>+</button>
    </div>
  )
}

const stepperStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: 'none',
  background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
  fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0, fontWeight: 700,
}
