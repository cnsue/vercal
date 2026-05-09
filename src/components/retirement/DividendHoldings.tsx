import { useState, type CSSProperties } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'
import {
  DIVIDEND_STOCKS,
  findDividendStock,
  dividendYieldPct,
  getDividendAssets,
  dividendUnitLabel,
  dividendPerUnitLabel,
  type DividendAssetCategory,
  type DividendAssetRef,
  type DividendAssetType,
} from '../../data/dividendStocks'
import { computeHoldingIncome, projectHoldingIncomeByResearch } from '../../utils/retirementCalc'
import { formatCNY } from '../../utils/formatters'
import DonutChart, { type BreakdownItem } from '../charts/DonutChart'
import type { DividendHolding } from '../../types/retirement'

const ASSET_CATEGORIES: DividendAssetCategory[] = ['银行', '能源', '基建', '消费', '通信', '红利ETF', '宽基ETF', '行业ETF', '其它']

interface AssetCandidate {
  code: string
  name: string
  assetType: DividendAssetType
  exchange?: string
  sourceProvider?: string
}

type AssetDraft = Pick<
  DividendAssetRef,
  'code' | 'name' | 'assetType' | 'category' | 'referencePrice' | 'priceAsOf' |
  'dividendPerShare' | 'asOfYear' | 'sourceProvider' | 'sourceAsOf' | 'sourceNote' | 'growth'
>

