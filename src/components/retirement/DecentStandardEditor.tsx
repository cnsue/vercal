import { useState, useEffect } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'

interface Props {
  open: boolean
  onClose: () => void
}

export default function DecentStandardEditor({ open, onClose }: Props) {
  const decent = useRetirementStore(s => s.plan.decentStandard)
  const setDecentStandard = useRetirementStore(s => s.setDecentStandard)
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue(decent.monthlyAmount > 0 ? String(decent.monthlyAmount) : '')
  }, [open, decent.monthlyAmount])

  if (!open) return null

  function save() {
    const num = parseFloat(value) || 0
    setDecentStandard({ ...decent, monthlyAmount: num })
    onClose()
  }

  function clear() {
    setDecentStandard({ ...decent, monthlyAmount: 0 })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 100, display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>设置体面标准</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
          预期退休后维持体面生活的月度开支。后续可拆分衣食住行。
        </div>
        <input type="number" placeholder="月目标开支（元），例如 10000"
          value={value} onChange={e => setValue(e.target.value)}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10,
            border: '1px solid #ddd', fontSize: 16, boxSizing: 'border-box', marginBottom: 12,
          }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#f0f0f0', cursor: 'pointer', fontWeight: 600 }}>
            取消
          </button>
          <button onClick={clear}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#fee', color: '#c0392b', cursor: 'pointer', fontWeight: 600 }}>
            清除
          </button>
          <button onClick={save}
            style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1a3a2a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
