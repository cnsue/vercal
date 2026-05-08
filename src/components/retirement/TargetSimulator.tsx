import { useEffect, useMemo, useState } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'
import { DIVIDEND_STOCKS, findDividendStock, dividendYieldPct } from '../../data/dividendStocks'
import { formatCNY } from '../../utils/formatters'
import type { DividendGrowthScenario } from '../../types/retirement'
import { DIVIDEND_SCENARIO_LABELS } from '../../types/retirement'
import type { CoverageMode } from './CoverageHero'

interface Props {
  open: boolean
  onClose: () => void
  decentMonthly: number
  pensionMonthly: number
  otherMonthly: number
  yearsToRetire: number
  scenario: DividendGrowthScenario
  initialMode: CoverageMode
}

interface Row {
  /** 已存在持仓为持仓 id，新增股票为 'new-<code>' */
  key: string
  /** 真实持仓 id；新增股票为 undefined（应用时再调 addHolding） */
  holdingId?: string
  isNew: boolean
  stockCode: string
  stockName: string
  /** 已存在持仓的当前股数（current shares）；新股票为 0 */
  baseShares: number
  /** 已存储的目标股数（targetShares），用于判断"是否已修改" */
  savedTarget?: number
  /** 模拟中的当前目标股数（始终为 100 倍数） */
  shares: number
  dps: number
  taxRate: number
  growth: number
  refPrice: number
}

const STEP_OPTIONS = [100, 1000]

const LOT = 100
const ceilLot = (n: number) => Math.ceil(Math.max(0, n) / LOT) * LOT
const snapLot = (n: number, base: number) => {
  const safe = Math.max(0, Number.isFinite(n) ? n : 0)
  if (safe === base) return base
  return Math.round(safe / LOT) * LOT
}

