import { formatCNY } from '../utils/formatters'

interface Props {
  totalValueCNY: number
  annualTarget: number
  onEdit: () => void
  variant?: 'full' | 'compact'
}

/**
 * 年度资产目标卡片（独立抽出的紧凑卡片，供资产首页与 岁月 页共用配色方案）。
 * 颜色语义：
 * - 未设置：深灰 —— 引导设置
 * - 进行中 (0 < ratio < 1)：琥珀渐变
 * - 已达标 (ratio ≥ 1)：亮绿渐变
 */
export default function AnnualTargetCard({
  totalValueCNY, annualTarget, onEdit, variant = 'compact',
}: Props) {
  const unset = annualTarget <= 0
  const ratio = unset ? 0 : totalValueCNY / annualTarget
  const reached = ratio >= 1
  const pct = Math.min(ratio, 1.2) * 100
  const gap = annualTarget - totalValueCNY

  const background = unset
    ? 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'
    : reached
      ? 'linear-gradient(135deg, #166c3b 0%, #3eb070 100%)'
      : 'linear-gradient(135deg, #8a4b1a 0%, #d28c3b 100%)'

  const titleSize = variant === 'compact' ? 13 : 16
  const valueSize = variant === 'compact' ? 22 : 34
  const padding = variant === 'compact' ? 14 : 20

  return (
    <button onClick={onEdit}
      style={{
        display: 'block', flex: 1, width: '100%', textAlign: 'left',
        background, borderRadius: 20, padding, color: '#fff',
        border: 'none', cursor: 'pointer',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: variant === 'compact' ? 4 : 6 }}>
        <div style={{ fontSize: titleSize, fontWeight: 800, letterSpacing: '-0.02em' }}>年度目标</div>
        {!unset && (
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 12,
            padding: '2px 8px', fontSize: 11, fontWeight: 700,
          }}>
            {reached ? '已达标' : '进行中'}
          </div>
        )}
      </div>

      {unset ? (
        <div style={{ fontSize: variant === 'compact' ? 13 : 15, fontWeight: 600, opacity: 0.9, marginTop: 6 }}>
          点击设置年度目标 ›
        </div>
      ) : (
        <>
          <div style={{ fontSize: valueSize, fontWeight: 900, letterSpacing: '-0.04em', margin: '4px 0 10px' }}>
            {(ratio * 100).toFixed(1)}%
          </div>
          <div style={{
            height: variant === 'compact' ? 4 : 6,
            background: 'rgba(255,255,255,0.25)',
            borderRadius: 3, overflow: 'hidden', marginBottom: 8,
          }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: reached ? '#d4fbe3' : '#fff',
              borderRadius: 3, transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>
            {gap > 0 ? `还差 ${formatCNY(gap)}` : `已超 ${formatCNY(Math.abs(gap))}`}
          </div>
        </>
      )}
    </button>
  )
}
