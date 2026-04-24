import { formatCNY } from '../../utils/formatters'
import type { DimensionCoverage } from '../../utils/retirementCalc'

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

/**
 * 岁月页顶部的体面覆盖率大卡片。
 * - 两列：当下（股息+其他） | 退休后（加养老金）
 * - 底部一排小圆环展示各维度覆盖率，点击弹出详情
 */
export default function CoverageHero({
  decentMonthly, nowRatio, retiredRatio, nowMonthly, retiredMonthly, onEdit,
  dimensions = [], onDimensionClick,
}: Props) {
  const unset = decentMonthly <= 0
  const retiredReached = retiredRatio >= 1

  const background = unset
    ? 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'
    : retiredReached
      ? 'linear-gradient(135deg, #166c3b 0%, #3eb070 100%)'
      : 'linear-gradient(135deg, #8a4b1a 0%, #d28c3b 100%)'

  return (
    <div style={{
      background, borderRadius: 20, padding: 20, color: '#fff',
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>体面覆盖率</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!unset && (
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              {retiredReached ? '退休后已达标' : '进行中'}
            </div>
          )}
          {onEdit && (
            <button onClick={onEdit} aria-label="调整体面标准"
              style={{
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                border: 'none', borderRadius: 12, padding: '2px 10px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
              调整 ›
            </button>
          )}
        </div>
      </div>

      {unset ? (
        <button onClick={onEdit}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
            borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
          点击设置体面标准 ›
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16 }}>
            <PhaseBlock label="当下即可领" ratio={nowRatio} monthly={nowMonthly} decent={decentMonthly} emphasis="muted" />
            <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
            <PhaseBlock label="退休后" ratio={retiredRatio} monthly={retiredMonthly} decent={decentMonthly} emphasis="bold" />
          </div>
          <div style={{ fontSize: 11, opacity: 0.75, marginTop: 12, lineHeight: 1.5 }}>
            股息和其他被动收入「当下」就能领；养老金到退休后才开始，所以两个数通常差很多。
          </div>
          {dimensions.length > 0 && (
            <DimensionsRow dimensions={dimensions} onDimensionClick={onDimensionClick} />
          )}
        </>
      )}
    </div>
  )
}

function PhaseBlock({ label, ratio, monthly, decent, emphasis }: {
  label: string
  ratio: number
  monthly: number
  decent: number
  emphasis: 'muted' | 'bold'
}) {
  const reached = ratio >= 1
  const pct = Math.min(ratio, 1.2) * 100
  const valueSize = emphasis === 'bold' ? 28 : 22

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: valueSize, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {(ratio * 100).toFixed(1)}%
      </div>
      <div style={{
        height: 4, background: 'rgba(255,255,255,0.25)',
        borderRadius: 2, overflow: 'hidden', margin: '8px 0 6px',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: reached ? '#d4fbe3' : '#fff',
          borderRadius: 2, transition: 'width 0.4s',
        }} />
      </div>
      <div style={{ fontSize: 10, opacity: 0.8 }}>
        {formatCNY(monthly)} / {formatCNY(decent)}
      </div>
    </div>
  )
}

function DimensionsRow({ dimensions, onDimensionClick }: {
  dimensions: DimensionCoverage[]
  onDimensionClick?: (id: string) => void
}) {
  return (
    <div style={{
      marginTop: 14, paddingTop: 12,
      borderTop: '1px solid rgba(255,255,255,0.2)',
    }}>
      <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 10 }}>
        各维度覆盖 · 点圆环看缺口
      </div>
      <div style={{
        display: 'grid',
        // ≤9 项一行铺满；更多时均摊两行，避免最后一行只有 1-2 个
        gridTemplateColumns: `repeat(${
          dimensions.length <= 9 ? dimensions.length : Math.ceil(dimensions.length / 2)
        }, minmax(0, 1fr))`,
        gap: 2,
        rowGap: 10,
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
