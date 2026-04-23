interface Props {
  /** 覆盖率 0 - ∞；unset 时忽略 */
  ratio: number
  /** 是否未设置体面标准（显示"未设"占位） */
  unset: boolean
  onClick?: () => void
  size?: number
}

/**
 * 浮在年度目标卡片右上角的迷你环形进度，显示体面覆盖率。
 * 用绝对定位覆盖，作为独立 button 点击（不触发父卡片 onClick）。
 */
export default function CoverageRing({ ratio, unset, onClick, size = 52 }: Props) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(Math.max(ratio, 0), 1)
  const offset = circumference * (1 - progress)
  const reached = !unset && ratio >= 1

  const display = unset
    ? '未设'
    : reached
      ? '达标'
      : `${Math.round(ratio * 100)}%`

  return (
    <button onClick={onClick}
      aria-label="体面覆盖率"
      style={{
        position: 'absolute', top: 10, right: 10,
        width: size, height: size, padding: 0,
        background: 'rgba(0,0,0,0.12)', borderRadius: '50%',
        border: 'none', cursor: 'pointer', color: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
      <svg width={size} height={size}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
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
        fontSize: unset ? 10 : 12, fontWeight: 800, lineHeight: 1,
        position: 'relative', zIndex: 1,
      }}>
        {display}
      </div>
      <div style={{
        fontSize: 8, opacity: 0.85, marginTop: 2, lineHeight: 1,
        position: 'relative', zIndex: 1, letterSpacing: 1,
      }}>
        体面
      </div>
    </button>
  )
}
