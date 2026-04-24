import { useState } from 'react'
import { formatCNY } from '../../utils/formatters'
import type { DimensionCoverage } from '../../utils/retirementCalc'

interface Props {
  dimensions: DimensionCoverage[]
  /** 'now' = 当下即可领；'retired' = 退休后。仅影响副标题。 */
  phase?: 'now' | 'retired'
  onEdit?: () => void
}

export default function CoverageDimensions({ dimensions, phase = 'retired', onEdit }: Props) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const phaseLabel = phase === 'now' ? '按「当下即可领」口径' : '按「退休后」口径'
  const active = dimensions.find(d => d.id === detailId)

  return (
    <>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>各维度覆盖</div>
          {onEdit && (
            <button onClick={onEdit}
              style={{ background: 'none', border: 'none', color: 'var(--primary-strong)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
              调整标准 ›
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
          {phaseLabel}，点击圆环查看缺口详情
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {dimensions.map(d => (
            <DimensionCard key={d.id} dim={d} onClick={() => setDetailId(d.id)} />
          ))}
        </div>
      </div>
      {active && (
        <DimensionDetailSheet dim={active} onClose={() => setDetailId(null)} />
      )}
    </>
  )
}

function DimensionCard({ dim, onClick }: { dim: DimensionCoverage; onClick: () => void }) {
  const reached = dim.ratio >= 1
  const unset = dim.budget <= 0
  const background = unset
    ? 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'
    : reached
      ? 'linear-gradient(135deg, #166c3b 0%, #3eb070 100%)'
      : 'linear-gradient(135deg, #8a4b1a 0%, #d28c3b 100%)'

  return (
    <button onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background, borderRadius: 14, padding: 14, color: '#fff',
        border: 'none', cursor: 'pointer',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>{dim.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dim.label}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        <Ring ratio={dim.ratio} unset={unset} reached={reached} />
      </div>
      <div style={{ fontSize: 10, opacity: 0.85, textAlign: 'center', lineHeight: 1.4 }}>
        {formatCNY(dim.income)} / {formatCNY(dim.budget)}
      </div>
      <div style={{ fontSize: 10, marginTop: 4, textAlign: 'center', fontWeight: 700 }}>
        {unset ? '未设预算' : reached ? '已覆盖' : `缺口 ${formatCNY(dim.gap)}`}
      </div>
    </button>
  )
}

function Ring({ ratio, unset, reached, size = 68 }: { ratio: number; unset: boolean; reached: boolean; size?: number }) {
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(Math.max(ratio, 0), 1)
  const offset = circumference * (1 - progress)
  const display = unset ? '—' : `${(ratio * 100).toFixed(0)}%`

  return (
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
        fontSize: 16, fontWeight: 900, letterSpacing: '-0.03em',
      }}>
        {display}
      </div>
    </div>
  )
}

function DimensionDetailSheet({ dim, onClose }: { dim: DimensionCoverage; onClose: () => void }) {
  const reached = dim.ratio >= 1
  const unset = dim.budget <= 0

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      zIndex: 100, display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 28 }}>{dim.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{dim.label}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{dim.description}</div>
          </div>
          <button onClick={onClose} aria-label="关闭"
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>✕</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, marginBottom: 16 }}>
          <div style={{
            background: unset
              ? 'linear-gradient(135deg, #3a3a3a 0%, #555 100%)'
              : reached
                ? 'linear-gradient(135deg, #166c3b 0%, #3eb070 100%)'
                : 'linear-gradient(135deg, #8a4b1a 0%, #d28c3b 100%)',
            borderRadius: 12, padding: 14,
          }}>
            <Ring ratio={dim.ratio} unset={unset} reached={reached} size={76} />
          </div>
          <div style={{ flex: 1 }}>
            <StatRow label="月预算" value={formatCNY(dim.budget)} />
            <StatRow label="预估收入" value={formatCNY(dim.income)} />
            <StatRow
              label={dim.gap > 0 ? '月缺口' : '结余'}
              value={dim.gap > 0 ? formatCNY(dim.gap) : formatCNY(dim.income - dim.budget)}
              accent={dim.gap > 0 ? 'danger' : 'primary'}
            />
          </div>
        </div>

        <div style={{
          background: unset ? 'var(--surface-muted)' : (dim.gap > 0 ? 'var(--warning-bg)' : 'var(--success-bg)'),
          color: unset ? 'var(--muted)' : (dim.gap > 0 ? 'var(--warning-text)' : 'var(--success-text)'),
          borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.6,
        }}>
          {unset ? (
            <div>还未设置该维度的月预算。点「调整标准」填写后即可看到覆盖详情。</div>
          ) : dim.gap > 0 ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>行动建议</div>
              <div>{dim.suggestion}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>已覆盖</div>
              <div>该维度预估收入已达标。多出的现金流可调配到未达标维度，或提高该维度预算。</div>
            </>
          )}
        </div>

        <button onClick={onClose}
          style={{
            width: '100%', marginTop: 16, padding: 12, borderRadius: 10, border: 'none',
            background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
            cursor: 'pointer', fontWeight: 700,
          }}>
          关闭
        </button>
      </div>
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: 'primary' | 'danger' }) {
  const color = accent === 'danger' ? 'var(--danger)' : accent === 'primary' ? 'var(--primary-strong)' : 'var(--text-strong)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: accent ? 800 : 600, color }}>{value}</span>
    </div>
  )
}
