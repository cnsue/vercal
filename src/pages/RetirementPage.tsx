import { useMemo, useState } from 'react'
import { useRetirementStore } from '../store/useRetirementStore'
import { useAssetStore } from '../store/useAssetStore'
import CoverageHero from '../components/retirement/CoverageHero'
import DividendHoldings from '../components/retirement/DividendHoldings'
import DecentStandardEditor from '../components/retirement/DecentStandardEditor'
import DonutChart, { type BreakdownItem } from '../components/charts/DonutChart'
import { formatCNY } from '../utils/formatters'
import {
  computeDividendSummary, computePensionProjection, computeCoverage,
  computeGap, safeWithdrawMonthly,
} from '../utils/retirementCalc'
import { findPensionCity } from '../data/pensionCities'

export default function RetirementPage() {
  const plan = useRetirementStore(s => s.plan)
  const snapshots = useAssetStore(s => s.snapshots)
  const totalAssets = snapshots[0]?.totalValueCNY ?? 0

  const [showDecentEditor, setShowDecentEditor] = useState(false)
  const [showOtherEditor, setShowOtherEditor] = useState(false)

  const dividend = useMemo(() => computeDividendSummary(plan.holdings), [plan.holdings])
  const pension = useMemo(() => computePensionProjection(plan.pension), [plan.pension])
  const coverage = useMemo(() => computeCoverage(plan, dividend, pension), [plan, dividend, pension])
  const gap = useMemo(() => computeGap(coverage), [coverage])
  const safeMonthly = safeWithdrawMonthly(totalAssets)

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
  const pensionConfigured = plan.pension.yearsContributed + plan.pension.plannedFutureYears > 0

  return (
    <div style={{ padding: '0 0 80px' }}>
      <CoverageHero
        ratio={coverage.ratio}
        decentMonthly={coverage.decentMonthly}
        monthlyIncome={coverage.monthlyIncome}
        variant="full"
        onEdit={() => setShowDecentEditor(true)}
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
            <StatRow label="累计缴费年限" value={`${pension.totalYears} 年`} />
            <StatRow label="退休时社平工资" value={`${formatCNY(pension.projectedSocialWage)}/月`} />
            <StatRow label="预计退休时个人账户" value={formatCNY(pension.projectedPersonalBalance)} />
            <div style={{ marginTop: 10, padding: 10, background: '#fff7ed', borderRadius: 8, fontSize: 11, color: '#8a4b1a' }}>
              MVP 简化公式：未考虑过渡性养老金、地方性补贴、缴费基数上下限等。精确数额以各地人社局测算为准。
            </div>
          </div>
        )}
      </Section>

      {/* 缺口分析 / 建议 */}
      {coverage.decentMonthly > 0 && (
        <Section title="缺口分析与建议">
          {gap.gapMonthly <= 0 ? (
            <div style={{ padding: 12, background: '#f0f9f5', border: '1px solid #c8e8d7', borderRadius: 10, fontSize: 13, color: '#166c3b', fontWeight: 600 }}>
              当前预估被动收入已覆盖体面标准。可以考虑把多出的现金流用于再投入或调高体面标准。
            </div>
          ) : (
            <div>
              <StatRow label="月缺口" value={formatCNY(gap.gapMonthly)} accent />
              <StatRow label="年缺口" value={formatCNY(gap.gapAnnual)} />
              <div style={{ marginTop: 10, padding: 12, background: '#fff7ed', borderRadius: 10, fontSize: 13, lineHeight: 1.6 }}>
                若按 <strong>{(gap.referenceYield * 100).toFixed(0)}%</strong> 参考股息率估算，还需增加约
                <strong style={{ color: '#c0392b' }}> {formatCNY(gap.extraPrincipalAtReferenceYield)} </strong>
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
          width: '100%', marginTop: 8, padding: 10, borderRadius: 10, border: '1px dashed #ccc',
          background: '#fafafa', color: '#555', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          ＋ 添加一条被动收入
        </button>
      </Section>

      <DecentStandardEditor open={showDecentEditor} onClose={() => setShowDecentEditor(false)} />
      <OtherIncomeEditor open={showOtherEditor} onClose={() => setShowOtherEditor(false)} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: accent ? 800 : 600, color: accent ? '#1a3a2a' : '#222', fontSize: accent ? 15 : 13 }}>{value}</span>
    </div>
  )
}

function OtherIncomeRow({ id, name, monthly }: { id: string; name: string; monthly: number }) {
  const removeOtherIncome = useRetirementStore(s => s.removeOtherIncome)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: '#f7f7f7', borderRadius: 8, marginBottom: 6 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatCNY(monthly)}/月</div>
      </div>
      <button onClick={() => removeOtherIncome(id)}
        style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 13 }}>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>添加被动收入</div>
        <input placeholder="名称，例如：房租 / 年金" value={name} onChange={e => setName(e.target.value)}
          style={inputStyle} />
        <div style={{ height: 10 }} />
        <input type="number" placeholder="月金额（元）" value={amount} onChange={e => setAmount(e.target.value)}
          style={inputStyle} />
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#f0f0f0', cursor: 'pointer', fontWeight: 600 }}>取消</button>
          <button onClick={save} style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1a3a2a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>保存</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid #ddd', fontSize: 16, boxSizing: 'border-box', fontFamily: 'inherit',
}
