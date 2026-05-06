import { forwardRef } from 'react'
import type { DimensionCoverage } from '../../utils/retirementCalc'
import type { DividendHolding, CoverageLevel, FamilySize, CityTier } from '../../types/retirement'
import { computeHoldingIncome } from '../../utils/retirementCalc'
import { findDividendStock } from '../../data/dividendStocks'
import {
  COVERAGE_LEVELS, BUDGET_PRESETS_FAMILY3_TIER1,
  CITY_DIM_MULTIPLIERS, FAMILY_SIZE_MULTIPLIER, CITY_TIER_LABELS, FAMILY_SIZE_LABELS,
  getCoverageLevel,
} from '../../types/retirement'

interface IncomeSplit {
  dividend: number
  pension: number
  other: number
}

export interface CoverageShareCardProps {
  ratio: number
  modeLabel: string
  decentMonthly: number
  familySize?: FamilySize
  cityTier?: CityTier
  income: IncomeSplit
  holdings: DividendHolding[]
  dimensions: DimensionCoverage[]
}

const LEVEL_ORDER: CoverageLevel['key'][] = ['subsistence', 'stable', 'decent', 'comfortable', 'fulfilled']

/** 给定家庭规模 + 城市等级，计算各档预算合计 */
function presetTotals(family: FamilySize, city: CityTier): Record<CoverageLevel['key'], number> {
  const fMul = FAMILY_SIZE_MULTIPLIER[family]
  const dimMul = CITY_DIM_MULTIPLIERS[city]
  const out = {} as Record<CoverageLevel['key'], number>
  for (const lvl of LEVEL_ORDER) {
    const base = BUDGET_PRESETS_FAMILY3_TIER1[lvl]
    let sum = 0
    for (const dim of Object.keys(base)) {
      sum += base[dim] * fMul * (dimMul[dim] ?? 1)
    }
    out[lvl] = sum
  }
  return out
}

function classifyTargetLevel(monthly: number, totals: Record<CoverageLevel['key'], number>): CoverageLevel | null {
  if (monthly <= 0) return null
  let bestKey: CoverageLevel['key'] = LEVEL_ORDER[0]
  let bestDist = Infinity
  for (const key of LEVEL_ORDER) {
    const dist = Math.abs(totals[key] - monthly)
    if (dist < bestDist) {
      bestDist = dist
      bestKey = key
    }
  }
  return COVERAGE_LEVELS.find(l => l.key === bestKey) ?? null
}

/** 档位对应的月度区间字符串（基于已知 totals） */
function targetLevelBand(level: CoverageLevel, totals: Record<CoverageLevel['key'], number>): string {
  const idx = LEVEL_ORDER.indexOf(level.key)
  const lo = idx > 0 ? (totals[LEVEL_ORDER[idx - 1]] + totals[level.key]) / 2 : 0
  const hi = idx < LEVEL_ORDER.length - 1 ? (totals[level.key] + totals[LEVEL_ORDER[idx + 1]]) / 2 : Infinity
  const fmt = (n: number) => {
    const w = n / 10000
    return w >= 10 ? `${w.toFixed(0)}w` : `${w.toFixed(1)}w`
  }
  if (idx === 0) return `≤ ${fmt(hi)}/月`
  if (idx === LEVEL_ORDER.length - 1) return `≥ ${fmt(lo)}/月`
  return `${fmt(lo)}–${fmt(hi)}/月`
}

const CARD_WIDTH = 720
const HOLDING_LIMIT = 8

