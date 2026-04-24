import { useEffect, useMemo, useState } from 'react'
import { useRetirementStore } from '../store/useRetirementStore'
import { useAssetStore } from '../store/useAssetStore'
import CoverageHero from '../components/retirement/CoverageHero'
import DimensionDetailSheet from '../components/retirement/DimensionDetailSheet'
import DividendHoldings from '../components/retirement/DividendHoldings'
import DecentStandardEditor from '../components/retirement/DecentStandardEditor'
import DonutChart, { type BreakdownItem } from '../components/charts/DonutChart'
import { formatCNY } from '../utils/formatters'
import {
  computeDividendSummary, projectDividendSummary,
  computePensionProjection, computeCoverage,
  computeGap, computeHoldingIncome, safeWithdrawMonthly,
  computeDimensionCoverage,
} from '../utils/retirementCalc'
import { findPensionCity } from '../data/pensionCities'
import { findDividendStock } from '../data/dividendStocks'
import type { DividendGrowthScenario, DividendHolding } from '../types/retirement'
import { DIVIDEND_SCENARIO_LABELS } from '../types/retirement'

export default function RetirementPage() {
  const plan = useRetirementStore(s => s.plan)
  const snapshots = useAssetStore(s => s.snapshots)
  const totalAssets = snapshots[0]?.totalValueCNY ?? 0

  const [showDecentEditor, setShowDecentEditor] = useState(false)
  const [showOtherEditor, setShowOtherEditor] = useState(false)
  const [detailDimId, setDetailDimId] = useState<string | null>(null)

  const dividend = useMemo(() => computeDividendSummary(plan.holdings), [plan.holdings])
  const pension = useMemo(() => computePensionProjection(plan.pension), [plan.pension])
  const projectedDividend = useMemo(
    () => projectDividendSummary(plan.holdings, plan.dividendScenario, pension.yearsToRetire),
    [plan.holdings, plan.dividendScenario, pension.yearsToRetire],
  )
  const coverage = useMemo(
    () => computeCoverage(plan, dividend, pension, projectedDividend),
    [plan, dividend, pension, projectedDividend],
  )
  const gap = useMemo(() => computeGap(coverage), [coverage])
  const safeMonthly = safeWithdrawMonthly(totalAssets)
  const dimensions = useMemo(
    () => computeDimensionCoverage(plan.decentStandard.breakdown, coverage.retiredMonthly),
    [plan.decentStandard.breakdown, coverage.retiredMonthly],
  )

  // 首次进入：未设置任何维度预算时自动拉起向导
  useEffect(() => {
    if (plan.decentStandard.breakdown.length === 0 && plan.decentStandard.monthlyAmount === 0) {
      setShowDecentEditor(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dividendMultiplier = dividend.netAnnual > 0
    ? projectedDividend.netAnnual / dividend.netAnnual
    : 1

  const incomeItems: BreakdownItem[] = useMemo(() => {
    const items = [
      { name: '股息', value: coverage.breakdown.dividend * 12 },
      { name: '养老金', value: coverage.breakdown.pension * 12 },
      { name: '其他被动', value: coverage.breakdown.other * 12 },
    ].filter(i => i.value > 0)
    const total = items.reduce((s, i) => s + i.value, 0) || 1
    return items.map(i => ({ ...i, weight: (i.value / total) * 100 }))
  }, [coverage])

  const city = findPensionCity(plan.pension.cityKey)
  const pensionConfigured = pension.totalMonths > 0

  return (
    <div style={{ padding: '0 0 16px' }}>
      <CoverageHero
        decentMonthly={coverage.decentMonthly}
        nowRatio={coverage.nowRatio}
        retiredRatio={coverage.retiredRatio}
        nowMonthly={coverage.nowMonthly}
        retiredMonthly={coverage.retiredMonthly}
        onEdit={() => setShowDecentEditor(true)}
        dimensions={coverage.decentMonthly > 0 ? dimensions : []}
        onDimensionClick={id => setDetailDimId(id)}
      />

      <ScenarioSelector
        years={pension.yearsToRetire}
        multiplier={dividendMultiplier}
        hasHoldings={plan.holdings.length > 0}
        holdings={plan.holdings}
      />

      {/* 收入构成 */}
      {incomeItems.length > 0 ? (
        <Section title="养老现金流构成（年）">
          <DonutChart items={incomeItems} title="年被动收入来源" />
        </Section>
      ) : (
        <Section title="养老现金流构成">
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
            添加股息持仓或配置养老金后显示
          </div>
        </Section>
      )}

      {/* 股息持仓 */}
      <DividendHoldings />

      {/* 养老金预估 */}
      <Section title="养老金预估">
        {!pensionConfigured ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
            去「设置 → 养老金信息」录入城市与缴费信息后，这里会显示预计月养老金。
          </div>
        ) : (
          <div>
            <StatRow label="预计月养老金" value={formatCNY(pension.monthlyTotal)} accent />
            <StatRow label="  · 基础养老金" value={formatCNY(pension.basicPension)} />
            <StatRow label="  · 个人账户养老金" value={formatCNY(pension.personalAccountPension)} />
            <div style={{ height: 8 }} />
            <StatRow label="缴费城市" value={city?.name ?? plan.pension.cityKey} />
            <StatRow label="累计缴费" value={`${(pension.totalMonths / 12).toFixed(1)} 年`} />
            <StatRow label="加权缴费指数" value={pension.weightedIndex.toFixed(4)} />
            <StatRow label="实际退休年龄" value={`${pension.actualRetirementYears} 岁 ${pension.actualRetirementExtraMonths} 月`} />
            <StatRow label="退休年月" value={pension.retirementYearMonth} />
            <StatRow label="退休时社平工资" value={`${formatCNY(pension.projectedSocialWage)}/月`} />
            <StatRow label="预计退休时个人账户" value={formatCNY(pension.projectedPersonalBalance)} />
            <StatRow label="个人账户计发月数" value={pension.personalAccountPayoutMonths.toFixed(1)} />
            <div style={{ marginTop: 10, padding: 10, background: 'var(--warning-bg)', borderRadius: 8, fontSize: 11, color: 'var(--warning-text)' }}>
              MVP 简化公式：未考虑过渡性养老金、地方性补贴、缴费基数上下限等。精确数额以各地人社局测算为准。
            </div>
          </div>
        )}
      </Section>

      {/* 缺口分析 / 建议 */}
      {coverage.decentMonthly > 0 && (
        <Section title="缺口分析与建议">
          {gap.gapMonthly <= 0 ? (
            <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, fontSize: 13, color: 'var(--success-text)', fontWeight: 600 }}>
              当前预估被动收入已覆盖体面标准。可以考虑把多出的现金流用于再投入或调高体面标准。
            </div>
          ) : (
            <div>
              <StatRow label="月缺口" value={formatCNY(gap.gapMonthly)} accent />
              <StatRow label="年缺口" value={formatCNY(gap.gapAnnual)} />
              <div style={{ marginTop: 10, padding: 12, background: 'var(--warning-bg)', borderRadius: 10, fontSize: 13, lineHeight: 1.6 }}>
                若按 <strong>{(gap.referenceYield * 100).toFixed(0)}%</strong> 参考股息率估算，还需增加约
                <strong style={{ color: 'var(--danger)' }}> {formatCNY(gap.extraPrincipalAtReferenceYield)} </strong>
                高股息本金，才能把月现金流拉平到体面标准。
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                建议关注红利低波、大行银行股、公用事业（如长江电力）等稳定分红标的。
              </div>
            </div>
          )}
        </Section>
      )}

      {/* 4% 参考 */}
      {totalAssets > 0 && (
        <Section title="安全提现率参考（4% 法则）">
          <StatRow label="总资产" value={formatCNY(totalAssets)} />
          <StatRow label="可安全提取月金额" value={formatCNY(safeMonthly)} accent />
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            4% 法则来自美国历史回测，假设股债 60/40，长期年均 4% 提取大概率不会耗尽本金，仅供参考。
          </div>
        </Section>
      )}

      {/* 其它被动收入 */}
      <Section title="其它被动收入">
        {plan.otherIncomes.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
            暂未添加。如有租金、年金、版税等，点击下方添加。
          </div>
        ) : (
          plan.otherIncomes.map(o => (
            <OtherIncomeRow key={o.id} id={o.id} name={o.name} monthly={o.monthlyAmount} />
          ))
        )}
        <button onClick={() => setShowOtherEditor(true)} style={{
          width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: '1px dashed var(--border-dashed)',
          background: 'var(--surface-subtle)', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          ＋ 添加一条被动收入
        </button>
      </Section>

      <DecentStandardEditor open={showDecentEditor} onClose={() => setShowDecentEditor(false)} />
      <OtherIncomeEditor open={showOtherEditor} onClose={() => setShowOtherEditor(false)} />
      {detailDimId && (() => {
        const dim = dimensions.find(d => d.id === detailDimId)
        return dim ? <DimensionDetailSheet dim={dim} onClose={() => setDetailDimId(null)} /> : null
      })()}
    </div>
  )
}

function ScenarioSelector({ years, multiplier, hasHoldings, holdings }: {
  years: number; multiplier: number; hasHoldings: boolean; holdings: DividendHolding[]
}) {
  const current = useRetirementStore(s => s.plan.dividendScenario)
  const setScenario = useRetirementStore(s => s.setDividendScenario)
  const sourceRows = holdings.map(h => {
    const ref = findDividendStock(h.stockCode)
    const income = computeHoldingIncome(h)
    return {
      id: h.id,
      name: h.stockName,
      code: h.stockCode,
      source: h.dividendPerShareOverride === undefined
        ? (ref ? `内置表 ${ref.asOfYear} 年度` : '未收录，按持仓数据')
        : '手动覆盖每股股息',
      dividendPerShare: income.dividendPerShare,
      netAnnual: income.netAnnual,
      growth: ref?.growth?.[current] ?? 0,
    }
  })
  const totalNetAnnual = sourceRows.reduce((sum, row) => sum + row.netAnnual, 0)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 14, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>📈 股息增长预期</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>影响「退休后」口径</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(Object.keys(DIVIDEND_SCENARIO_LABELS) as DividendGrowthScenario[]).map(k => (
          <button key={k} onClick={() => setScenario(k)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: current === k ? 'var(--primary)' : 'var(--button-secondary-bg)',
              color: current === k ? '#fff' : 'var(--button-secondary-text)',
            }}>
            {DIVIDEND_SCENARIO_LABELS[k]}
          </button>
        ))}
      </div>
      {hasHoldings && years > 0.1 && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
          按此场景，持仓在 <strong>{years.toFixed(1)}</strong> 年后股息合计约增长至今之{' '}
          <strong style={{ color: 'var(--primary)' }}>{multiplier.toFixed(2)}×</strong>
          （不同股票按其历史 CAGR 加权）
        </div>
      )}
      {hasHoldings && (
        <details style={{
          marginTop: 10, padding: 10, background: 'var(--surface-muted)', borderRadius: 10,
          fontSize: 11, color: 'var(--muted)', lineHeight: 1.6,
        }}>
          <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 700 }}>
            加权数据来源与计算规则
          </summary>
          <div style={{ marginTop: 8 }}>
            {sourceRows.map(row => {
              const weight = totalNetAnnual > 0 ? row.netAnnual / totalNetAnnual : 0
              return (
                <div key={row.id} style={{
                  padding: '7px 0', borderTop: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', gap: 10,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--button-secondary-text)', fontWeight: 700 }}>
                      {row.name} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{row.code}</span>
                    </div>
                    <div>
                      {row.source} · 每股 ¥{row.dividendPerShare.toFixed(3)} · 权重 {(weight * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ color: 'var(--primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {(row.growth * 100).toFixed(2)}%/年
                  </div>
                </div>
              )
            })}
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 16 }}>
            <li>权重 = 单只当前税后年股息 ÷ 全部当前税后年股息。</li>
            <li>退休后股息 = 当前税后年股息 × (1 + 当前场景增长率) ^ 距退休年数。</li>
            <li>总倍率 = 全部退休后税后年股息合计 ÷ 当前税后年股息合计。</li>
            <li>内置增长率基于近 5-10 年分红 CAGR 与行业周期粗估；未收录股票按 0% 处理。</li>
          </ul>
        </details>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: accent ? 800 : 600, color: accent ? 'var(--primary)' : 'var(--text-strong)', fontSize: accent ? 15 : 13 }}>{value}</span>
    </div>
  )
}

function OtherIncomeRow({ id, name, monthly }: { id: string; name: string; monthly: number }) {
  const removeOtherIncome = useRetirementStore(s => s.removeOtherIncome)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'var(--surface-muted)', borderRadius: 8, marginBottom: 6 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatCNY(monthly)}/月</div>
      </div>
      <button onClick={() => removeOtherIncome(id)}
        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}>
        删除
      </button>
    </div>
  )
}

function OtherIncomeEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addOtherIncome = useRetirementStore(s => s.addOtherIncome)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  if (!open) return null

  function save() {
    const num = parseFloat(amount) || 0
    if (!name.trim() || num <= 0) return
    addOtherIncome({ name: name.trim(), monthlyAmount: num })
    setName(''); setAmount('')
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>添加被动收入</div>
        <input placeholder="名称，例如：房租 / 年金" value={name} onChange={e => setName(e.target.value)}
          style={inputStyle} />
        <div style={{ height: 10 }} />
        <input type="number" placeholder="月金额（元）" value={amount} onChange={e => setAmount(e.target.value)}
          style={inputStyle} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', cursor: 'pointer', fontWeight: 600 }}>取消</button>
          <button onClick={save} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>保存</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 16, boxSizing: 'border-box', fontFamily: 'inherit',
}
