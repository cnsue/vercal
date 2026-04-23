import { useRetirementStore } from '../../store/useRetirementStore'
import { PENSION_CITIES } from '../../data/pensionCities'

export default function PensionConfigCard() {
  const pension = useRetirementStore(s => s.plan.pension)
  const setPension = useRetirementStore(s => s.setPension)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #eee' }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>养老金信息</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
        用于「岁月」页的退休现金流预估。MVP 简化公式，精确值以当地人社局测算为准。
      </div>

      <Field label="缴费城市">
        <select value={pension.cityKey} onChange={e => setPension({ cityKey: e.target.value })} style={selectStyle}>
          {PENSION_CITIES.map(c => (
            <option key={c.key} value={c.key}>
              {c.name} · 社平工资 ¥{c.averageWage.toLocaleString()}/月
            </option>
          ))}
        </select>
      </Field>

      <Row>
        <Field label="当前年龄">
          <input type="number" value={pension.currentAge || ''}
            onChange={e => setPension({ currentAge: parseInt(e.target.value) || 0 })}
            style={inputStyle} />
        </Field>
        <Field label="预期退休年龄">
          <input type="number" value={pension.retirementAge || ''}
            onChange={e => setPension({ retirementAge: parseInt(e.target.value) || 60 })}
            style={inputStyle} />
        </Field>
      </Row>

      <Row>
        <Field label="已缴费年限">
          <input type="number" value={pension.yearsContributed || ''}
            onChange={e => setPension({ yearsContributed: parseFloat(e.target.value) || 0 })}
            style={inputStyle} />
        </Field>
        <Field label="计划继续缴费年限">
          <input type="number" value={pension.plannedFutureYears || ''}
            onChange={e => setPension({ plannedFutureYears: parseFloat(e.target.value) || 0 })}
            style={inputStyle} />
        </Field>
      </Row>

      <Field label={`平均缴费指数（0.6 – 3.0，当前 ${pension.averageContributionIndex.toFixed(2)}）`}>
        <input type="range" min="0.6" max="3.0" step="0.05"
          value={pension.averageContributionIndex}
          onChange={e => setPension({ averageContributionIndex: parseFloat(e.target.value) })}
          style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
          <span>0.6 最低档</span><span>1.0 社平</span><span>3.0 最高档</span>
        </div>
      </Field>

      <Field label="个人账户累计余额（元）">
        <input type="number" value={pension.personalAccountBalance || ''}
          onChange={e => setPension({ personalAccountBalance: parseFloat(e.target.value) || 0 })}
          placeholder="可在社保APP中查看"
          style={inputStyle} />
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8 }}>{children}</div>
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: '#fff', appearance: 'none',
}
