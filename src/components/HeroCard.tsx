import { formatCNY, formatSignedCNY, formatSignedPercent } from '../utils/formatters'

interface Props {
  totalValueCNY: number
  dailyChange: number
  dailyChangePct: number
  latestDateKey: string | null
  annualTarget: number
  onEditTarget: () => void
}

export default function HeroCard({
  totalValueCNY, dailyChange, dailyChangePct,
  latestDateKey, annualTarget, onEditTarget,
}: Props) {
  const gap = annualTarget - totalValueCNY
  const ratio = annualTarget > 0 ? Math.min(totalValueCNY / annualTarget, 1) : 0
  const gapText = annualTarget > 0
    ? (gap > 0 ? `还差 ${formatCNY(gap)}` : `已超 ${formatCNY(Math.abs(gap))}`)
    : '未设置'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1a3a2a 0%, #2d6a46 100%)',
      borderRadius: 20, padding: 20, color: '#fff', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>资产总览</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            {latestDateKey ? `最近记录 ${latestDateKey}` : '本地记录你的每日总资产'}
          </div>
        </div>
        <div style={{
          background: dailyChange >= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,80,80,0.3)',
          borderRadius: 20, padding: '4px 10px', fontSize: 13, fontWeight: 700,
        }}>
          {formatSignedPercent(dailyChangePct)}
        </div>
      </div>

      <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', margin: '8px 0 12px' }}>
        {formatCNY(totalValueCNY)}
      </div>

      {/* Annual target */}
      <button onClick={onEditTarget} style={{
        width: '100%', background: 'rgba(255,255,255,0.12)', border: 'none',
        borderRadius: 14, padding: 12, color: '#fff', textAlign: 'left', cursor: 'pointer',
      }}>
        {annualTarget > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.72, marginBottom: 2 }}>年度目标差距</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{gapText}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, opacity: 0.72, marginBottom: 2 }}>完成度</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: gap > 0 ? '#fff' : '#6feba0' }}>
                  {(ratio * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${ratio * 100}%`, background: gap > 0 ? '#fff' : '#6feba0', borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.75 }}>
              <span>年度目标</span>
              <span>{formatCNY(annualTarget)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>设置年度目标</span>
            <span style={{ fontSize: 18 }}>›</span>
          </div>
        )}
      </button>

      {/* Bottom metrics */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontSize: 11, opacity: 0.72 }}>较上次</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{formatSignedCNY(dailyChange)}</div>
        </div>
      </div>
    </div>
  )
}