const CoverageShareCard = forwardRef<HTMLDivElement, CoverageShareCardProps>(
  function CoverageShareCard(props, ref) {
    const { ratio, modeLabel, decentMonthly, familySize, cityTier, income, holdings, dimensions } = props
    const coverageLevel = getCoverageLevel(ratio)
    const ratioPct = Math.round(ratio * 100)

    const baselineKnown = !!(familySize && cityTier)
    const totals = baselineKnown
      ? presetTotals(familySize!, cityTier!)
      : presetTotals('family3', 'tier1')
    const targetLevel = classifyTargetLevel(decentMonthly, totals)
    const baselineLabel = baselineKnown
      ? `${CITY_TIER_LABELS[cityTier!]}城市 · ${FAMILY_SIZE_LABELS[familySize!]}家庭`
      : '一线城市 · 三口家庭（默认对标）'
    const incomeRows = buildIncomeRows(income)
    const holdingRows = buildHoldingRows(holdings)

    return (
      <div
        ref={ref}
        style={{
          width: CARD_WIDTH,
          background: '#fafaf7',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
          color: '#1c1c1c',
        }}
      >
        {/* Body */}
        <div style={{ padding: '36px 36px 32px' }}>
          {/* Target tier vs current coverage */}
          {targetLevel && (
            <Section title="🎯 体面目标 vs 当前覆盖">
              <div style={{
                background: '#f4f1e8', borderLeft: `4px solid ${targetLevel.color}`,
                borderRadius: 6, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: 1 }}>
                  我设的目标
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: targetLevel.color, lineHeight: 1.2, marginTop: 4 }}>
                  {targetLevel.emoji} {targetLevel.label}
                  <span style={{ fontSize: 14, color: '#555', fontWeight: 600, marginLeft: 8 }}>
                    · {targetLevel.slogan}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#777', marginTop: 6, lineHeight: 1.5 }}>
                  对标基线：{baselineLabel} ≈ {targetLevelBand(targetLevel, totals)}
                </div>

                <div style={{ height: 1, background: '#e2dfd2', margin: '14px 0' }} />

                <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: 1 }}>
                  {modeLabel}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: coverageLevel?.color ?? '#888', lineHeight: 1.2, marginTop: 4 }}>
                  {coverageLevel ? `${coverageLevel.emoji} ${coverageLevel.label}` : '🏚️ 未达温饱'}
                  <span style={{ fontSize: 14, color: '#555', fontWeight: 600, marginLeft: 8 }}>
                    · 覆盖 {ratioPct}%
                  </span>
                </div>
                {coverageLevel && (
                  <div style={{ fontSize: 12, color: '#777', marginTop: 6, lineHeight: 1.5 }}>
                    {coverageLevel.slogan}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Income composition */}
          {incomeRows.length > 0 && (
            <Section title="📊 收入构成">
              {incomeRows.map(row => (
                <PercentRow key={row.label} label={row.label} percent={row.percent} barColor="#4a7c4f" />
              ))}
            </Section>
          )}

          {/* Holdings composition */}
          {holdingRows.length > 0 && (
            <Section title="💼 持仓构成">
              {holdingRows.map(row => (
                <PercentRow
                  key={row.label}
                  label={row.label}
                  subtitle={row.subtitle}
                  percent={row.percent}
                  barColor="#7a5b9e"
                />
              ))}
            </Section>
          )}

          {/* Dimensions */}
          {dimensions.length > 0 && (
            <Section title="🎯 各维度覆盖">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(dimensions.length, 7)}, minmax(0, 1fr))`,
                  gap: 8,
                  marginTop: 4,
                }}
              >
                {dimensions.map(d => (
                  <DimensionMini key={d.id} dim={d} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    )
  },
)

export default CoverageShareCard

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: '#1a3a2a' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function PercentRow({ label, subtitle, percent, barColor }: {
  label: string; subtitle?: string; percent: number; barColor: string
}) {
  const width = Math.max(2, Math.min(percent, 100))
  return (
    <div style={{ marginBottom: subtitle ? 12 : 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 110,
            fontSize: 13,
            fontWeight: 600,
            color: '#333',
            flexShrink: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div
          style={{
            flex: 1,
            height: 18,
            background: '#eceae2',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${width}%`,
              height: '100%',
              background: barColor,
              borderRadius: 4,
            }}
          />
        </div>
        <div style={{ width: 44, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#333' }}>
          {Math.round(percent)}%
        </div>
      </div>
      {subtitle && (
        <div style={{ marginLeft: 122, marginTop: 3, fontSize: 10.5, color: '#888', lineHeight: 1.4 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function DimensionMini({ dim }: { dim: DimensionCoverage }) {
  const size = 64
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const unset = dim.budget <= 0
  const progress = Math.min(Math.max(dim.ratio, 0), 1)
  const offset = circumference * (1 - progress)
  const reached = dim.ratio >= 1
  const pctText = unset ? '—' : `${Math.round(dim.ratio * 100)}%`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e0ddd0" strokeWidth={stroke} />
          {!unset && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={reached ? '#4a7c4f' : '#c58a20'}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          {dim.icon}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1a3a2a', lineHeight: 1 }}>{dim.label}</div>
      <div style={{ fontSize: 10, color: '#666', lineHeight: 1 }}>{pctText}</div>
    </div>
  )
}

interface RowItem {
  label: string
  percent: number
  subtitle?: string
}

function buildIncomeRows(income: IncomeSplit): RowItem[] {
  const total = income.dividend + income.pension + income.other
  if (total <= 0) return []
  const items = [
    { label: '股息', value: income.dividend },
    { label: '养老金', value: income.pension },
    { label: '其他被动', value: income.other },
  ].filter(i => i.value > 0)
  return items.map(i => ({ label: i.label, percent: (i.value / total) * 100 }))
}

function buildHoldingRows(holdings: DividendHolding[]): RowItem[] {
  if (holdings.length === 0) return []
  const incomes = holdings.map(h => {
    const inc = computeHoldingIncome(h)
    const ref = findDividendStock(h.stockCode)
    return {
      name: h.stockName,
      annual: inc.netAnnual,
      yieldPct: inc.yieldPct,
      dividendPerShare: inc.dividendPerShare,
      asOfYear: ref?.asOfYear,
    }
  })
  const total = incomes.reduce((s, i) => s + i.annual, 0)
  if (total <= 0) return []
  const sorted = [...incomes].sort((a, b) => b.annual - a.annual)
  const top = sorted.slice(0, HOLDING_LIMIT)
  const rest = sorted.slice(HOLDING_LIMIT)
  const rows: RowItem[] = top.map(i => ({
    label: i.name,
    percent: (i.annual / total) * 100,
    subtitle: formatHoldingMeta(i.asOfYear, i.dividendPerShare, i.yieldPct),
  }))
  if (rest.length > 0) {
    const restSum = rest.reduce((s, i) => s + i.annual, 0)
    rows.push({ label: `其他 ${rest.length} 项`, percent: (restSum / total) * 100 })
  }
  return rows
}

function formatHoldingMeta(asOfYear: string | undefined, dps: number, yieldPct: number): string {
  const parts: string[] = []
  if (dps > 0) {
    const yearLabel = asOfYear ? `${asOfYear.slice(-2)}年` : '近期'
    parts.push(`${yearLabel}每股 ¥${dps.toFixed(2)}`)
  }
  if (yieldPct > 0) parts.push(`股息率 ${yieldPct.toFixed(2)}%`)
  return parts.join(' · ')
}
