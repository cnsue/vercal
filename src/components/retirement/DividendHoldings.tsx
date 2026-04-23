import { useState } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'
import { DIVIDEND_STOCKS, findDividendStock, dividendYieldPct } from '../../data/dividendStocks'
import { computeHoldingIncome } from '../../utils/retirementCalc'
import { formatCNY } from '../../utils/formatters'
import type { DividendHolding } from '../../types/retirement'

export default function DividendHoldings() {
  const holdings = useRetirementStore(s => s.plan.holdings)
  const addHolding = useRetirementStore(s => s.addHolding)
  const removeHolding = useRetirementStore(s => s.removeHolding)
  const updateHolding = useRetirementStore(s => s.updateHolding)

  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState(DIVIDEND_STOCKS[0].code)
  const [newShares, setNewShares] = useState('')

  function handleAdd() {
    const shares = parseFloat(newShares) || 0
    if (shares <= 0) return
    const ref = findDividendStock(newCode)
    addHolding({
      stockCode: newCode,
      stockName: ref?.name ?? newCode,
      shares,
    })
    setShowAdd(false)
    setNewShares('')
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>股息持仓</div>
        <button onClick={() => setShowAdd(v => !v)} style={addBtn}>
          {showAdd ? '收起' : '＋ 添加'}
        </button>
      </div>

      {holdings.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
          还没添加持仓。点击右上角添加一只高股息股票。
        </div>
      )}

      {holdings.map(h => <HoldingRow key={h.id} holding={h}
        onUpdate={patch => updateHolding(h.id, patch)}
        onRemove={() => removeHolding(h.id)} />)}

      {showAdd && (
        <div style={{ marginTop: 12, padding: 12, background: '#f7f7f7', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>选择股票</div>
          <select value={newCode} onChange={e => setNewCode(e.target.value)} style={inputStyle}>
            {DIVIDEND_STOCKS.map(s => (
              <option key={s.code} value={s.code}>
                {s.name}（{s.code}）· ¥{s.dividendPerShare.toFixed(3)}/股 · 股息率 {dividendYieldPct(s).toFixed(2)}%
              </option>
            ))}
          </select>
          {(() => {
            const ref = findDividendStock(newCode)
            if (!ref) return null
            return (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                数据口径：{ref.asOfYear} 年度 · 参考价 ¥{ref.referencePrice}（{ref.priceAsOf}）
                {ref.disclosureNote && (
                  <div style={{ marginTop: 4, color: '#8a4b1a' }}>⚠️ {ref.disclosureNote}</div>
                )}
              </div>
            )
          })()}
          <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 6px' }}>持股数（股）</div>
          <input type="number" placeholder="例如 1000" value={newShares}
            onChange={e => setNewShares(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...btn, flex: 1, background: '#eee', color: '#555' }}>取消</button>
            <button onClick={handleAdd} style={{ ...btn, flex: 2, background: '#1a3a2a', color: '#fff' }}>添加</button>
          </div>
        </div>
      )}

      {holdings.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: '#f0f9f5', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>年股息合计（税前）</span>
            <span style={{ fontWeight: 700 }}>
              {formatCNY(holdings.reduce((s, h) => s + computeHoldingIncome(h).grossAnnual, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function HoldingRow({ holding, onUpdate, onRemove }: {
  holding: DividendHolding
  onUpdate: (patch: Partial<DividendHolding>) => void
  onRemove: () => void
}) {
  const income = computeHoldingIncome(holding)
  const [editing, setEditing] = useState(false)
  const [sharesInput, setSharesInput] = useState(String(holding.shares))
  const [dpsInput, setDpsInput] = useState(String(income.dividendPerShare))

  function save() {
    onUpdate({
      shares: parseFloat(sharesInput) || 0,
      dividendPerShareOverride: parseFloat(dpsInput) || undefined,
    })
    setEditing(false)
  }

  return (
    <div style={{ padding: 12, background: '#fff', border: '1px solid #eee', borderRadius: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{holding.stockName}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>{holding.stockCode}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e6845' }}>
          {formatCNY(income.grossAnnual)}/年
        </div>
      </div>

      {editing ? (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>持股数</div>
              <input type="number" value={sharesInput} onChange={e => setSharesInput(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>每股股息(元)</div>
              <input type="number" step="0.01" value={dpsInput} onChange={e => setDpsInput(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ ...btn, flex: 1, background: '#eee', color: '#555' }}>取消</button>
            <button onClick={onRemove} style={{ ...btn, flex: 1, background: '#fee', color: '#c0392b' }}>删除</button>
            <button onClick={save} style={{ ...btn, flex: 2, background: '#1a3a2a', color: '#fff' }}>保存</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
          <span>
            {holding.shares.toLocaleString()} 股 × ¥{income.dividendPerShare.toFixed(3)}/股
            {income.yieldPct > 0 && (
              <span style={{ marginLeft: 6, color: '#1e6845', fontWeight: 600 }}>
                股息率 {income.yieldPct.toFixed(2)}%
              </span>
            )}
          </span>
          <button onClick={() => { setSharesInput(String(holding.shares)); setDpsInput(String(income.dividendPerShare)); setEditing(true) }}
            style={{ background: 'none', border: 'none', color: '#1e6845', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            编辑
          </button>
        </div>
      )}
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14,
}
const addBtn: React.CSSProperties = {
  background: '#1a3a2a', color: '#fff', border: 'none',
  padding: '6px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
}
const btn: React.CSSProperties = {
  padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
}
