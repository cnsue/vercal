import { useState } from 'react'
import { formatCNY } from '../../utils/formatters'
import type { DimensionCoverage } from '../../utils/retirementCalc'

interface Props {
  dimensions: DimensionCoverage[]
  /**
   * 口径：'now' = 当下即可领（股息+其他），'retired' = 退休后（加养老金）。
   * 仅影响副标题显示。
   */
  phase?: 'now' | 'retired'
  onEdit?: () => void
}

export default function CoverageDimensions({ dimensions, phase = 'retired', onEdit }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const phaseLabel = phase === 'now' ? '按「当下即可领」口径' : '按「退休后」口径'

  return (
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
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
        {phaseLabel}，收入按各维度预算占比均摊
      </div>
      {dimensions.map(d => (
        <DimensionRow
          key={d.key}
          dim={d}
          open={openKey === d.key}
          onToggle={() => setOpenKey(openKey === d.key ? null : d.key)}
        />
      ))}
    </div>
  )
}

function DimensionRow({ dim, open, onToggle }: {
  dim: DimensionCoverage; open: boolean; onToggle: () => void
}) {
  const reached = dim.ratio >= 1
  const pct = Math.min(dim.ratio, 1.2) * 100
  const barColor = reached ? 'var(--primary-strong)' : 'var(--accent)'

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
          color: 'inherit', textAlign: 'left',
        }}>
        <span style={{ fontSize: 22, width: 28, textAlign: 'center' }}>{dim.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>{dim.label}</span>
            <span style={{ color: reached ? 'var(--primary-strong)' : 'var(--text-strong)', fontWeight: 700 }}>
              {(dim.ratio * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--surface-muted)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, background: barColor,
              borderRadius: 3, transition: 'width 0.4s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            <span>{formatCNY(dim.income)} / {formatCNY(dim.budget)}</span>
            {dim.gap > 0 ? (
              <span style={{ color: 'var(--danger)' }}>缺口 {formatCNY(dim.gap)}</span>
            ) : (
              <span style={{ color: 'var(--primary-strong)' }}>已覆盖</span>
            )}
          </div>
        </div>
        <span style={{ color: 'var(--chevron)', fontSize: 14, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
      </button>
      {open && (
        <div style={{ padding: '0 0 12px 38px' }}>
          <div style={{
            background: dim.gap > 0 ? 'var(--warning-bg)' : 'var(--success-bg)',
            borderRadius: 10, padding: 12, fontSize: 12, lineHeight: 1.6,
            color: dim.gap > 0 ? 'var(--warning-text)' : 'var(--success-text)',
          }}>
            {dim.gap > 0 ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>月缺口 {formatCNY(dim.gap)}</div>
                <div style={{ color: 'var(--muted)', marginBottom: 6 }}>
                  收入按预算占比分摊到该维度为 {formatCNY(dim.income)}，与目标 {formatCNY(dim.budget)} 差额即为缺口。
                </div>
                <div>{dim.suggestion}</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>该维度已达标</div>
                <div>多出的现金流可调配到其它未达标维度，或提高该维度预算。</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
