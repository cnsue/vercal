import { formatCNY, formatSignedCNY, formatSignedPercent } from '../utils/formatters'
import CoverageRing from './retirement/CoverageRing'

interface Props {
  totalValueCNY: number
  dailyChange: number
  dailyChangePct: number
  latestDateKey: string | null
  coverage?: {
    ratio: number
    unset: boolean
    onClick?: () => void
  }
}

export default function HeroCard({
  totalValueCNY, dailyChange, dailyChangePct, latestDateKey, coverage,
}: Props) {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(135deg, #1a3a2a 0%, #2d6a46 100%)',
      borderRadius: 20, padding: 20, color: '#fff', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>资产总览</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
            {latestDateKey ? `最近记录 ${latestDateKey}` : '本地记录你的每日总资产'}
          </div>
        </div>
        <div style={{
          background: dailyChange >= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,80,80,0.3)',
          borderRadius: 20, padding: '4px 10px', fontSize: 13, fontWeight: 700,
          flexShrink: 0,
          marginRight: coverage ? 60 : 0,
        }}>
          {formatSignedPercent(dailyChangePct)}
        </div>
      </div>

      <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-0.04em', margin: '8px 0 4px' }}>
        {formatCNY(totalValueCNY)}
      </div>

      <div style={{ fontSize: 12, opacity: 0.8 }}>
        较上次 <span style={{ fontWeight: 700, opacity: 1 }}>{formatSignedCNY(dailyChange)}</span>
      </div>

      {coverage && (
        <CoverageRing
          ratio={coverage.ratio}
          unset={coverage.unset}
          onClick={coverage.onClick}
        />
      )}
    </div>
  )
}
