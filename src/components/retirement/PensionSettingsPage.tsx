import { useEffect, useMemo, useState } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'
import { PENSION_CITIES } from '../../data/pensionCities'
import {
  computePensionProjection, contributionMonthsUntil,
  getMinimumContributionMonths,
} from '../../utils/retirementCalc'
import { formatCNY } from '../../utils/formatters'
import type { Gender } from '../../types/retirement'
import { GENDER_LABELS } from '../../types/retirement'

interface Props {
  onBack: () => void
}

/**
 * 养老金信息独立设置页。
 * 用户在设置页点"养老金信息"进来，填完即时看到预估退休年月 & 月养老金，
 * 底部粘性"保存并返回"按钮。
 */
export default function PensionSettingsPage({ onBack }: Props) {
  const pension = useRetirementStore(s => s.plan.pension)
  const setPension = useRetirementStore(s => s.setPension)

  const projection = useMemo(() => computePensionProjection(pension), [pension])

  const thisYear = new Date().getFullYear()
  const totalMonths = pension.monthsContributed + projection.plannedFutureMonths
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

  /* ---- 实际退休年月：Select，只展示合法区间（std ± 36 月） ---- */
  const std = projection.standardRetirement
  const stdIdx = pension.birthYear * 12 + (pension.birthMonth - 1) + std.totalMonths
  const retirementOptions = useMemo(() => {
    const arr: { value: number; label: string }[] = []
    for (let offset = -36; offset <= 36; offset++) {
      const idx = stdIdx + offset
      const y = Math.floor(idx / 12)
      const m = (idx % 12) + 1
      const prefix = offset === 0 ? '标准' : formatOffset(offset)
      arr.push({
        value: offset,
        label: `${y}-${String(m).padStart(2, '0')} · ${prefix}`,
      })
    }
    return arr
  }, [stdIdx])

  /* ---- 计划停止缴费：固定预设选项 ---- */
  const [retirementYearOpt, retirementMonthOpt] = projection.retirementYearMonth.split('-').map(v => parseInt(v, 10))
  const retirementContributionMonths = contributionMonthsUntil(retirementYearOpt, retirementMonthOpt)
  const stopPresets = useMemo(() => {
    const presetYears = [0, 5, 10, 15, 20, 25, 30]
    const items: { key: string; label: string; months: number }[] = []
    items.push({ key: 'retirement', label: '直到退休', months: retirementContributionMonths })
    for (const yr of presetYears) {
      const months = yr * 12
      if (months > retirementContributionMonths) break // 超过退休就不再列出
      items.push({
        key: String(yr),
        label: yr === 0 ? '现在停缴' : `再缴 ${yr} 年`,
        months,
      })
    }
    return items
  }, [retirementContributionMonths])

  // 当前选项：以月数吻合度匹配（允许 ±3 月误差），否则"自定义"
  const currentStopMonths = contributionMonthsUntil(pension.plannedStopYear, pension.plannedStopMonth)
  const currentStopKey = (() => {
    // 与退休月差在 3 月内视为"直到退休"
    if (Math.abs(currentStopMonths - retirementContributionMonths) <= 3) return 'retirement'
    for (const p of stopPresets) {
      if (p.key === 'retirement') continue
      if (Math.abs(p.months - currentStopMonths) <= 3) return p.key
    }
    return 'custom'
  })()

  function onStopPresetChange(v: string) {
    if (v === 'custom') return
    const preset = stopPresets.find(p => p.key === v)
    if (!preset) return
    if (preset.key === 'retirement') {
      setPension({
        plannedStopYear: retirementYearOpt,
        plannedStopMonth: retirementMonthOpt,
      })
      return
    }
    const now = new Date()
    const idx = now.getFullYear() * 12 + now.getMonth() + Math.max(preset.months - 1, 0)
    setPension({
      plannedStopYear: Math.floor(idx / 12),
      plannedStopMonth: (idx % 12) + 1,
    })
  }

  const city = PENSION_CITIES.find(c => c.key === pension.cityKey)
  const baseAverageWage = pension.averageWageOverride && pension.averageWageOverride > 0
    ? pension.averageWageOverride
    : city?.averageWage ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 14px' }}>
        <button onClick={onBack} aria-label="返回"
          style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '4px 8px' }}>
          ‹
        </button>
        <div style={{ fontSize: 16, fontWeight: 800 }}>养老金信息</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {/* 推算结果 */}
        <Card>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>推算结果（实时）</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Stat label="标准退休" value={`${std.years} 岁 ${std.months} 月`} />
            <Stat label="实际退休" value={`${projection.actualRetirementYears} 岁 ${projection.actualRetirementExtraMonths} 月`} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <Stat label="退休年月" value={projection.retirementYearMonth} />
            <Stat label="还剩" value={`${projection.yearsToRetire.toFixed(1)} 年`} />
          </div>
          <div style={{ marginTop: 12, padding: 10, background: 'var(--primary-soft)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>预计月养老金（今日购买力）</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-text)', marginTop: 2 }}>
              {projection.valid ? formatCNY(projection.monthlyTotal) : '需录入缴费月数'}
            </div>
            {projection.valid && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                基础 {formatCNY(projection.basicPension)} + 个人账户 {formatCNY(projection.personalAccountPension)}
                （计发月数 {projection.personalAccountPayoutMonths.toFixed(1)}）
              </div>
            )}
          </div>

          {belowMinimum && (
            <div style={{
              marginTop: 10, padding: 10, background: 'var(--warning-bg)', borderRadius: 8,
              fontSize: 12, color: 'var(--warning-text)', lineHeight: 1.6,
              border: '1px solid var(--warning-border-strong)',
            }}>
              ⚠️ {earlyRetire
                ? `弹性提前退休要求累计缴费至少 ${minYearsLabel} 年（${minMonths} 月）`
                : `累计缴费不足 ${minYearsLabel} 年，将无法正常领取基本养老金`}
              <div style={{ marginTop: 4, color: 'var(--warning-text-strong)' }}>
                当前已缴 + 计划继续合计 <strong>{totalMonths}</strong> 月（{Math.floor(totalMonths / 12)} 年 {totalMonths % 12} 月），
                还差 <strong>{shortfallMonths}</strong> 月（{Math.floor(shortfallMonths / 12)} 年 {shortfallMonths % 12} 月）
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--warning-text-strong)' }}>
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
          <Field label="实际退休年月">
            <select value={pension.retirementOffsetMonths}
              onChange={e => setPension({ retirementOffsetMonths: parseInt(e.target.value) })}
              style={selectStyle}>
              {retirementOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
              仅合法区间内可选（2025 弹性退休政策标准 ±3 年）
            </div>
          </Field>
        </Card>

        {/* 缴费信息 */}
        <Card title="缴费信息">
          <Field label="缴费城市">
            <select value={pension.cityKey} onChange={e => setPension({ cityKey: e.target.value })} style={selectStyle}>
              {PENSION_CITIES.map(c => (
                <option key={c.key} value={c.key}>
                  {c.name} · 内置社平 ¥{c.averageWage.toLocaleString()}/月
                </option>
              ))}
            </select>
          </Field>

          <Field label="当前社平工资 / 计发基数（元/月）">
            <input type="number" inputMode="decimal"
              min={0}
              value={pension.averageWageOverride ?? ''}
              placeholder={`默认使用内置值：${city?.averageWage.toLocaleString() ?? '-'}`}
              onChange={e => {
                const n = parseFloat(e.target.value)
                setPension({ averageWageOverride: Number.isFinite(n) && n > 0 ? n : undefined })
              }}
              style={inputStyle} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
              当前计算使用 <strong>¥{Math.round(baseAverageWage).toLocaleString()}</strong>/月。浙江 2025 年官方口径为 8433 元/月；退休当年社平会按下方增长率继续外推。
            </div>
          </Field>

          <Field label="已缴费月数">
            <input type="number" inputMode="numeric"
              min={0} max={600}
              value={pension.monthsContributed || ''}
              placeholder="输入月数，例如 180"
              onChange={e => {
                const n = parseInt(e.target.value, 10)
                setPension({ monthsContributed: isNaN(n) ? 0 : Math.max(0, Math.min(n, 600)) })
              }}
              style={inputStyle} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              即 <strong>{Math.floor(pension.monthsContributed / 12)}</strong> 年
              <strong> {pension.monthsContributed % 12}</strong> 月
            </div>
          </Field>

          <Field label="计划停止缴费">
            <select value={currentStopKey}
              onChange={e => onStopPresetChange(e.target.value)}
              style={selectStyle}>
              {stopPresets.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}{p.months > 0 && p.key !== 'retirement' ? ` · 约 ${p.months} 月` : ''}
                </option>
              ))}
              {currentStopKey === 'custom' && (
                <option value="custom">
                  自定义：{pension.plannedStopYear}-{String(pension.plannedStopMonth).padStart(2, '0')}
                </option>
              )}
            </select>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              从今起还将缴费约 <strong>{projection.plannedFutureMonths}</strong> 月
              （{Math.floor(projection.plannedFutureMonths / 12)} 年 {projection.plannedFutureMonths % 12} 月）
            </div>
          </Field>
        </Card>

        {/* 缴费指数 */}
        <Card title="缴费指数">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
            缴费指数 = 本人缴费工资 ÷ 当地社平工资。0.6 最低、1.0 社平、3.0 最高。
            全程指数按月数加权平均，实时更新。
          </div>
          <Field label="已缴费期间平均指数">
            <input type="number" inputMode="decimal"
              min={0.6} max={3} step={0.0001}
              value={pension.historicalIndex}
              onChange={e => {
                const n = parseFloat(e.target.value)
                setPension({ historicalIndex: Number.isFinite(n) ? Math.max(0.6, Math.min(n, 3)) : 1 })
              }}
              style={inputStyle} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
              可填官方系统返回的精确值，例如 2.65245；不知道时用下方常见档位参考。
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {INDEX_OPTIONS.map(v => (
                <button key={v.value} type="button" onClick={() => setPension({ historicalIndex: v.value })}
                  style={{
                    padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)',
                    background: Math.abs(pension.historicalIndex - v.value) < 0.0001 ? 'var(--primary)' : 'var(--surface)',
                    color: Math.abs(pension.historicalIndex - v.value) < 0.0001 ? '#fff' : 'var(--text-soft)',
                    fontSize: 11, cursor: 'pointer',
                  }}>
                  {v.value.toFixed(2)}
                </button>
              ))}
            </div>
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
          <div style={{
            marginTop: 8, padding: 10, background: 'var(--surface-muted)', borderRadius: 8,
            fontSize: 12, color: 'var(--button-secondary-text)', lineHeight: 1.7,
          }}>
            <div style={{ color: 'var(--muted)', marginBottom: 4, fontSize: 11 }}>全程指数（加权平均）</div>
            <div>
              <strong>{pension.historicalIndex.toFixed(5)}</strong> × {pension.monthsContributed} 月 ＋{' '}
              <strong>{pension.futureIndex.toFixed(2)}</strong> × {projection.plannedFutureMonths} 月
            </div>
            <div style={{ marginTop: 4 }}>
              ÷ {totalMonths} 月 = <strong style={{ color: 'var(--primary)', fontSize: 15 }}>{projection.weightedIndex.toFixed(4)}</strong>
            </div>
          </div>
        </Card>

        {/* 可选参数 */}
        <Card title="可选参数">
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>
            默认与人社部"退休待遇测算器"一致。调整后推算结果立即更新。
          </div>
          <Field label="在岗职工平均工资增长率（%/年）">
            <Stepper
              value={pension.socialWageGrowthRate * 100}
              step={1}
              min={-5}
              max={15}
              onChange={v => setPension({ socialWageGrowthRate: v / 100 })}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              例如官方测算用 1.00% 时，8433 元/月会按年增长外推到退休当年。
            </div>
          </Field>
          <Field label="个人账户记账利率（%/年）">
            <Stepper
              value={pension.personalAccountRate * 100}
              step={1}
              min={0}
              max={10}
              onChange={v => setPension({ personalAccountRate: v / 100 })}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              人社部公布：近五年 2.62% - 4.17%（2024 年为 2.62%）。
            </div>
          </Field>
        </Card>

        {/* 个人账户 */}
        <Card title="个人账户">
          <Field label="个人账户累计余额（元）">
            <input type="number" inputMode="decimal"
              value={pension.personalAccountBalance || ''}
              onChange={e => setPension({ personalAccountBalance: parseFloat(e.target.value) || 0 })}
              placeholder="可在社保 APP 中查看" style={inputStyle} />
          </Field>
          {projection.valid && (
            <div style={{
              marginTop: 6, padding: 10, background: 'var(--surface-muted)', borderRadius: 8,
              fontSize: 11, color: 'var(--muted)', lineHeight: 1.6,
            }}>
              当前缴费基数 ≈ ¥{Math.round(baseAverageWage * pension.futureIndex).toLocaleString()}，
              月划入 ≈ ¥{Math.round(baseAverageWage * pension.futureIndex * 0.08).toLocaleString()} (基数×8%)。
              <br />
              退休时余额按记账利率 {(pension.personalAccountRate * 100).toFixed(2)}% 复利估算为{' '}
              <strong style={{ color: 'var(--primary)' }}>¥{Math.round(projection.projectedPersonalBalance).toLocaleString()}</strong>。
            </div>
          )}
        </Card>

        <div style={{ marginTop: 6, padding: 10, background: 'var(--warning-bg)', borderRadius: 8, fontSize: 11, color: 'var(--warning-text)', lineHeight: 1.6 }}>
          公式与人社部"退休待遇测算器"一致：基础养老金用全程加权指数；个人账户按记账利率复利 + 未来缴费 FV 年金。
          未纳入过渡性养老金、地方性补贴、缴费基数上下限等，精确数额以人社局测算为准。
        </div>
      </div>

      {/* 底部粘性保存按钮 */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: 12, background: 'var(--surface)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--muted)' }}>
          ✓ 改动已自动保存到本地
        </div>
        <button onClick={onBack}
          style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            padding: '10px 22px', borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
          保存并返回
        </button>
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
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid var(--border)' }}>
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

