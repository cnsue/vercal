import { formatCNY } from '../../utils/formatters'
import type { DimensionCoverage } from '../../utils/retirementCalc'
import { getCoverageLevel, getNextCoverageLevel, COVERAGE_LEVELS } from '../../types/retirement'

interface Props {
  decentMonthly: number
  nowRatio: number
  retiredRatio: number
  nowMonthly: number
  retiredMonthly: number
  onEdit?: () => void
  /** 底部维度圆环列表；传空数组则不渲染底部区域 */
  dimensions?: DimensionCoverage[]
  onDimensionClick?: (id: string) => void
}

const MAX_RATIO = 1.6

export default function CoverageHero({
  decentMonthly, nowRatio, retiredRatio, nowMonthly: _nowMonthly, retiredMonthly, onEdit,
  dimensions = [], onDimensionClick,
}: Props) {
  const unset = decentMonthly <= 0
  const level = unset ? null : getCoverageLevel(retiredRatio)
  const nextLevel = unset ? null : getNextCoverageLevel(retiredRatio)

  const background = level
    ? level.gradient
    : 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'

  const barFill = Math.min(retiredRatio / MAX_RATIO, 1) * 100

  return (
    <div style={{ background, borderRadius: 20, padding: 20, color: '#fff', marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>退休幸福指数</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {level && (
            <div style={{
              background: 'rgba(255,255,255,0.92)', color: level.color,
              borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 700,
            }}>
              {level.emoji} {level.label}
            </div>
          )}
          {onEdit && (
            <button onClick={onEdit} aria-label="调整体面标准" style={{
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '3px 10px',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
              调整 ›
            </button>
          )}
        </div>
      </div>

      {unset ? (
        <button onClick={onEdit} style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
          borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer',
        }}>
          点击设置体面标准 ›
        </button>
      ) : (
        <>
          {/* Progress bar + percentage */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{
                  height: 8, background: 'rgba(255,255,255,0.25)',
                  borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${barFill}%`,
                    background: '#fff', borderRadius: 4, transition: 'width 0.4s',
                  }} />
                </div>
                {/* Level tick marks */}
                {COVERAGE_LEVELS.map(l => (
                  <div key={l.key} style={{
                    position: 'absolute', top: 0,
                    left: `${(l.minRatio / MAX_RATIO) * 100}%`,
                    width: 1, height: 8,
                    background: 'rgba(255,255,255,0.55)',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                  }} />
                ))}
              </div>
              <div style={{
                fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em',
                lineHeight: 1, flexShrink: 0, minWidth: 52, textAlign: 'right',
              }}>
                {Math.round(retiredRatio * 100)}%
              </div>
            </div>

            {/* Level labels below bar */}
            <div style={{ position: 'relative', height: 16, marginTop: 3 }}>
              {COVERAGE_LEVELS.map(l => (
                <div key={l.key} style={{
                  position: 'absolute',
                  left: `${(l.minRatio / MAX_RATIO) * 100}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 9, opacity: level?.key === l.key ? 1 : 0.65,
                  fontWeight: level?.key === l.key ? 700 : 400,
                  lineHeight: 1.2, whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}>
                  ↑{l.label}
                </div>
              ))}
            </div>
          </div>

          {/* Next level hint */}
          <div style={{ marginBottom: 6, marginTop: 6, fontSize: 13, fontWeight: 600, opacity: 0.95 }}>
            {nextLevel
              ? `下一站：${nextLevel.emoji} ${nextLevel.label}（还差 ${Math.max(1, Math.round((nextLevel.minRatio - retiredRatio) * 100))}%）`
              : `${level?.emoji ?? '🦋'} ${level?.slogan ?? '人生无憾，心满意足'}`
            }
          </div>

          {/* Monthly income / target */}
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>
            退休月收入 {formatCNY(retiredMonthly)} / 目标 {formatCNY(decentMonthly)}
          </div>

          {/* Secondary: current / retired ratios */}
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: dimensions.length > 0 ? 0 : 2 }}>
            当前 {Math.round(nowRatio * 100)}% · 退休预测 {Math.round(retiredRatio * 100)}%
          </div>

          {dimensions.length > 0 && (
            <DimensionsRow dimensions={dimensions} onDimensionClick={onDimensionClick} />
          )}
        </>
      )}
    </div>
  )
}

function DimensionsRow({ dimensions, onDimensionClick }: {
  dimensions: DimensionCoverage[]
  onDimensionClick?: (id: string) => void
}) {
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
      <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 10 }}>
        各维度覆盖 · 点圆环看缺口
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${
          dimensions.length <= 9 ? dimensions.length : Math.ceil(dimensions.length / 2)
        }, minmax(0, 1fr))`,
        gap: 2, rowGap: 10,
      }}>
        {dimensions.map(d => (
          <DimensionMini key={d.id} dim={d} onClick={() => onDimensionClick?.(d.id)} />
        ))}
      </div>
    </div>
  )
}

function DimensionMini({ dim, onClick }: { dim: DimensionCoverage; onClick: () => void }) {
  const size = 38
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const reached = dim.ratio >= 1
  const unset = dim.budget <= 0
  const progress = Math.min(Math.max(dim.ratio, 0), 1)
  const offset = circumference * (1 - progress)
  const pctText = unset ? '—' : `${Math.round(dim.ratio * 100)}%`

  return (
    <button onClick={onClick} aria-label={`${dim.label} ${pctText}`}
      style={{
        background: 'none', border: 'none', padding: '2px 0',
        color: '#fff', cursor: 'pointer', minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} />
          {!unset && (
            <circle cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={reached ? '#d4fbe3' : '#fff'} strokeWidth={stroke}
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.4s' }} />
          )}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 14, lineHeight: 1,
        }}>
          {dim.icon}
        </div>
      </div>
      <div style={{ fontSize: 10, opacity: 0.9, fontWeight: 700, lineHeight: 1 }}>
        {dim.label}
      </div>
      <div style={{ fontSize: 9, opacity: 0.8, lineHeight: 1 }}>
        {pctText}
      </div>
    </button>
  )
}
