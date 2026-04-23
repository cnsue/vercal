import { useState, useMemo } from 'react'
import { useAssetStore } from '../store/useAssetStore'
import HeroCard from '../components/HeroCard'
import TrendChart from '../components/charts/TrendChart'
import DonutChart, { type BreakdownItem } from '../components/charts/DonutChart'
import SnapshotEditor from '../components/SnapshotEditor'
import { generateSlots } from '../utils/dateSlots'
import { formatCNY, formatDateKey, displayDate } from '../utils/formatters'
import { effectivePlatformLabel, effectiveClassLabel } from '../types/models'
import type { ChartPeriod, Snapshot } from '../types/models'

const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' },
  { key: 'year', label: '年K' },
]

type DistMode = 'platform' | 'class'

export default function AssetPage() {
  const store = useAssetStore()
  const [editingSnap, setEditingSnap] = useState<Snapshot | null>(null)
  const [period, setPeriod] = useState<ChartPeriod>('day')
  const [distMode, setDistMode] = useState<DistMode>('platform')
  const [showTargetEditor, setShowTargetEditor] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const sorted = store.snapshots
  const latest = sorted[0] ?? null
  const previous = sorted[1] ?? null
  const dailyChange = latest && previous ? latest.totalValueCNY - previous.totalValueCNY : 0
  const dailyChangePct = previous && previous.totalValueCNY > 0 ? dailyChange / previous.totalValueCNY * 100 : 0

  const todayKey = formatDateKey(new Date())
  const recordedToday = sorted.some(s => s.dateKey === todayKey)

  const slots = useMemo(() => generateSlots(sorted, period), [sorted, period])

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

  function handleSave(snap: Snapshot) {
    store.saveSnapshot(snap)
    setEditingSnap(null)
  }

  function handleDelete() {
    if (!editingSnap) return
    if (confirm(`删除 ${displayDate(editingSnap.dateKey)} 的资产记录？`)) {
      store.deleteSnapshot(editingSnap.dateKey)
      setEditingSnap(null)
    }
  }

  if (editingSnap) {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <SnapshotEditor
          snapshot={editingSnap}
          onSave={handleSave}
          onDelete={sorted.some(s => s.dateKey === editingSnap.dateKey) ? handleDelete : undefined}
          onCancel={() => setEditingSnap(null)}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 0 80px' }}>
      <HeroCard
        totalValueCNY={latest?.totalValueCNY ?? 0}
        dailyChange={dailyChange}
        dailyChangePct={dailyChangePct}
        latestDateKey={latest?.dateKey ?? null}
        annualTarget={store.annualTarget}
        onEditTarget={() => {
          setTargetInput(store.annualTarget > 0 ? String(store.annualTarget) : '')
          setShowTargetEditor(true)
        }}
      />

      {/* Missing today banner */}
      {!recordedToday && (
        <div onClick={() => setEditingSnap(store.draftSnapshot(todayKey))}
          style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: '12px 16px', marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔔</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>今日资产还未录入</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>点这里复制最近快照，改几个数字就能保存</div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#aaa' }}>›</span>
        </div>
      )}

      {/* Exchange rate row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 12px', fontSize: 13 }}>
        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>USD/CNY</span>
        <span style={{ fontWeight: 700 }}>{store.exchangeRate ? store.exchangeRate.rate.toFixed(4) : '未获取'}</span>
        <span style={{ color: 'var(--muted)', fontSize: 11, flex: 1 }}>{store.rateStatus}</span>
        <button onClick={() => store.refreshExchangeRate()} disabled={store.isFetchingRate}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e6845', fontSize: 13 }}>
          {store.isFetchingRate ? '…' : '↻'}
        </button>
      </div>

      {/* Trend chart */}
      <Section title="资产变化">
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: period === p.key ? '#1a3a2a' : '#f0f0f0',
                color: period === p.key ? '#fff' : '#555' }}>
              {p.label}
            </button>
          ))}
        </div>
        <TrendChart slots={slots} period={period} />
      </Section>

      {/* Distribution */}
      {latest && (
        <Section title="资产分布">
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['platform', 'class'] as DistMode[]).map(m => (
              <button key={m} onClick={() => setDistMode(m)}
                style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: distMode === m ? '#1a3a2a' : '#f0f0f0',
                  color: distMode === m ? '#fff' : '#555' }}>
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
              <button key={snap.id} onClick={() => setEditingSnap(snap)}
                style={{ width: '100%', textAlign: 'left', background: '#fff', border: '1px solid #eee', borderRadius: 14, padding: '14px 16px', marginBottom: 8, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{displayDate(snap.dateKey)}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{snap.items.length} 条记录</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{formatCNY(snap.totalValueCNY)}</span>
                  {prev && <span style={{ fontSize: 13, color: change >= 0 ? '#1e6845' : '#c0392b' }}>
                    {change >= 0 ? '+' : ''}{formatCNY(change)}
                  </span>}
                </div>
              </button>
            )
          })
        )}
      </Section>

      {/* Annual target modal */}
      {showTargetEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%' }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>设置年度目标</div>
            <input type="number" placeholder="目标金额（元），例如 1000000"
              value={targetInput} onChange={e => setTargetInput(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #ddd', fontSize: 16, boxSizing: 'border-box', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowTargetEditor(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#f0f0f0', cursor: 'pointer', fontWeight: 600 }}>取消</button>
              <button onClick={() => { store.setAnnualTarget(0); setShowTargetEditor(false) }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#fee', color: '#c0392b', cursor: 'pointer', fontWeight: 600 }}>清除</button>
              <button onClick={() => { store.setAnnualTarget(parseFloat(targetInput) || 0); setShowTargetEditor(false) }}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1a3a2a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>保存</button>
            </div>
          </div>
        </div>
      )}
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
