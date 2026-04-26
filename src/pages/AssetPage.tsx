import { useState, useMemo } from 'react'
import { useAssetStore } from '../store/useAssetStore'
import { useRetirementStore } from '../store/useRetirementStore'
import HeroCard from '../components/HeroCard'
import AnnualTargetCard from '../components/AnnualTargetCard'
import DecentStandardEditor from '../components/retirement/DecentStandardEditor'
import TrendChart, { type TrendSeries } from '../components/charts/TrendChart'
import DonutChart, { type BreakdownItem } from '../components/charts/DonutChart'
import { generateSlots } from '../utils/dateSlots'
import { formatCNY, formatDateKey, displayDate } from '../utils/formatters'
import { effectivePlatformLabel, effectiveClassLabel } from '../types/models'
import type { ChartPeriod, Snapshot } from '../types/models'
import {
  computeDividendSummary, computePensionProjection, computeCoverage,
} from '../utils/retirementCalc'

const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' },
  { key: 'year', label: '年K' },
]

type DistMode = 'platform' | 'class'
type TrendMode = 'total' | 'platform' | 'class'

const TREND_MODES: { key: TrendMode; label: string }[] = [
  { key: 'total', label: '总览' },
  { key: 'platform', label: '平台' },
  { key: 'class', label: '类别' },
]

const MAX_TREND_SERIES = 6

interface Props {
  onOpenEditor: (snap: Snapshot) => void
}

