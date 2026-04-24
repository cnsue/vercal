import { useEffect, useMemo, useState } from 'react'
import { StorageService } from '../store/storage'
import {
  prepay, formatMonths, DEFAULT_MORTGAGE_INPUTS,
  type MortgageInputs, type RepaymentMethod, type PrepaymentMode, type PrepayResult,
} from '../utils/mortgageCalc'
import { formatCNY } from '../utils/formatters'

interface Props {
  onBack: () => void
}

export default function MortgagePrepaymentPage({ onBack }: Props) {
  const [inputs, setInputs] = useState<MortgageInputs>(() => StorageService.getMortgageInputs())

  // Debounced persist
  useEffect(() => {
    const t = setTimeout(() => StorageService.saveMortgageInputs(inputs), 300)
    return () => clearTimeout(t)
  }, [inputs])

  const result = useMemo(() => prepay(inputs), [inputs])

  const update = <K extends keyof MortgageInputs>(key: K, value: MortgageInputs[K]) =>
    setInputs(prev => ({ ...prev, [key]: value }))

  function resetDefaults() {
    setInputs(DEFAULT_MORTGAGE_INPUTS)
  }

  const totalMonths = Math.round(inputs.years * 12)
  const paidOverflow = inputs.paidMonths >= totalMonths
  const prepayOverBalance = result.valid && inputs.prepaymentAmount > result.beforePrepay.remainingBalance

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 14px' }}>
        <button onClick={onBack} aria-label="返回"
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '4px 8px' }}>
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>房贷提前还款计算器</div>
        <button onClick={resetDefaults}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>
          重置
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
        <Section title="贷款基本信息">
          <NumberRow label="贷款金额" unit="元" value={inputs.principal}
            onChange={v => update('principal', v)} step={10000} />
          <NumberRow label="贷款年限" unit="年" value={inputs.years}
            onChange={v => update('years', v)} step={1} max={50} />
          <NumberRow label="年利率" unit="%" value={inputs.annualRatePct}
            onChange={v => update('annualRatePct', v)} step={0.05} precision={3} />
          <SegmentRow label="还款方式" value={inputs.method}
            options={[
              { value: 'epi', label: '等额本息' },
              { value: 'emp', label: '等额本金' },
            ] satisfies { value: RepaymentMethod; label: string }[]}
            onChange={v => update('method', v)} />
          <NumberRow label="已还月数" unit="月" value={inputs.paidMonths}
            onChange={v => update('paidMonths', Math.min(Math.max(0, Math.round(v)), totalMonths))}
            step={1} max={totalMonths} />
          {paidOverflow && (
            <Hint kind="warning">已还月数不能大于或等于贷款总月数（{totalMonths} 月）</Hint>
          )}
        </Section>

        <Section title="提前还款">
          <NumberRow label="提前还款金额" unit="元" value={inputs.prepaymentAmount}
            onChange={v => update('prepaymentAmount', Math.max(0, v))} step={10000} />
          <SegmentRow label="还款方式" value={inputs.prepaymentMode}
            options={[
              { value: 'shortenTerm', label: '缩短年限' },
              { value: 'reduceMonthly', label: '减少月供' },
            ] satisfies { value: PrepaymentMode; label: string }[]}
            onChange={v => update('prepaymentMode', v)} />
          {prepayOverBalance && (
            <Hint kind="warning">
              预还金额已超过当前剩余本金（{formatCNY(result.beforePrepay.remainingBalance)}），将按全部还清计算。
            </Hint>
          )}
        </Section>

        {result.valid && <ResultSections result={result} />}
      </div>
    </div>
  )
}

