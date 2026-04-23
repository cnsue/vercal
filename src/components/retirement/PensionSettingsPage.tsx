import { useMemo } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'
import { PENSION_CITIES } from '../../data/pensionCities'
import { computePensionProjection, getMinimumContributionMonths } from '../../utils/retirementCalc'
import { formatCNY } from '../../utils/formatters'
import type { Gender, PensionConfig } from '../../types/retirement'
import { GENDER_LABELS } from '../../types/retirement'

interface Props {
  onBack: () => void
}

/**
 * 养老金信息独立设置页。
 * 用户在设置页点"养老金信息"进来，填完即时看到预估退休年月 & 月养老金。
 */
export default function PensionSettingsPage({ onBack }: Props) {
  const pension = useRetirementStore(s => s.plan.pension)
  const setPension = useRetirementStore(s => s.setPension)

  const projection = useMemo(() => computePensionProjection(pension), [pension])

  // 年份选择范围：1940 - 当前年
  const thisYear = new Date().getFullYear()

  const totalMonths = pension.monthsContributed + pension.plannedFutureMonths
  const retirementYear = parseInt(projection.retirementYearMonth.split('-')[0]) || thisYear
  const minMonths = getMinimumContributionMonths(retirementYear)
  const belowMinimum = totalMonths < minMonths
  const earlyRetire = pension.retirementOffsetMonths < 0
  const shortfallMonths = Math.max(minMonths - totalMonths, 0)
  const minYearsLabel = minMonths % 12 === 0 ? `${minMonths / 12}` : `${(minMonths / 12).toFixed(1)}`
  const birthYears = useMemo(() => {
    const arr: number[] = []
    for (let y = thisYear; y >= 1940; y--) arr.push(y)
    return arr
  }, [thisYear])

  // 缴费月数转 年 + 月 选项
  const yearsFromMonths = (m: number) => Math.floor(m / 12)
  const monthsFromMonths = (m: number) => m % 12
  const setMonths = (key: 'monthsContributed' | 'plannedFutureMonths', years: number, months: number) => {
    setPension({ [key]: years * 12 + months } as Partial<PensionConfig>)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 14px' }}>
        <button onClick={onBack} aria-label="返回"
          style={{ background: 'none', border: 'none', color: '#1a3a2a', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '4px 8px' }}>
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>养老金信息</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
        {/* 推算结果 */}
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>推算结果（实时）</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Stat label="标准退休" value={`${projection.standardRetirement.years} 岁 ${projection.standardRetirement.months} 月`} />
            <Stat label="实际退休" value={`${projection.actualRetirementYears} 岁 ${projection.actualRetirementExtraMonths} 月`} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Stat label="退休年月" value={projection.retirementYearMonth} />
            <Stat label="还剩" value={`${projection.yearsToRetire.toFixed(1)} 年`} />
          </div>
          <div style={{ marginTop: 12, padding: 10, background: '#f0f9f5', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>预计月养老金（按现参数）</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#166c3b', marginTop: 2 }}>
              {projection.valid ? formatCNY(projection.monthlyTotal) : '需录入缴费月数'}
            </div>
            {projection.valid && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                基础 {formatCNY(projection.basicPension)} + 个人账户 {formatCNY(projection.personalAccountPension)}
              </div>
            )}
          </div>

          {belowMinimum && (
            <div style={{
              marginTop: 10, padding: 10, background: '#fee8d6', borderRadius: 8,
              fontSize: 12, color: '#8a4b1a', lineHeight: 1.6,
              border: '1px solid #f3c78a',
            }}>
              ⚠️ {earlyRetire
                ? `弹性提前退休要求累计缴费至少 ${minYearsLabel} 年（${minMonths} 月）`
                : `累计缴费不足 ${minYearsLabel} 年，将无法正常领取基本养老金`}
              <div style={{ marginTop: 4, color: '#a86a2d' }}>
                当前已缴 + 计划继续合计 <strong>{totalMonths}</strong> 月（{Math.floor(totalMonths / 12)} 年 {totalMonths % 12} 月），
                还差 <strong>{shortfallMonths}</strong> 月（{Math.floor(shortfallMonths / 12)} 年 {shortfallMonths % 12} 月）
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#a86a2d' }}>
                依据 2024 年 9 月《国务院渐进式延迟退休办法》附件二：
                {retirementYear < 2030
                  ? `${retirementYear} 年退休适用 15 年门槛；2030 起每年 +6 月，2039 达 20 年`
                  : retirementYear >= 2039
                    ? `${retirementYear} 年退休已进入 20 年最终档位`
                    : `${retirementYear} 年退休最低缴费 ${minYearsLabel} 年（2030 起每年 +6 月过渡至 20 年）`}
              </div>
            </div>
          )}
        </Card>

        {/* 个人信息 */}
        <Card title="个人信息">
          <Field label="性别 / 身份">
            <select value={pension.gender} onChange={e => setPension({ gender: e.target.value as Gender })} style={selectStyle}>
              {(Object.keys(GENDER_LABELS) as Gender[]).map(g => (
                <option key={g} value={g}>{GENDER_LABELS[g]}</option>
              ))}
            </select>
          </Field>
          <Row>
            <Field label="出生年">
              <select value={pension.birthYear} onChange={e => setPension({ birthYear: parseInt(e.target.value) })} style={selectStyle}>
                {birthYears.map(y => <option key={y} value={y}>{y} 年</option>)}
              </select>
            </Field>
            <Field label="出生月">
              <select value={pension.birthMonth} onChange={e => setPension({ birthMonth: parseInt(e.target.value) })} style={selectStyle}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m} 月</option>
                ))}
              </select>
            </Field>
          </Row>
          <Field label="弹性退休偏移">
            <select value={pension.retirementOffsetMonths}
              onChange={e => setPension({ retirementOffsetMonths: parseInt(e.target.value) })}
              style={selectStyle}>
              {RETIREMENT_OFFSET_OPTIONS.map(m => (
                <option key={m} value={m}>{formatOffset(m)}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
              2025 弹性退休政策允许在标准退休年龄 ±3 年内自选
            </div>
          </Field>
        </Card>

        {/* 缴费信息 */}
        <Card title="缴费信息">
          <Field label="缴费城市">
            <select value={pension.cityKey} onChange={e => setPension({ cityKey: e.target.value })} style={selectStyle}>
              {PENSION_CITIES.map(c => (
                <option key={c.key} value={c.key}>
                  {c.name} · 社平 ¥{c.averageWage.toLocaleString()}/月
                </option>
              ))}
            </select>
          </Field>

          <Field label={`已缴费时长：${yearsFromMonths(pension.monthsContributed)} 年 ${monthsFromMonths(pension.monthsContributed)} 月`}>
            <Row>
              <select value={yearsFromMonths(pension.monthsContributed)}
                onChange={e => setMonths('monthsContributed', parseInt(e.target.value), monthsFromMonths(pension.monthsContributed))}
                style={selectStyle}>
                {Array.from({ length: 51 }, (_, i) => i).map(y => <option key={y} value={y}>{y} 年</option>)}
              </select>
              <select value={monthsFromMonths(pension.monthsContributed)}
                onChange={e => setMonths('monthsContributed', yearsFromMonths(pension.monthsContributed), parseInt(e.target.value))}
                style={selectStyle}>
                {Array.from({ length: 12 }, (_, i) => i).map(m => <option key={m} value={m}>{m} 月</option>)}
              </select>
            </Row>
          </Field>

          <Field label={`计划继续缴费：${yearsFromMonths(pension.plannedFutureMonths)} 年 ${monthsFromMonths(pension.plannedFutureMonths)} 月`}>
            <Row>
              <select value={yearsFromMonths(pension.plannedFutureMonths)}
                onChange={e => setMonths('plannedFutureMonths', parseInt(e.target.value), monthsFromMonths(pension.plannedFutureMonths))}
                style={selectStyle}>
                {Array.from({ length: 51 }, (_, i) => i).map(y => <option key={y} value={y}>{y} 年</option>)}
              </select>
              <select value={monthsFromMonths(pension.plannedFutureMonths)}
                onChange={e => setMonths('plannedFutureMonths', yearsFromMonths(pension.plannedFutureMonths), parseInt(e.target.value))}
                style={selectStyle}>
                {Array.from({ length: 12 }, (_, i) => i).map(m => <option key={m} value={m}>{m} 月</option>)}
              </select>
            </Row>
          </Field>
        </Card>

        {/* 缴费指数 */}
        <Card title="缴费指数">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
            缴费指数 = 本人缴费工资 ÷ 当地社平工资。0.6 为最低档，1.0 为社平，3.0 为最高档。
            加权平均指数将用于养老金公式。
          </div>
          <Field label="已缴费期间平均指数">
            <select value={pension.historicalIndex.toFixed(2)}
              onChange={e => setPension({ historicalIndex: parseFloat(e.target.value) })}
              style={selectStyle}>
              {INDEX_OPTIONS.map(v => (
                <option key={v.value} value={v.value.toFixed(2)}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field label="未来期望平均指数">
            <select value={pension.futureIndex.toFixed(2)}
              onChange={e => setPension({ futureIndex: parseFloat(e.target.value) })}
              style={selectStyle}>
              {INDEX_OPTIONS.map(v => (
                <option key={v.value} value={v.value.toFixed(2)}>{v.label}</option>
              ))}
            </select>
          </Field>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
            当前加权平均：<strong style={{ color: '#1a3a2a' }}>{projection.weightedIndex.toFixed(2)}</strong>
          </div>
        </Card>

        {/* 个人账户 */}
        <Card title="个人账户">
          <Field label="个人账户累计余额（元）">
            <input type="number" inputMode="decimal"
              value={pension.personalAccountBalance || ''}
              onChange={e => setPension({ personalAccountBalance: parseFloat(e.target.value) || 0 })}
              placeholder="可在社保 APP 中查看" style={inputStyle} />
          </Field>
        </Card>

        <div style={{ marginTop: 10, padding: 10, background: '#fff7ed', borderRadius: 8, fontSize: 11, color: '#8a4b1a', lineHeight: 1.6 }}>
          MVP 简化公式：渐进式退休按 2025 政策粗略推算；未纳入过渡性养老金、地方性补贴、缴费基数上下限等。精确数额以当地人社局测算为准。
        </div>
      </div>
    </div>
  )
}

function formatOffset(months: number): string {
  if (months === 0) return '标准'
  const prefix = months > 0 ? '延后' : '提前'
  const abs = Math.abs(months)
  const y = Math.floor(abs / 12)
  const m = abs % 12
  const parts: string[] = []
  if (y > 0) parts.push(`${y} 年`)
  if (m > 0) parts.push(`${m} 月`)
  return `${prefix} ${parts.join('')}`
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid #eee' }}>
      {title && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{title}</div>}
      {children}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = {
  ...inputStyle, background: '#fff', flex: 1,
}

/** 弹性退休：每半年一档，上下限 ±3 年（2025 政策） */
const RETIREMENT_OFFSET_OPTIONS: number[] = [
  -36, -30, -24, -18, -12, -6, 0, 6, 12, 18, 24, 30, 36,
]

/** 缴费指数档位：常见档 60%/80%/100%/150%/200%/300% 再补中间几档 */
const INDEX_OPTIONS: { value: number; label: string }[] = [
  { value: 0.6, label: '0.60（最低档 60%）' },
  { value: 0.7, label: '0.70' },
  { value: 0.8, label: '0.80（80% 档）' },
  { value: 0.9, label: '0.90' },
  { value: 1.0, label: '1.00（社平 100%）' },
  { value: 1.2, label: '1.20' },
  { value: 1.5, label: '1.50（150% 档）' },
  { value: 1.8, label: '1.80' },
  { value: 2.0, label: '2.00（200% 档）' },
  { value: 2.5, label: '2.50' },
  { value: 3.0, label: '3.00（最高档 300%）' },
]