function Stepper({ value, step, min, max, onChange }: {
  value: number
  step: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(formatStepperValue(value))

  useEffect(() => {
    setDraft(formatStepperValue(value))
  }, [value])

  function clamp(v: number) {
    return Math.max(min, Math.min(max, Math.round(v * 100) / 100))
  }
  function commit(raw: string) {
    const n = parseFloat(raw)
    if (!Number.isFinite(n)) {
      setDraft(formatStepperValue(value))
      return
    }
    const next = clamp(n)
    setDraft(formatStepperValue(next))
    onChange(next)
  }
  function adjust(nextValue: number) {
    const next = clamp(nextValue)
    setDraft(formatStepperValue(next))
    onChange(next)
  }
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'stretch',
      border: '1px solid var(--input-border)', borderRadius: 8, overflow: 'hidden',
      background: 'var(--input-bg)',
    }}>
      <button type="button"
        onClick={() => adjust(value - step)}
        disabled={value <= min}
        style={stepBtnStyle}>−</button>
      <input type="number" inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={0.01}
        onChange={e => setDraft(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
        }}
        style={{
          width: 96, padding: '10px 14px', textAlign: 'center',
          fontSize: 15, fontWeight: 700, borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
          borderTop: 'none', borderBottom: 'none', borderRadius: 0,
          outline: 'none', fontFamily: 'inherit',
        }} />
      <button type="button"
        onClick={() => adjust(value + step)}
        disabled={value >= max}
        style={stepBtnStyle}>+</button>
    </div>
  )
}

function formatStepperValue(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : ''
}

const stepBtnStyle: React.CSSProperties = {
  width: 40, padding: 0, background: 'var(--input-bg)', border: 'none',
  color: 'var(--primary)', fontSize: 18, fontWeight: 700, cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = {
  ...inputStyle, background: 'var(--input-bg)', flex: 1,
}

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