export default function AssetPage({ onOpenEditor }: Props) {
  const store = useAssetStore()
  const plan = useRetirementStore(s => s.plan)
  const [period, setPeriod] = useState<ChartPeriod>('day')
  const [trendMode, setTrendMode] = useState<TrendMode>('total')
  const [distMode, setDistMode] = useState<DistMode>('platform')
  const [showTargetEditor, setShowTargetEditor] = useState(false)
  const [targetInput, setTargetInput] = useState('')
  const [showDecentEditor, setShowDecentEditor] = useState(false)

  const coverage = useMemo(() => {
    const dividend = computeDividendSummary(plan.holdings)
    const pension = computePensionProjection(plan.pension)
    return computeCoverage(plan, dividend, pension)
  }, [plan])

  const sorted = store.snapshots
  const latest = sorted[0] ?? null
  const previous = sorted[1] ?? null
  const dailyChange = latest && previous ? latest.totalValueCNY - previous.totalValueCNY : 0
  const dailyChangePct = previous && previous.totalValueCNY > 0 ? dailyChange / previous.totalValueCNY * 100 : 0

  const todayKey = formatDateKey(new Date())
  const recordedToday = sorted.some(s => s.dateKey === todayKey)

  const slots = useMemo(() => generateSlots(sorted, period), [sorted, period])
  const trendSeries = useMemo(
    () => trendMode === 'total' ? [] : buildTrendSeries(slots, trendMode),
    [slots, trendMode],
  )

  const distItems = useMemo((): BreakdownItem[] => {
    if (!latest) return []
    const totals: Record<string, number> = {}
    for (const item of latest.items) {
      const key = distMode === 'platform' ? effectivePlatformLabel(item) : effectiveClassLabel(item)
      totals[key] = (totals[key] ?? 0) + item.valueCNY
    }
    const total = Object.values(totals).reduce((s, v) => s + v, 0) || 1
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value, weight: value / total * 100 }))
  }, [latest, distMode])

  return (
    <div style={{ padding: '0 0 16px' }}>
      <HeroCard
        totalValueCNY={latest?.totalValueCNY ?? 0}
        dailyChange={dailyChange}
        dailyChangePct={dailyChangePct}
        latestDateKey={latest?.dateKey ?? null}
        coverage={{
          ratio: coverage.nowRatio,
          unset: coverage.decentMonthly <= 0,
          onClick: () => setShowDecentEditor(true),
        }}
      />

      <div style={{ marginBottom: 14 }}>
        <AnnualTargetCard
          totalValueCNY={latest?.totalValueCNY ?? 0}
          annualTarget={store.annualTarget}
          variant="full"
          onEdit={() => {
            setTargetInput(store.annualTarget > 0 ? String(store.annualTarget) : '')
            setShowTargetEditor(true)
          }}
        />
      </div>

      {/* Today entry — always visible once there's data */}
      {sorted.length > 0 && (
        <div onClick={() => onOpenEditor(store.draftSnapshot(todayKey))}
          style={{
            background: recordedToday ? 'var(--success-bg)' : 'var(--warning-bg)',
            border: `1px solid ${recordedToday ? 'var(--success-border)' : 'var(--warning-border)'}`,
            borderRadius: 14, padding: '12px 16px', marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
          }}>
          <span style={{ fontSize: 20 }}>{recordedToday ? '✏️' : '🔔'}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{recordedToday ? '更新今日资产' : '今日资产还未录入'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {recordedToday ? '点这里修改今日的资产快照' : '点这里复制最近快照，改几个数字就能保存'}
            </div>
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--chevron)' }}>›</span>
        </div>
      )}

      {/* Exchange rate row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 12px', fontSize: 13 }}>
        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>USD/CNY</span>
        <span style={{ fontWeight: 700 }}>{store.exchangeRate ? store.exchangeRate.rate.toFixed(4) : '未获取'}</span>
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>在岸·日更</span>
        <span style={{ color: 'var(--muted)', fontSize: 11, flex: 1, textAlign: 'right' }}>{store.rateStatus}</span>
        <button onClick={() => store.refreshExchangeRate()} disabled={store.isFetchingRate}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-strong)', fontSize: 16, lineHeight: 1 }}>
          <span className={store.isFetchingRate ? 'spin' : ''}>↻</span>
        </button>
      </div>

      {/* Trend chart */}
      <Section title="资产变化">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <div style={{
            display: 'flex',
            gap: 2,
            padding: 2,
            borderRadius: 9,
            background: 'var(--button-secondary-bg)',
            flex: 1,
            minWidth: 0,
          }}>
            {TREND_MODES.map(m => (
              <button key={m.key} onClick={() => setTrendMode(m.key)}
                style={{
                  flex: 1,
                  padding: '5px 0',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 12,
                  background: trendMode === m.key ? 'var(--primary)' : 'transparent',
                  color: trendMode === m.key ? '#fff' : 'var(--button-secondary-text)',
                }}>
                {m.label}
              </button>
            ))}
          </div>
          <select
            aria-label="资产变化周期"
            value={period}
            onChange={e => setPeriod(e.target.value as ChartPeriod)}
            style={{
              width: 74,
              height: 32,
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--surface-muted)',
              color: 'var(--text)',
              fontWeight: 700,
              padding: '0 8px',
              fontSize: 13,
            }}>
            {PERIODS.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
        <TrendChart slots={slots} period={period} series={trendSeries} />
      </Section>

      {/* Distribution */}
      {latest && (
        <Section title="资产分布">
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['platform', 'class'] as DistMode[]).map(m => (
              <button key={m} onClick={() => setDistMode(m)}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: distMode === m ? 'var(--primary)' : 'var(--button-secondary-bg)',
                  color: distMode === m ? '#fff' : 'var(--button-secondary-text)' }}>
                {m === 'platform' ? '按平台' : '按类别'}
              </button>
            ))}
          </div>
          <DonutChart items={distItems} title={distMode === 'platform' ? '按平台' : '按类别'} />
        </Section>
      )}

      {/* Recent snapshots */}
      <Section title="最近快照">
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>
            还没有历史记录，点击右上角 + 开始录入
          </div>
        ) : (
          sorted.slice(0, 7).map((snap, i) => {
            const prev = sorted[i + 1]
            const change = prev ? snap.totalValueCNY - prev.totalValueCNY : 0
            return (
              <button key={snap.id} onClick={() => onOpenEditor(snap)}
                style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', color: 'var(--text)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{displayDate(snap.dateKey)}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{snap.items.length} 条记录</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{formatCNY(snap.totalValueCNY)}</span>
                  {prev && <span style={{ fontSize: 13, color: change >= 0 ? 'var(--primary-strong)' : 'var(--danger)' }}>
                    {change >= 0 ? '+' : ''}{formatCNY(change)}
                  </span>}
                </div>
              </button>
            )
          })
        )}
      </Section>

      <DecentStandardEditor open={showDecentEditor} onClose={() => setShowDecentEditor(false)} />

      {/* Annual target modal */}
      {showTargetEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>设置年度目标</div>
            <input type="number" placeholder="目标金额（元），例如 1000000"
              value={targetInput} onChange={e => setTargetInput(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 16, boxSizing: 'border-box', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowTargetEditor(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', cursor: 'pointer', fontWeight: 600 }}>取消</button>
              <button onClick={() => { store.setAnnualTarget(0); setShowTargetEditor(false) }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600 }}>清除</button>
              <button onClick={() => { store.setAnnualTarget(parseFloat(targetInput) || 0); setShowTargetEditor(false) }}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildTrendSeries(slots: ReturnType<typeof generateSlots>, mode: Exclude<TrendMode, 'total'>): TrendSeries[] {
  const valuesByName = new Map<string, number[]>()
  const totalsByName = new Map<string, number>()

  slots.forEach((slot, slotIndex) => {
    if (!slot.snapshot) return
    const slotTotals = new Map<string, number>()
    for (const item of slot.snapshot.items) {
      const name = mode === 'platform' ? effectivePlatformLabel(item) : effectiveClassLabel(item)
      slotTotals.set(name, (slotTotals.get(name) ?? 0) + Math.max(0, item.valueCNY))
    }
    for (const [name, value] of slotTotals) {
      if (!valuesByName.has(name)) valuesByName.set(name, Array(slots.length).fill(0))
      valuesByName.get(name)![slotIndex] = value
      totalsByName.set(name, (totalsByName.get(name) ?? 0) + value)
    }
  })

  const names = [...totalsByName.entries()]
    .filter(([, total]) => total > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name]) => name)

  const visible = names.slice(0, MAX_TREND_SERIES)
  const overflow = names.slice(MAX_TREND_SERIES)
  const series = visible.map(name => ({ name, values: valuesByName.get(name) ?? [] }))

  if (overflow.length > 0) {
    series.push({
      name: '其他合计',
      values: slots.map((_, slotIndex) => overflow.reduce((sum, name) => (
        sum + (valuesByName.get(name)?.[slotIndex] ?? 0)
      ), 0)),
    })
  }

  return series
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}