export default function TargetSimulator({
  open, onClose, decentMonthly, pensionMonthly, otherMonthly,
  yearsToRetire, scenario, initialMode,
}: Props) {
  const holdings = useRetirementStore(s => s.plan.holdings)
  const updateHolding = useRetirementStore(s => s.updateHolding)
  const addHolding = useRetirementStore(s => s.addHolding)
  const [mode, setMode] = useState<CoverageMode>(initialMode)
  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState('')

  const initialRows = useMemo<Row[]>(() => holdings.map(h => {
    const ref = findDividendStock(h.stockCode)
    const dps = h.dividendPerShareOverride ?? ref?.dividendPerShare ?? 0
    const startTarget = h.targetShares ?? h.shares
    return {
      key: h.id,
      holdingId: h.id,
      isNew: false,
      stockCode: h.stockCode,
      stockName: h.stockName,
      baseShares: h.shares,
      savedTarget: h.targetShares,
      shares: startTarget,
      dps,
      taxRate: h.taxRate ?? 0,
      growth: ref?.growth?.[scenario] ?? 0,
      refPrice: ref?.referencePrice ?? 0,
    }
  }), [holdings, scenario])

  const [rows, setRows] = useState<Row[]>(initialRows)

  useEffect(() => {
    if (open) {
      setRows(initialRows)
      setMode(initialMode)
      setShowAdd(false)
      setNewCode('')
    }
  }, [open, initialRows, initialMode])

  const projectedAnnual = (r: Row) => {
    const factor = mode === 'retired' ? Math.pow(1 + r.growth, Math.max(0, yearsToRetire)) : 1
    return r.shares * r.dps * (1 - r.taxRate) * factor
  }
  const baselineAnnual = (r: Row) => {
    const factor = mode === 'retired' ? Math.pow(1 + r.growth, Math.max(0, yearsToRetire)) : 1
    return r.baseShares * r.dps * (1 - r.taxRate) * factor
  }

  const projectedDividendAnnual = rows.reduce((s, r) => s + projectedAnnual(r), 0)
  const baselineDividendAnnual = rows.reduce((s, r) => s + baselineAnnual(r), 0)
  const otherSourceMonthly = (mode === 'retired' ? pensionMonthly : 0) + otherMonthly

  const projectedMonthly = projectedDividendAnnual / 12 + otherSourceMonthly
  const baselineMonthly = baselineDividendAnnual / 12 + otherSourceMonthly
  const ratio = decentMonthly > 0 ? projectedMonthly / decentMonthly : 0
  const baselineRatio = decentMonthly > 0 ? baselineMonthly / decentMonthly : 0
  const gap = Math.max(0, decentMonthly - projectedMonthly)

  const extraPrincipal = rows.reduce((s, r) => s + Math.max(0, r.shares - r.baseShares) * r.refPrice, 0)
  const extraAnnual = projectedDividendAnnual - baselineDividendAnnual
  const dirty = rows.some(r => r.isNew || r.shares !== (r.savedTarget ?? r.baseShares))
  const canAutoFill = projectedDividendAnnual > 0 || baselineDividendAnnual > 0

  const availableStocks = DIVIDEND_STOCKS.filter(s => !rows.some(r => r.stockCode === s.code))

  function autoFill() {
    const targetDividendMonthly = decentMonthly - otherSourceMonthly
    if (targetDividendMonthly <= 0) {
      // already covered by other sources — pull each row back to baseline
      setRows(rs => rs.map(r => ({ ...r, shares: r.isNew ? 0 : r.baseShares })))
      return
    }
    const targetAnnual = targetDividendMonthly * 12
    // 用「当前模拟值」做基础（让新加股票按其当前股数比例参与放大）
    const currentAnnual = projectedDividendAnnual
    if (currentAnnual <= 0) return
    const factor = targetAnnual / currentAnnual
    if (factor <= 1) {
      // 已超过目标，回到基线
      setRows(rs => rs.map(r => ({ ...r, shares: r.isNew ? r.shares : r.baseShares })))
      return
    }
    setRows(rs => rs.map(r => {
      if (r.shares <= 0) return r
      return { ...r, shares: ceilLot(r.shares * factor) }
    }))
  }

  function reset() {
    setRows(rs => rs
      .filter(r => !r.isNew)
      .map(r => ({ ...r, shares: r.savedTarget ?? r.baseShares })))
  }

  function applyAll() {
    rows.forEach(r => {
      if (r.isNew) {
        if (r.shares > 0) {
          addHolding({
            stockCode: r.stockCode,
            stockName: r.stockName,
            shares: 0,
            targetShares: r.shares,
          })
        }
      } else if (r.holdingId && r.shares !== (r.savedTarget ?? r.baseShares)) {
        updateHolding(r.holdingId, { targetShares: r.shares })
      }
    })
    onClose()
  }

  function setShares(key: string, next: number) {
    setRows(rs => rs.map(r => r.key === key ? { ...r, shares: snapLot(next, r.baseShares) } : r))
  }

  function removeRow(key: string) {
    setRows(rs => rs.filter(r => r.key !== key))
  }

  function addStock(code: string) {
    const ref = findDividendStock(code)
    if (!ref) return
    const newRow: Row = {
      key: `new-${code}`,
      isNew: true,
      stockCode: ref.code,
      stockName: ref.name,
      baseShares: 0,
      shares: LOT,
      dps: ref.dividendPerShare,
      taxRate: 0,
      growth: ref.growth?.[scenario] ?? 0,
      refPrice: ref.referencePrice,
    }
    setRows(rs => [...rs, newRow])
    setShowAdd(false)
    setNewCode('')
  }

  if (!open) return null

  const modeLabel = mode === 'now' ? '当前' : '退休后'
  const accent = ratio >= 1 ? 'var(--success-text)' : 'var(--warning-text)'
  const accentBg = ratio >= 1 ? 'var(--success-bg)' : 'var(--warning-bg)'

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        padding: '18px 18px calc(16px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 480,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🎯</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>目标试算</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              股数按 100 一手；应用后会写入「目标股数」，不影响当前持仓
            </div>
          </div>
          <button onClick={onClose} aria-label="关闭"
            style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--muted)', cursor: 'pointer', padding: 0 }}>✕</button>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'inline-flex', alignSelf: 'flex-start',
          background: 'var(--surface-muted)', borderRadius: 10, padding: 2, gap: 2, marginBottom: 12,
        }}>
          {(['now', 'retired'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              border: 'none', borderRadius: 8, cursor: 'pointer',
              padding: '5px 12px', fontSize: 12, fontWeight: 700,
              background: mode === m ? 'var(--surface)' : 'transparent',
              color: mode === m ? 'var(--text-strong)' : 'var(--muted)',
              boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}>
              {m === 'now' ? '当前' : '退休后'}
            </button>
          ))}
        </div>

        {/* Summary card */}
        <div style={{
          background: accentBg, borderRadius: 12, padding: 12, marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{modeLabel}月收入 / 体面目标</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>
              覆盖率 {Math.round(ratio * 100)}%
              {dirty && (
                <span style={{ marginLeft: 6, color: 'var(--muted)', fontWeight: 500 }}>
                  （原 {Math.round(baselineRatio * 100)}%）
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', marginTop: 2 }}>
            {formatCNY(projectedMonthly)} <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 13 }}>/ {formatCNY(decentMonthly)}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
            {gap > 0
              ? <span>月缺口 <strong style={{ color: 'var(--danger)' }}>{formatCNY(gap)}</strong></span>
              : <span style={{ color: 'var(--success-text)', fontWeight: 700 }}>已达体面 ✨</span>
            }
            {otherSourceMonthly > 0 && (
              <span>其他来源 +{formatCNY(otherSourceMonthly)}</span>
            )}
            {mode === 'retired' && (
              <span>{DIVIDEND_SCENARIO_LABELS[scenario]}场景 · {yearsToRetire.toFixed(1)} 年后</span>
            )}
          </div>
        </div>

        {/* Auto-fill / reset */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={autoFill} style={{
            flex: 2, padding: '9px 10px', borderRadius: 10, border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: canAutoFill ? 'pointer' : 'not-allowed',
            opacity: canAutoFill ? 1 : 0.5,
          }} disabled={!canAutoFill}>
            ⚖️ 按现有比例自动填补
          </button>
          <button onClick={reset} disabled={!dirty} style={{
            flex: 1, padding: '9px 10px', borderRadius: 10,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: dirty ? 'var(--text-strong)' : 'var(--muted)',
            fontSize: 12, fontWeight: 700, cursor: dirty ? 'pointer' : 'not-allowed',
          }}>
            重置
          </button>
        </div>

        {/* Holdings list */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, marginBottom: 10 }}>
          {rows.length === 0 && !showAdd && (
            <div style={{
              padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13,
              background: 'var(--surface-muted)', borderRadius: 12, marginBottom: 8,
            }}>
              还没有任何标的，点下方「＋ 添加股票」开始试算。
            </div>
          )}
          {rows.map(r => (
            <SimulatorRow key={r.key} row={r}
              projectedAnnual={projectedAnnual(r)}
              baselineAnnual={baselineAnnual(r)}
              mode={mode}
              onChange={n => setShares(r.key, n)}
              onRemove={r.isNew ? () => removeRow(r.key) : undefined} />
          ))}

          {/* Add stock UI */}
          {showAdd ? (
            <div style={{
              marginTop: 4, padding: 12, background: 'var(--surface-muted)', borderRadius: 10,
              border: '1px dashed var(--border-dashed)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>选择新增标的</div>
              {availableStocks.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0 8px' }}>
                  内置表里的股票都在试算范围里了 ✓
                </div>
              ) : (
                <select value={newCode} onChange={e => setNewCode(e.target.value)} style={{
                  width: '100%', padding: '9px 10px', borderRadius: 8,
                  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                }}>
                  <option value="">— 请选择 —</option>
                  {availableStocks.map(s => (
                    <option key={s.code} value={s.code}>
                      {s.name}（{s.code}）· ¥{s.dividendPerShare.toFixed(3)}/股 · 股息率 {dividendYieldPct(s).toFixed(2)}%
                    </option>
                  ))}
                </select>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => { setShowAdd(false); setNewCode('') }} style={{
                  flex: 1, padding: 9, borderRadius: 8, border: 'none',
                  background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>取消</button>
                <button onClick={() => newCode && addStock(newCode)}
                  disabled={!newCode || availableStocks.length === 0}
                  style={{
                    flex: 2, padding: 9, borderRadius: 8, border: 'none',
                    background: newCode ? 'var(--primary)' : 'var(--button-secondary-bg)',
                    color: newCode ? '#fff' : 'var(--muted)',
                    fontSize: 12, fontWeight: 700, cursor: newCode ? 'pointer' : 'not-allowed',
                  }}>加入试算</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} style={{
              width: '100%', padding: 9, borderRadius: 10,
              border: '1px dashed var(--border-dashed)', background: 'var(--surface-subtle)',
              color: 'var(--text-soft)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              ＋ 添加股票
            </button>
          )}
        </div>

        {/* Bottom totals */}
        {dirty && (
          <div style={{
            background: 'var(--surface-muted)', borderRadius: 10, padding: 10, marginBottom: 10,
            fontSize: 12, lineHeight: 1.7,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>需要追加资金（按参考价）</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatCNY(extraPrincipal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)' }}>新增{modeLabel}年股息（税后）</span>
              <span style={{ fontWeight: 700, color: 'var(--primary-strong)' }}>+{formatCNY(extraAnnual)}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 12, borderRadius: 10, border: 'none',
            background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
            cursor: 'pointer', fontWeight: 700, fontSize: 14,
          }}>
            关闭
          </button>
          <button onClick={applyAll} disabled={!dirty} style={{
            flex: 2, padding: 12, borderRadius: 10, border: 'none',
            background: dirty ? 'var(--primary)' : 'var(--button-secondary-bg)',
            color: dirty ? '#fff' : 'var(--muted)',
            cursor: dirty ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 14,
          }}>
            保存为目标股数
          </button>
        </div>
      </div>
    </div>
  )
}

function SimulatorRow({ row, projectedAnnual, baselineAnnual, mode, onChange, onRemove }: {
  row: Row
  projectedAnnual: number
  baselineAnnual: number
  mode: CoverageMode
  onChange: (next: number) => void
  onRemove?: () => void
}) {
  const delta = row.shares - row.baseShares
  const extraAnnual = projectedAnnual - baselineAnnual
  const extraCost = Math.max(0, delta) * row.refPrice
  const [draft, setDraft] = useState<string | null>(null)
  const inputValue = draft ?? String(row.shares)
  const commit = () => {
    if (draft === null) return
    onChange(parseFloat(draft) || 0)
    setDraft(null)
  }

  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: 'var(--surface)', border: '1px solid var(--border)',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>
            {row.stockName}
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6, fontWeight: 500 }}>{row.stockCode}</span>
            {row.isNew && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                background: 'var(--primary-soft)', color: 'var(--primary-strong)', marginLeft: 6,
              }}>新增</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            ¥{row.dps.toFixed(3)}/股
            {row.refPrice > 0 && <span> · 参考价 ¥{row.refPrice}</span>}
            {mode === 'retired' && row.growth !== 0 && (
              <span> · {(row.growth * 100).toFixed(1)}%/年</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-strong)' }}>
            {formatCNY(projectedAnnual)}/年
          </div>
          {Math.abs(extraAnnual) > 0.5 && (
            <div style={{ fontSize: 10, color: 'var(--success-text)', fontWeight: 600 }}>
              +{formatCNY(extraAnnual)}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {STEP_OPTIONS.map(step => (
          <button key={`m${step}`}
            onClick={() => onChange(row.shares - step)}
            disabled={row.shares <= 0}
            style={stepBtn}>
            -{step}
          </button>
        ))}
        <input type="number" min={0} step={LOT} value={inputValue}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          style={{
            flex: 1, minWidth: 0, padding: '7px 8px', borderRadius: 8,
            border: '1px solid var(--input-border)', background: 'var(--input-bg)',
            color: 'var(--text)', fontSize: 13, textAlign: 'center', fontWeight: 700, fontFamily: 'inherit',
            boxSizing: 'border-box',
          }} />
        {STEP_OPTIONS.map(step => (
          <button key={`p${step}`}
            onClick={() => onChange(row.shares + step)}
            style={stepBtn}>
            +{step}
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 6, fontSize: 11, color: 'var(--muted)',
      }}>
        <span>
          {row.isNew
            ? '当前 0 股'
            : `当前 ${row.baseShares.toLocaleString()} 股`}
          {!row.isNew && row.savedTarget !== undefined && row.savedTarget !== row.baseShares && (
            <span> · 已存目标 {row.savedTarget.toLocaleString()} 股</span>
          )}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {delta !== 0 && (
            <span style={{ color: delta > 0 ? 'var(--primary-strong)' : 'var(--danger)', fontWeight: 600 }}>
              {delta > 0 ? '+' : ''}{delta.toLocaleString()} 股
              {extraCost > 0 && <span> · 追加 {formatCNY(extraCost)}</span>}
            </span>
          )}
          {onRemove && (
            <button onClick={onRemove} aria-label="移除"
              style={{
                background: 'none', border: 'none', color: 'var(--muted)',
                fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1,
              }}>✕</button>
          )}
        </span>
      </div>
    </div>
  )
}

const stepBtn: React.CSSProperties = {
  padding: '6px 8px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--surface-muted)',
  color: 'var(--text-strong)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', whiteSpace: 'nowrap',
}