export default function DividendHoldings() {
  const holdings = useRetirementStore(s => s.plan.holdings)
  const customAssets = useRetirementStore(s => s.plan.customDividendAssets)
  const addHolding = useRetirementStore(s => s.addHolding)
  const removeHolding = useRetirementStore(s => s.removeHolding)
  const updateHolding = useRetirementStore(s => s.updateHolding)
  const addCustomDividendAsset = useRetirementStore(s => s.addCustomDividendAsset)
  const updateCustomDividendAsset = useRetirementStore(s => s.updateCustomDividendAsset)
  const removeCustomDividendAsset = useRetirementStore(s => s.removeCustomDividendAsset)

  const assets = getDividendAssets(customAssets)
  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState(DIVIDEND_STOCKS[0].code)
  const [newShares, setNewShares] = useState('')
  const targetGapItems = buildTargetGapItems(holdings, customAssets)

  function handleAdd() {
    const shares = parseFloat(newShares) || 0
    if (shares <= 0) return
    const ref = findDividendStock(newCode, customAssets)
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
          还没添加持仓。点击右上角添加一只高股息股票或 ETF。
        </div>
      )}

      {targetGapItems.length > 0 && (
        <div style={{
          marginBottom: 12, padding: 12, background: 'var(--surface-muted)',
          border: '1px solid var(--border)', borderRadius: 12,
        }}>
          <DonutChart items={targetGapItems} title="各标的目标资金缺口" />
        </div>
      )}

      {holdings.map(h => <HoldingRow key={h.id} holding={h} customAssets={customAssets}
        onUpdate={patch => updateHolding(h.id, patch)}
        onRemove={() => removeHolding(h.id)} />)}

      {showAdd && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-muted)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>选择标的</div>
          <select value={newCode} onChange={e => setNewCode(e.target.value)} style={inputStyle}>
            {assets.map(s => {
              const unit = dividendUnitLabel(s)
              return (
                <option key={s.code} value={s.code}>
                  {s.name}（{s.code}）· {s.assetType === 'etf' ? 'ETF' : '股票'} · ¥{s.dividendPerShare.toFixed(3)}/{unit} · 股息率 {dividendYieldPct(s).toFixed(2)}%
                </option>
              )
            })}
          </select>
          {(() => {
            const ref = findDividendStock(newCode, customAssets)
            if (!ref) return null
            return (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                数据口径：{ref.asOfYear} · 参考价 ¥{ref.referencePrice}（{ref.priceAsOf}）
                {ref.sourceProvider && (
                  <div>来源：{ref.sourceProvider}{ref.sourceAsOf ? ` · ${ref.sourceAsOf}` : ''}</div>
                )}
                {ref.sourceNote && <div>{ref.sourceNote}</div>}
                {ref.disclosureNote && (
                  <div style={{ marginTop: 4, color: 'var(--warning-text)' }}>⚠️ {ref.disclosureNote}</div>
                )}
              </div>
            )
          })()}
          <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 6px' }}>
            持有数量（{dividendUnitLabel(findDividendStock(newCode, customAssets))}）
          </div>
          <input type="number" placeholder="例如 1000" value={newShares}
            onChange={e => setNewShares(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...btn, flex: 1, background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}>取消</button>
            <button onClick={handleAdd} style={{ ...btn, flex: 2, background: 'var(--primary)', color: '#fff' }}>添加持仓</button>
          </div>

          <AssetSearchBox
            onSave={asset => {
              addCustomDividendAsset(asset)
              setNewCode(asset.code)
            }}
          />
          {customAssets.length > 0 && (
            <CustomAssetList
              assets={customAssets}
              holdings={holdings}
              onUpdate={updateCustomDividendAsset}
              onRemove={removeCustomDividendAsset}
            />
          )}
        </div>
      )}

      {holdings.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--primary-soft)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--muted)' }}>年股息/分派合计（税前）</span>
            <span style={{ fontWeight: 700 }}>
              {formatCNY(holdings.reduce((s, h) => s + computeHoldingIncome(h, customAssets).grossAnnual, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function buildTargetGapItems(holdings: DividendHolding[], customAssets: DividendAssetRef[]): BreakdownItem[] {
  const gapsByCode = new Map<string, { name: string; value: number }>()

  holdings.forEach(h => {
    if (h.targetShares === undefined) return
    const delta = h.targetShares - h.shares
    const refPrice = findDividendStock(h.stockCode, customAssets)?.referencePrice ?? 0
    const value = Math.max(0, delta) * refPrice
    if (value <= 0) return

    const existing = gapsByCode.get(h.stockCode)
    if (existing) {
      existing.value += value
    } else {
      gapsByCode.set(h.stockCode, { name: h.stockName, value })
    }
  })

  const rows = Array.from(gapsByCode.values()).sort((a, b) => b.value - a.value)
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1
  return rows.map(row => ({ ...row, weight: (row.value / total) * 100 }))
}

function HoldingRow({ holding, customAssets, onUpdate, onRemove }: {
  holding: DividendHolding
  customAssets: DividendAssetRef[]
  onUpdate: (patch: Partial<DividendHolding>) => void
  onRemove: () => void
}) {
  const ref = findDividendStock(holding.stockCode, customAssets)
  const unit = dividendUnitLabel(ref)
  const perUnitLabel = dividendPerUnitLabel(ref)
  const income = computeHoldingIncome(holding, customAssets)
  const researchProjection = projectHoldingIncomeByResearch(holding, customAssets)
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
    <div style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{holding.stockName}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>{holding.stockCode}</span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary-strong)' }}>
            {formatCNY(income.grossAnnual)}/年
          </div>
          <div style={{ marginTop: 2, fontSize: 11, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {researchProjection
              ? `研报${researchProjection.yearsForward}年后约 ${formatCNY(researchProjection.income.grossAnnual)}/年`
              : '研报股息预测暂无'}
          </div>
        </div>
      </div>

      {editing ? (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>持有数量（{unit}）</div>
              <input type="number" value={sharesInput} onChange={e => setSharesInput(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{perUnitLabel}(元)</div>
              <input type="number" step="0.01" value={dpsInput} onChange={e => setDpsInput(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ ...btn, flex: 1, background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}>取消</button>
            <button onClick={onRemove} style={{ ...btn, flex: 1, background: 'var(--danger-bg)', color: 'var(--danger)' }}>删除</button>
            <button onClick={save} style={{ ...btn, flex: 2, background: 'var(--primary)', color: '#fff' }}>保存</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <span>
              {holding.shares.toLocaleString()} {unit} × ¥{income.dividendPerShare.toFixed(3)}/{unit}
              {income.yieldPct > 0 && (
                <span style={{ marginLeft: 6, color: 'var(--primary-strong)', fontWeight: 600 }}>
                  股息率 {income.yieldPct.toFixed(2)}%
                </span>
              )}
            </span>
            <button onClick={() => { setSharesInput(String(holding.shares)); setDpsInput(String(income.dividendPerShare)); setEditing(true) }}
              style={{ background: 'none', border: 'none', color: 'var(--primary-strong)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              编辑
            </button>
          </div>
          {holding.targetShares !== undefined && (
            <TargetBadge
              shares={holding.shares}
              targetShares={holding.targetShares}
              refPrice={ref?.referencePrice ?? 0}
              unit={unit}
              onClear={() => onUpdate({ targetShares: undefined })} />
          )}
        </>
      )}
    </div>
  )
}

function AssetSearchBox({ onSave }: { onSave: (asset: DividendAssetRef) => void }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState<AssetCandidate[]>([])
  const [draft, setDraft] = useState<AssetDraft | null>(null)

  async function search() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError('')
    setDraft(null)
    try {
      const res = await fetch(`/api/assets/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '搜索失败')
      setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setCandidates([])
    } finally {
      setLoading(false)
    }
  }

  async function resolve(candidate: AssetCandidate) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        code: candidate.code,
        name: candidate.name,
        assetType: candidate.assetType,
      })
      if (candidate.exchange) params.set('exchange', candidate.exchange)
      const res = await fetch(`/api/assets/resolve?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '解析失败')
      setDraft(normalizeDraft(data.asset))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function updateDraft<K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function saveDraft() {
    if (!draft) return
    const asset: DividendAssetRef = {
      code: draft.code.trim(),
      name: draft.name.trim(),
      assetType: draft.assetType,
      category: draft.category,
      referencePrice: Number(draft.referencePrice) || 0,
      priceAsOf: draft.priceAsOf || new Date().toISOString().slice(0, 10),
      dividendPerShare: Number(draft.dividendPerShare) || 0,
      asOfYear: draft.asOfYear || '用户确认',
      sourceProvider: draft.sourceProvider || '用户确认',
      sourceAsOf: draft.sourceAsOf || new Date().toISOString().slice(0, 10),
      sourceNote: draft.sourceNote,
      growth: {
        pessimistic: Number(draft.growth.pessimistic) || 0,
        neutral: Number(draft.growth.neutral) || 0,
        optimistic: Number(draft.growth.optimistic) || 0,
      },
    }
    if (!asset.code || !asset.name) return
    onSave(asset)
    setDraft(null)
    setCandidates([])
    setQuery('')
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>搜索新增标的</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search() }}
          placeholder="输入股票/ETF 代码或名称" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={search} disabled={loading || !query.trim()} style={{
          ...btn, width: 74, background: 'var(--primary)', color: '#fff',
          opacity: loading || !query.trim() ? 0.5 : 1,
        }}>{loading ? '查询中' : '搜索'}</button>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        名称和参考价来自确定性接口；分红、分派和增长假设保存前需要人工确认。
      </div>
      {error && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--danger)' }}>{error}</div>}
      {candidates.length > 0 && (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {candidates.map(c => (
            <button key={`${c.assetType}-${c.exchange ?? ''}-${c.code}`} onClick={() => resolve(c)} style={{
              textAlign: 'left', padding: 9, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{c.code}</span></div>
              <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>
                {c.assetType === 'etf' ? 'ETF' : '股票'}{c.exchange ? ` · ${c.exchange}` : ''}{c.sourceProvider ? ` · ${c.sourceProvider}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      {draft && (
        <div style={{
          marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--surface)', display: 'grid', gap: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800 }}>确认本地标的数据</div>
          <DraftText label="名称" value={draft.name} onChange={v => updateDraft('name', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DraftText label="代码" value={draft.code} onChange={v => updateDraft('code', v)} />
            <label>
              <div style={draftLabel}>类型</div>
              <select value={draft.assetType} onChange={e => updateDraft('assetType', e.target.value as DividendAssetType)} style={inputStyle}>
                <option value="stock">股票</option>
                <option value="etf">ETF</option>
              </select>
            </label>
          </div>
          <label>
            <div style={draftLabel}>分类</div>
            <select value={draft.category} onChange={e => updateDraft('category', e.target.value as DividendAssetCategory)} style={inputStyle}>
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DraftNumber label="参考价（接口获取）" value={draft.referencePrice} onChange={v => updateDraft('referencePrice', v)} />
            <DraftText label="价格日期（接口获取）" value={draft.priceAsOf} onChange={v => updateDraft('priceAsOf', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <DraftNumber label={`${draft.assetType === 'etf' ? '每份分派' : '每股股息'}（手填确认）`} value={draft.dividendPerShare} onChange={v => updateDraft('dividendPerShare', v)} />
            <DraftText label="分红/分派口径" value={draft.asOfYear} onChange={v => updateDraft('asOfYear', v)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <DraftNumber label="悲观增长" value={draft.growth.pessimistic * 100} onChange={v => updateDraft('growth', { ...draft.growth, pessimistic: v / 100 })} />
            <DraftNumber label="中立增长" value={draft.growth.neutral * 100} onChange={v => updateDraft('growth', { ...draft.growth, neutral: v / 100 })} />
            <DraftNumber label="乐观增长" value={draft.growth.optimistic * 100} onChange={v => updateDraft('growth', { ...draft.growth, optimistic: v / 100 })} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
            来源：{draft.sourceProvider || '未标明'}{draft.sourceAsOf ? ` · ${draft.sourceAsOf}` : ''}
            {draft.sourceNote && <div>{draft.sourceNote}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setDraft(null)} style={{ ...btn, flex: 1, background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}>取消</button>
            <button onClick={saveDraft} style={{ ...btn, flex: 2, background: 'var(--primary)', color: '#fff' }}>保存到本地库</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CustomAssetList({ assets, holdings, onUpdate, onRemove }: {
  assets: DividendAssetRef[]
  holdings: DividendHolding[]
  onUpdate: (code: string, patch: Partial<DividendAssetRef>) => void
  onRemove: (code: string) => void
}) {
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>本地自定义标的</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {assets.map(asset => {
          const used = holdings.some(h => h.stockCode === asset.code)
          return (
            <div key={asset.code} style={{ padding: 9, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{asset.name} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{asset.code}</span></div>
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--muted)' }}>
                    {asset.assetType === 'etf' ? 'ETF' : '股票'} · ¥{asset.dividendPerShare.toFixed(3)}/{dividendUnitLabel(asset)} · {asset.sourceProvider ?? '用户确认'}
                  </div>
                </div>
                <button onClick={() => !used && onRemove(asset.code)} disabled={used} style={{
                  border: 'none', background: 'none', color: used ? 'var(--muted)' : 'var(--danger)',
                  cursor: used ? 'not-allowed' : 'pointer', fontSize: 12, flexShrink: 0,
                }}>{used ? '持仓中' : '删除'}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <DraftNumber label="参考价" value={asset.referencePrice} onChange={v => onUpdate(asset.code, { referencePrice: v })} />
                <DraftNumber label={dividendPerUnitLabel(asset)} value={asset.dividendPerShare} onChange={v => onUpdate(asset.code, { dividendPerShare: v })} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function normalizeDraft(raw: Partial<AssetDraft>): AssetDraft {
  const assetType = raw.assetType === 'etf' ? 'etf' : 'stock'
  return {
    code: raw.code ?? '',
    name: raw.name ?? raw.code ?? '',
    assetType,
    category: raw.category ?? (assetType === 'etf' ? '红利ETF' : '其它'),
    referencePrice: Number(raw.referencePrice) || 0,
    priceAsOf: raw.priceAsOf ?? new Date().toISOString().slice(0, 10),
    dividendPerShare: Number(raw.dividendPerShare) || 0,
    asOfYear: raw.asOfYear ?? '用户确认',
    sourceProvider: raw.sourceProvider ?? '确定性接口',
    sourceAsOf: raw.sourceAsOf ?? new Date().toISOString().slice(0, 10),
    sourceNote: raw.sourceNote,
    growth: raw.growth ?? {
      pessimistic: 0,
      neutral: assetType === 'etf' ? 0 : 0.03,
      optimistic: assetType === 'etf' ? 0.02 : 0.05,
    },
  }
}

function DraftText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <div style={draftLabel}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </label>
  )
}

function DraftNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label>
      <div style={draftLabel}>{label}</div>
      <input type="number" step="0.001" value={Number.isFinite(value) ? value : 0}
        onChange={e => onChange(parseFloat(e.target.value) || 0)} style={inputStyle} />
    </label>
  )
}

function TargetBadge({ shares, targetShares, refPrice, unit, onClear }: {
  shares: number
  targetShares: number
  refPrice: number
  unit: string
  onClear: () => void
}) {
  const delta = targetShares - shares
  const reached = delta <= 0
  const extraCost = Math.max(0, delta) * refPrice

  return (
    <div style={{
      marginTop: 8, padding: '6px 10px', borderRadius: 8,
      background: reached ? 'var(--success-bg)' : 'var(--warning-bg)',
      color: reached ? 'var(--success-text)' : 'var(--warning-text)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      fontSize: 11, lineHeight: 1.4,
    }}>
      <span style={{ minWidth: 0 }}>
        🎯 目标 <strong>{targetShares.toLocaleString()}</strong> {unit}
        {reached ? (
          <span style={{ marginLeft: 6, fontWeight: 700 }}>· 已达目标</span>
        ) : (
          <span style={{ marginLeft: 6 }}>
            · 还差 <strong>+{delta.toLocaleString()}</strong> {unit}
            {extraCost > 0 && <span> · 追加约 {formatCNY(extraCost)}</span>}
          </span>
        )}
      </span>
      <button onClick={onClear} aria-label="清除目标" style={{
        background: 'none', border: 'none', color: 'inherit', opacity: 0.7,
        fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0,
      }}>✕</button>
    </div>
  )
}

const cardStyle: CSSProperties = {
  background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 14,
}
const addBtn: CSSProperties = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  padding: '6px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const inputStyle: CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit',
}
const btn: CSSProperties = {
  padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
}
const draftLabel: CSSProperties = {
  fontSize: 11, color: 'var(--muted)', marginBottom: 3,
}
