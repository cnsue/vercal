import { forwardRef } from 'react'
import type { DimensionCoverage } from '../../utils/retirementCalc'
import type { DividendHolding, CoverageLevel } from '../../types/retirement'
import { computeHoldingIncome } from '../../utils/retirementCalc'
import { getCoverageLevel, COVERAGE_LEVELS } from '../../types/retirement'

interface IncomeSplit {
  dividend: number
  pension: number
  other: number
}

export interface CoverageShareCardProps {
  ratio: number
  modeLabel: string
  decentMonthly: number
  income: IncomeSplit
  holdings: DividendHolding[]
  dimensions: DimensionCoverage[]
  appVersion: string
}

/** 一线·三口家庭各档月度合计（来自 BUDGET_PRESETS_FAMILY3_TIER1 注释） */
const TIER1_FAMILY3_TOTALS: Record<CoverageLevel['key'], number> = {
  subsistence: 13150,
  stable: 22200,
  decent: 49400,
  comfortable: 65700,
  fulfilled: 82900,
}

/** 用「一线三口」基线给定 monthly 找最近档 */
function classifyTargetLevel(monthly: number): CoverageLevel | null {
  if (monthly <= 0) return null
  let bestKey: CoverageLevel['key'] = 'subsistence'
  let bestDist = Infinity
  for (const [key, total] of Object.entries(TIER1_FAMILY3_TOTALS) as [CoverageLevel['key'], number][]) {
    const dist = Math.abs(total - monthly)
    if (dist < bestDist) {
      bestDist = dist
      bestKey = key
    }
  }
  return COVERAGE_LEVELS.find(l => l.key === bestKey) ?? null
}

/** 给定档位对应的「一线三口」月度区间，用于分享卡显示 */
function targetLevelBand(level: CoverageLevel): string {
  const order: CoverageLevel['key'][] = ['subsistence', 'stable', 'decent', 'comfortable', 'fulfilled']
  const idx = order.indexOf(level.key)
  const lo = idx > 0 ? (TIER1_FAMILY3_TOTALS[order[idx - 1]] + TIER1_FAMILY3_TOTALS[level.key]) / 2 : 0
  const hi = idx < order.length - 1 ? (TIER1_FAMILY3_TOTALS[level.key] + TIER1_FAMILY3_TOTALS[order[idx + 1]]) / 2 : Infinity
  const fmt = (n: number) => `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}w`
  if (idx === 0) return `≤ ${fmt(hi)}/月`
  if (idx === order.length - 1) return `≥ ${fmt(lo)}/月`
  return `${fmt(lo)}–${fmt(hi)}/月`
}

const CARD_WIDTH = 720
const HOLDING_LIMIT = 8

const CoverageShareCard = forwardRef<HTMLDivElement, CoverageShareCardProps>(
  function CoverageShareCard(props, ref) {
    const { ratio, modeLabel, decentMonthly, income, holdings, dimensions, appVersion } = props
    const level = getCoverageLevel(ratio)
    const background = level
      ? level.gradient
      : 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'

    const targetLevel = classifyTargetLevel(decentMonthly)
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
        {/* Hero section */}
        <div style={{ background, padding: '40px 36px 36px', color: '#fff' }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 2,
              opacity: 0.9,
              marginBottom: 24,
            }}
          >
            COINSIGHT · 体面幸福指数
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div style={{ fontSize: 96, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.04em' }}>
              {Math.round(ratio * 100)}%
            </div>
            {level && (
              <div style={{ fontSize: 30, fontWeight: 800 }}>
                {level.emoji} {level.label}
              </div>
            )}
          </div>
          <div style={{ fontSize: 16, opacity: 0.85, marginTop: 12 }}>
            {modeLabel} · {level?.slogan ?? '设置体面标准开始评估'}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '32px 36px 28px' }}>
          {/* Target standard tier */}
          {targetLevel && (
            <Section title="🎯 体面标准档">
              <div style={{
                background: '#f4f1e8', borderLeft: `4px solid ${targetLevel.color}`,
                borderRadius: 6, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: targetLevel.color, lineHeight: 1.2 }}>
                  {targetLevel.emoji} {targetLevel.label}
                  <span style={{ fontSize: 14, color: '#555', fontWeight: 600, marginLeft: 8 }}>
                    · {targetLevel.slogan}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#777', marginTop: 6, lineHeight: 1.5 }}>
                  对标基线：一线城市 · 三口家庭 ≈ {targetLevelBand(targetLevel)}
                </div>
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
                <PercentRow key={row.label} label={row.label} percent={row.percent} barColor="#7a5b9e" />
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

        {/* Footer */}
        <div
          style={{
            padding: '20px 36px 28px',
            borderTop: '1px solid #e5e5dd',
            textAlign: 'center',
            color: '#666',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a3a2a', letterSpacing: 1 }}>
            Coinsight
          </div>
          <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
            每日资产快照 · 退休规划工具 · v{appVersion}
          </div>
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

function PercentRow({ label, percent, barColor }: { label: string; percent: number; barColor: string }) {
  const width = Math.max(2, Math.min(percent, 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
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

function buildIncomeRows(income: IncomeSplit) {
  const total = income.dividend + income.pension + income.other
  if (total <= 0) return []
  const items = [
    { label: '股息', value: income.dividend },
    { label: '养老金', value: income.pension },
    { label: '其他被动', value: income.other },
  ].filter(i => i.value > 0)
  return items.map(i => ({ label: i.label, percent: (i.value / total) * 100 }))
}

function buildHoldingRows(holdings: DividendHolding[]) {
  if (holdings.length === 0) return []
  const incomes = holdings.map(h => ({ name: h.stockName, annual: computeHoldingIncome(h).netAnnual }))
  const total = incomes.reduce((s, i) => s + i.annual, 0)
  if (total <= 0) return []
  const sorted = [...incomes].sort((a, b) => b.annual - a.annual)
  const top = sorted.slice(0, HOLDING_LIMIT)
  const rest = sorted.slice(HOLDING_LIMIT)
  const rows = top.map(i => ({ label: i.name, percent: (i.annual / total) * 100 }))
  if (rest.length > 0) {
    const restSum = rest.reduce((s, i) => s + i.annual, 0)
    rows.push({ label: `其他 ${rest.length} 项`, percent: (restSum / total) * 100 })
  }
  return rows
}
