import { formatCNY } from '../../utils/formatters'

interface Props {
  ratio: number           // 0 - ∞；0 表示未设置体面标准
  decentMonthly: number   // 月体面标准
  monthlyIncome: number   // 月被动收入总和
  /** 变体样式：'full' 独占一行（岁月页顶部），'compact' 与其它卡片并排（资产页左右双卡片） */
  variant?: 'full' | 'compact'
  onEdit?: () => void
}

/**
 * 体面覆盖率卡片。
 * - ratio = 0（未设置标准）：深色引导用户去设置
 * - 0 < ratio < 1（进行中）：品牌绿渐变
 * - ratio ≥ 1（已达标）：亮绿渐变
 */
export default function CoverageHero({
  ratio, decentMonthly, monthlyIncome, variant = 'full', onEdit,
}: Props) {
  const reached = ratio >= 1
  const unset = decentMonthly <= 0
  const pct = Math.min(ratio, 1.2) * 100 // 超过 100% 也画出，截到 120%

  const background = unset
    ? 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'
    : reached
      ? 'linear-gradient(135deg, #166c3b 0%, #3eb070 100%)'
      : 'linear-gradient(135deg, #8a4b1a 0%, #d28c3b 100%)'

  const titleSize = variant === 'compact' ? 13 : 16
  const valueSize = variant === 'compact' ? 22 : 34
  const padding = variant === 'compact' ? 14 : 20
  const showSubMetrics = variant === 'full'

  return (
    <button onClick={onEdit}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background, borderRadius: 20, padding, color: '#fff',
        border: 'none', cursor: onEdit ? 'pointer' : 'default',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: variant === 'compact' ? 4 : 6 }}>
        <div style={{ fontSize: titleSize, fontWeight: 800, letterSpacing: '-0.02em' }}>体面覆盖率</div>
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
          点击设置体面标准 ›
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
          {showSubMetrics ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <div>
                <div style={{ opacity: 0.75, marginBottom: 2 }}>月被动收入</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{formatCNY(monthlyIncome)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ opacity: 0.75, marginBottom: 2 }}>体面标准</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{formatCNY(decentMonthly)}/月</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              {formatCNY(monthlyIncome)} / {formatCNY(decentMonthly)}月
            </div>
          )}
        </>
      )}
    </button>
  )
}
