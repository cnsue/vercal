import { formatCNY } from '../../utils/formatters'

interface Props {
  decentMonthly: number
  nowRatio: number
  retiredRatio: number
  nowMonthly: number
  retiredMonthly: number
  onEdit?: () => void
}

/**
 * 岁月页顶部的体面覆盖率大卡片。
 * 拆为两列：「当下」(股息+其他) 与 「退休后」(全部)；
 * 养老金只有退休后才会开始领，所以两个数经常差很多。
 */
export default function CoverageHero({
  decentMonthly, nowRatio, retiredRatio, nowMonthly, retiredMonthly, onEdit,
}: Props) {
  const unset = decentMonthly <= 0
  const retiredReached = retiredRatio >= 1

  const background = unset
    ? 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'
    : retiredReached
      ? 'linear-gradient(135deg, #166c3b 0%, #3eb070 100%)'
      : 'linear-gradient(135deg, #8a4b1a 0%, #d28c3b 100%)'

  return (
    <button onClick={onEdit}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background, borderRadius: 20, padding: 20, color: '#fff',
        border: 'none', cursor: onEdit ? 'pointer' : 'default', marginBottom: 14,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>体面覆盖率</div>
        {!unset && (
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {retiredReached ? '退休后已达标' : '进行中'}
          </div>
        )}
      </div>

      {unset ? (
        <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.9, marginTop: 6 }}>
          点击设置体面标准 ›
        </div>
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
        </>
      )}
    </button>
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
