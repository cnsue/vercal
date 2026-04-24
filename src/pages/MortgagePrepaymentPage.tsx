import { useEffect, useMemo, useState } from 'react'
import { StorageService } from '../store/storage'
import {
  prepayLoan, computePaidMonths, formatMonths,
  DEFAULT_MORTGAGE_INPUTS, LPR_5Y, PF_RATE_5Y,
  LPR_PRESETS_BPS, PF_PRESETS_BPS,
  type MortgageInputs, type RepaymentMethod,
  type PrepaymentMode, type PrepayResult, type LoanType, type PrepayTarget,
} from '../utils/mortgageCalc'
import { formatCNY } from '../utils/formatters'

export default function MortgagePrepaymentPage() {
  const [inputs, setInputs] = useState<MortgageInputs>(() => StorageService.getMortgageInputs())

  useEffect(() => {
    const t = setTimeout(() => StorageService.saveMortgageInputs(inputs), 300)
    return () => clearTimeout(t)
  }, [inputs])

  const update = <K extends keyof MortgageInputs>(key: K, value: MortgageInputs[K]) =>
    setInputs(prev => ({ ...prev, [key]: value }))

  function resetDefaults() { setInputs(DEFAULT_MORTGAGE_INPUTS) }

  const paidMonths = useMemo(
    () => computePaidMonths(inputs.firstRepaymentDate),
    [inputs.firstRepaymentDate],
  )

  const commercialResult = useMemo<PrepayResult | null>(() => {
    if (inputs.loanType === 'providentFund') return null
    const amount = inputs.loanType === 'combined'
      ? (inputs.prepayTarget === 'commercial' ? inputs.prepaymentAmount : 0)
      : inputs.prepaymentAmount
    return prepayLoan(
      inputs.principal, inputs.years, inputs.annualRatePct, inputs.method,
      paidMonths, amount, inputs.prepaymentMode,
    )
  }, [inputs, paidMonths])

  const pfResult = useMemo<PrepayResult | null>(() => {
    if (inputs.loanType === 'commercial') return null
    const principal = inputs.loanType === 'combined' ? inputs.pfPrincipal : inputs.principal
    const years    = inputs.loanType === 'combined' ? inputs.pfYears     : inputs.years
    const rate     = inputs.loanType === 'combined' ? inputs.pfAnnualRatePct : inputs.annualRatePct
    const method   = inputs.loanType === 'combined' ? inputs.pfMethod    : inputs.method
    const amount   = inputs.loanType === 'combined'
      ? (inputs.prepayTarget === 'pf' ? inputs.prepaymentAmount : 0)
      : inputs.prepaymentAmount
    return prepayLoan(principal, years, rate, method, paidMonths, amount, inputs.prepaymentMode)
  }, [inputs, paidMonths])

  const commercialTotalMonths = Math.round(inputs.principal > 0 ? inputs.years * 12 : 0)
  const pfTotalMonths         = Math.round(inputs.pfYears * 12)

  const commercialOverflow = paidMonths > 0 && paidMonths >= commercialTotalMonths
  const pfOverflow         = paidMonths > 0 && paidMonths >= pfTotalMonths

  const isCommercial = inputs.loanType === 'commercial'
  const isPF         = inputs.loanType === 'providentFund'
  const isCombined   = inputs.loanType === 'combined'

  const prepayOverBalanceCommercial =
    commercialResult?.valid && inputs.prepaymentAmount > commercialResult.beforePrepay.remainingBalance
  const prepayOverBalancePF =
    pfResult?.valid && inputs.prepaymentAmount > pfResult.beforePrepay.remainingBalance

  function fillCommercialBalance() {
    if (commercialResult?.valid) {
      update('prepayTarget', 'commercial')
      update('prepaymentAmount', Math.ceil(commercialResult.beforePrepay.remainingBalance))
    }
  }

  const showResults = (commercialResult?.valid ?? false) || (pfResult?.valid ?? false)

  return (
    <div style={{ paddingTop: 4, paddingBottom: 20 }}>
      <Section title="贷款基本信息"
        right={
          <button onClick={resetDefaults}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
            重置为默认
          </button>
        }>
        <SegmentRow label="贷款类型" value={inputs.loanType}
          options={[
            { value: 'commercial',     label: '纯商贷' },
            { value: 'providentFund',  label: '纯公积金' },
            { value: 'combined',       label: '组合贷款' },
          ] satisfies { value: LoanType; label: string }[]}
          onChange={v => update('loanType', v)} />

        {/* 商业贷款 */}
        {(isCommercial || isCombined) && (
          <>
            {isCombined && <SubLabel>商业贷款</SubLabel>}
            <NumberRow label="贷款金额" unit="元" value={inputs.principal}
              onChange={v => update('principal', v)} step={10000} />
            <NumberRow label="贷款年限" unit="年" value={inputs.years}
              onChange={v => update('years', v)} step={1} max={50} />
            <RateRow
              label="年利率" value={inputs.annualRatePct}
              onChange={v => update('annualRatePct', v)}
              baseRate={LPR_5Y} presets={LPR_PRESETS_BPS as unknown as number[]}
              baseLabel="LPR 5Y" />
            <SegmentRow label="还款方式" value={inputs.method}
              options={[
                { value: 'epi', label: '等额本息' },
                { value: 'emp', label: '等额本金' },
              ] satisfies { value: RepaymentMethod; label: string }[]}
              onChange={v => update('method', v)} />
            {isCombined && commercialOverflow && (
              <Hint kind="warning">首次还款日期换算的已还月数已超过商贷总期数（{commercialTotalMonths} 月）</Hint>
            )}
          </>
        )}

        {/* 公积金贷款 */}
        {(isPF || isCombined) && (
          <>
            {isCombined && <SubLabel>公积金贷款</SubLabel>}
            <NumberRow label={isCombined ? '公积金金额' : '贷款金额'} unit="元"
              value={isCombined ? inputs.pfPrincipal : inputs.principal}
              onChange={v => isCombined ? update('pfPrincipal', v) : update('principal', v)} step={10000} />
            <NumberRow label={isCombined ? '公积金年限' : '贷款年限'} unit="年"
              value={isCombined ? inputs.pfYears : inputs.years}
              onChange={v => isCombined ? update('pfYears', v) : update('years', v)} step={1} max={30} />
            <RateRow
              label={isCombined ? '公积金利率' : '年利率'}
              value={isCombined ? inputs.pfAnnualRatePct : inputs.annualRatePct}
              onChange={v => isCombined ? update('pfAnnualRatePct', v) : update('annualRatePct', v)}
              baseRate={PF_RATE_5Y} presets={PF_PRESETS_BPS as unknown as number[]}
              baseLabel="公积金基准" />
            <SegmentRow label="还款方式"
              value={isCombined ? inputs.pfMethod : inputs.method}
              options={[
                { value: 'epi', label: '等额本息' },
                { value: 'emp', label: '等额本金' },
              ] satisfies { value: RepaymentMethod; label: string }[]}
              onChange={v => isCombined ? update('pfMethod', v) : update('method', v)} />
            {isCombined && pfOverflow && (
              <Hint kind="warning">首次还款日期换算的已还月数已超过公积金总期数（{pfTotalMonths} 月）</Hint>
            )}
          </>
        )}

        {/* 单贷款溢出提示 */}
        {!isCombined && isCommercial && commercialOverflow && (
          <Hint kind="warning">已还月数已超过贷款总期数（{commercialTotalMonths} 月），请检查首次还款日期</Hint>
        )}
        {!isCombined && isPF && pfOverflow && (
          <Hint kind="warning">已还月数已超过贷款总期数（{pfTotalMonths} 月），请检查首次还款日期</Hint>
        )}

        <DateMonthRow
          label="首次还款年月"
          value={inputs.firstRepaymentDate}
          onChange={v => update('firstRepaymentDate', v)}
          paidMonths={paidMonths} />
      </Section>

      <Section title="提前还款">
        {isCombined && (
          <>
            <SegmentRow label="还哪部分" value={inputs.prepayTarget}
              options={[
                { value: 'commercial', label: '商业贷款' },
                { value: 'pf',         label: '公积金' },
              ] satisfies { value: PrepayTarget; label: string }[]}
              onChange={v => update('prepayTarget', v)} />
            {inputs.prepayTarget === 'commercial' && commercialResult?.valid && (
              <div style={{ paddingBottom: 4 }}>
                <button onClick={fillCommercialBalance}
                  style={{
                    width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
                  }}>
                  一键填入商贷余额（{formatCNY(commercialResult.beforePrepay.remainingBalance)}）
                </button>
              </div>
            )}
          </>
        )}
        <NumberRow label="提前还款金额" unit="元" value={inputs.prepaymentAmount}
          onChange={v => update('prepaymentAmount', Math.max(0, v))} step={10000} />
        <SegmentRow label="还款后操作" value={inputs.prepaymentMode}
          options={[
            { value: 'shortenTerm',    label: '缩短年限' },
            { value: 'reduceMonthly',  label: '减少月供' },
          ] satisfies { value: PrepaymentMode; label: string }[]}
          onChange={v => update('prepaymentMode', v)} />
        {!isCombined && (
          <>
            {prepayOverBalanceCommercial && commercialResult?.valid && (
              <Hint kind="warning">
                预还金额已超过当前剩余本金（{formatCNY(commercialResult.beforePrepay.remainingBalance)}），将按全部还清计算。
              </Hint>
            )}
            {prepayOverBalancePF && pfResult?.valid && (
              <Hint kind="warning">
                预还金额已超过当前剩余本金（{formatCNY(pfResult.beforePrepay.remainingBalance)}），将按全部还清计算。
              </Hint>
            )}
          </>
        )}
      </Section>

      {showResults && (
        <ResultBlock
          loanType={inputs.loanType}
          prepayTarget={inputs.prepayTarget}
          commercialResult={commercialResult}
          pfResult={pfResult} />
      )}
    </div>
  )
}