function ResultSections({ result }: { result: PrepayResult }) {
  const { original, paid, beforePrepay, afterPrepay, savings } = result
  const isEPI = original.method === 'epi'
  const prepayed = afterPrepay.actualPrepayment > 0

  return (
    <>
      <Section title="当前进度">
        {isEPI ? (
          <StatRow label="原方案月供" value={formatCNY(original.monthlyPayment ?? 0)} />
        ) : (
          <>
            <StatRow label="原方案首月月供" value={formatCNY(original.firstPayment ?? 0)} />
            <StatRow label="原方案末月月供" value={formatCNY(original.lastPayment ?? 0)} />
          </>
        )}
        <StatRow label="原方案总利息" value={formatCNY(original.totalInterest)} />
        <div style={{ height: 6 }} />
        <StatRow label="已还本金" value={formatCNY(paid.paidPrincipal)} />
        <StatRow label="已还利息" value={formatCNY(paid.paidInterest)} />
        <StatRow label="当前剩余本金" value={formatCNY(beforePrepay.remainingBalance)} accent />
      </Section>

      {prepayed && (
        <Section title={afterPrepay.settled ? '提前还款后：已全部还清' : '提前还款后'}>
          {afterPrepay.settled ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              预还金额已覆盖全部剩余本金，贷款结清。
            </div>
          ) : (
            <>
              {isEPI ? (
                <StatRow label="新月供"
                  value={formatCNY(afterPrepay.newMonthlyPayment ?? 0)}
                  accent />
              ) : (
                <>
                  <StatRow label="新首月月供" value={formatCNY(afterPrepay.newFirstPayment ?? 0)} accent />
                  <StatRow label="新末月月供" value={formatCNY(afterPrepay.newLastPayment ?? 0)} />
                </>
              )}
              <StatRow label="新剩余月数"
                value={`${afterPrepay.newRemainingMonths} 月（${formatMonths(afterPrepay.newRemainingMonths)}）`} />
              <StatRow label="后续应付利息" value={formatCNY(afterPrepay.remainingInterest)} />
            </>
          )}
          <div style={{ height: 10 }} />
          <StatRow label="节省利息"
            value={formatCNY(Math.max(0, savings.interestSaved))}
            accent="primary" />
          {savings.monthsShortened > 0 && (
            <StatRow label="缩短时间"
              value={`${savings.monthsShortened} 月（${formatMonths(savings.monthsShortened)}）`}
              accent="primary" />
          )}
        </Section>
      )}

      <div style={{ padding: '4px 4px 0', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        月利率按年利率 ÷ 12 计算（中国房贷惯例）。LPR 重定价、分段利率、组合贷联合建模不在本计算器范围内。
      </div>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean | 'primary' }) {
  const isPrimary = accent === 'primary' || accent === true
  const color = isPrimary ? 'var(--primary-strong)' : 'var(--text-strong)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: accent ? 800 : 600, color, fontSize: accent ? 15 : 13 }}>{value}</span>
    </div>
  )
}

function NumberRow({ label, unit, value, onChange, step, max, precision }: {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
  step: number
  max?: number
  precision?: number
}) {
  function commit(raw: string) {
    if (raw === '') { onChange(0); return }
    const n = parseFloat(raw)
    if (Number.isNaN(n)) return
    const clamped = max !== undefined ? Math.min(n, max) : n
    onChange(Math.max(0, clamped))
  }

  function bump(delta: number) {
    const n = (value || 0) + delta
    const clamped = max !== undefined ? Math.min(n, max) : n
    const next = Math.max(0, clamped)
    onChange(precision ? Math.round(next * 10 ** precision) / 10 ** precision : next)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{label}</div>
      <button onClick={() => bump(-step)} aria-label="减少" style={stepperStyle}>−</button>
      <input type="number" inputMode="decimal"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={e => commit(e.target.value)}
        style={{
          width: 110, padding: '8px 10px', borderRadius: 8,
          border: '1px solid var(--input-border)', background: 'var(--input-bg)',
          color: 'var(--text)', fontSize: 15, textAlign: 'right', boxSizing: 'border-box',
          fontFamily: 'inherit',
        }} />
      <span style={{ fontSize: 11, color: 'var(--muted)', width: 24, textAlign: 'left' }}>{unit}</span>
      <button onClick={() => bump(step)} aria-label="增加" style={stepperStyle}>+</button>
    </div>
  )
}

function SegmentRow<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(opt => {
          const active = opt.value === value
          return (
            <button key={opt.value} onClick={() => onChange(opt.value)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13,
                background: active ? 'var(--primary)' : 'var(--button-secondary-bg)',
                color: active ? '#fff' : 'var(--button-secondary-text)',
              }}>
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Hint({ kind, children }: { kind: 'warning' | 'info'; children: React.ReactNode }) {
  const bg = kind === 'warning' ? 'var(--warning-bg)' : 'var(--surface-muted)'
  const color = kind === 'warning' ? 'var(--warning-text)' : 'var(--muted)'
  return (
    <div style={{ marginTop: 8, padding: 10, background: bg, borderRadius: 8, fontSize: 12, color, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

const stepperStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: 'none',
  background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
  fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0, fontWeight: 700,
}