/* -------- 结果展示 -------- */

function ResultBlock({ loanType, commercialResult, pfResult }: {
  loanType: LoanType
  prepayTarget: PrepayTarget
  commercialResult: PrepayResult | null
  pfResult: PrepayResult | null
}) {
  const isCombined = loanType === 'combined'

  const commercialInterestSaved = commercialResult?.valid ? commercialResult.savings.interestSaved : 0
  const pfInterestSaved         = pfResult?.valid         ? pfResult.savings.interestSaved         : 0
  const totalInterestSaved      = commercialInterestSaved + pfInterestSaved

  return (
    <>
      {commercialResult?.valid && (
        <SingleLoanResult result={commercialResult} label={isCombined ? '商业贷款' : undefined} />
      )}
      {pfResult?.valid && (
        <SingleLoanResult result={pfResult} label={isCombined ? '公积金' : undefined} />
      )}
      {isCombined && (commercialResult?.valid || pfResult?.valid) && (
        <Section title="组合贷款合计">
          {commercialResult?.valid && (
            <StatRow label="商贷剩余本金" value={formatCNY(commercialResult.beforePrepay.remainingBalance)} />
          )}
          {pfResult?.valid && (
            <StatRow label="公积金剩余本金" value={formatCNY(pfResult.beforePrepay.remainingBalance)} />
          )}
          {totalInterestSaved > 0 && (
            <>
              <div style={{ height: 6 }} />
              <StatRow label="本次提前还款节省利息" value={formatCNY(Math.max(0, totalInterestSaved))} accent="primary" />
            </>
          )}
        </Section>
      )}
      <div style={{ padding: '4px 4px 0', fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        月利率按年利率 ÷ 12 计算（中国房贷惯例）。LPR 基准参考 2024 年末报价，请以签约合同利率为准。
      </div>
    </>
  )
}

function SingleLoanResult({ result, label }: { result: PrepayResult; label?: string }) {
  const { original, paid, beforePrepay, afterPrepay, savings } = result
  const isEPI = original.method === 'epi'
  const prepayed = afterPrepay.actualPrepayment > 0
  const prefix = label ? `${label} · ` : ''

  return (
    <>
      <Section title={`${prefix}当前进度`}>
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
        <Section title={afterPrepay.settled ? `${prefix}提前还款后：已全部还清` : `${prefix}提前还款后`}>
          {afterPrepay.settled ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              预还金额已覆盖全部剩余本金，贷款结清。
            </div>
          ) : (
            <>
              {isEPI ? (
                <StatRow label="新月供" value={formatCNY(afterPrepay.newMonthlyPayment ?? 0)} accent />
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
    </>
  )
}

/* -------- UI 组件 -------- */

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em',
      textTransform: 'uppercase', padding: '10px 0 4px', borderTop: '1px solid var(--divider)', marginTop: 4 }}>
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

function RateRow({ label, value, onChange, baseRate, presets, baseLabel }: {
  label: string
  value: number
  onChange: (v: number) => void
  baseRate: number
  presets: number[]
  baseLabel: string
}) {
  const activeBps = presets.find(bp => Math.abs(Math.round((value - baseRate) * 100) - bp) < 1) ?? null

  return (
    <div>
      <NumberRow label={label} unit="%" value={value} onChange={onChange} step={0.05} precision={3} />
      <div style={{ paddingLeft: 0, paddingBottom: 6, paddingTop: 2 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
          参考 {baseLabel}：{baseRate}%
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {presets.map(bp => {
            const rate = Math.round((baseRate + bp / 100) * 1000) / 1000
            const active = activeBps === bp
            return (
              <button key={bp} onClick={() => onChange(rate)}
                style={{
                  padding: '4px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: active ? 700 : 400,
                  background: active ? 'var(--primary)' : 'var(--button-secondary-bg)',
                  color: active ? '#fff' : 'var(--button-secondary-text)',
                  lineHeight: 1.4,
                }}>
                {bp === 0 ? '基准' : `${bp > 0 ? '+' : ''}${bp}bp`}
                <br />
                <span style={{ opacity: 0.8 }}>{rate}%</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DateMonthRow({ label, value, onChange, paidMonths }: {
  label: string
  value: string
  onChange: (v: string) => void
  paidMonths: number
}) {
  const parts = value.match(/^(\d{4})-(\d{2})$/)
  const year  = parts ? parseInt(parts[1], 10) : new Date().getFullYear()
  const month = parts ? parseInt(parts[2], 10) : 1

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1999 }, (_, i) => 2000 + i)

  function setYear(y: number) {
    onChange(`${y}-${String(month).padStart(2, '0')}`)
  }
  function setMonth(m: number) {
    onChange(`${year}-${String(m).padStart(2, '0')}`)
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value, 10))} style={selectStyle}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>年</span>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value, 10))} style={selectStyle}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>月</span>
        </div>
      </div>
      {paidMonths > 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
          已还 {paidMonths} 月（{formatMonths(paidMonths)}）
        </div>
      )}
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
  const bg    = kind === 'warning' ? 'var(--warning-bg)'   : 'var(--surface-muted)'
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

const selectStyle: React.CSSProperties = {
  padding: '6px 8px', borderRadius: 8, border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14,
  fontFamily: 'inherit', cursor: 'pointer', appearance: 'none',
  WebkitAppearance: 'none', textAlign: 'center',
}
