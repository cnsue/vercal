import { useMemo, useState, useEffect } from 'react'
import { useCashFlowStore } from '../store/useCashFlowStore'
import {
  BUILTIN_INCOME_CATEGORIES, BUILTIN_EXPENSE_CATEGORIES, CREDIT_REPAY_KEY,
  findCategoryMeta, type CashFlowEvent,
} from '../types/cashFlow'
import { PLATFORM_LABELS, type AssetPlatform } from '../types/models'
import { formatCNY, formatDateKey } from '../utils/formatters'
import CashFlowEditor from '../components/CashFlowEditor'

type RangeKey = 'month' | 'year' | 'all'

const RANGE_LABELS: Record<RangeKey, string> = {
  month: '本月', year: '本年', all: '累计',
}

export default function CashFlowPage() {
  const events = useCashFlowStore(s => s.events)
  const load = useCashFlowStore(s => s.load)

  const [range, setRange] = useState<RangeKey>('month')
  const [showRepay, setShowRepay] = useState(false)
  const [editing, setEditing] = useState<CashFlowEvent | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => filterByRange(events, range), [events, range])

  const visibleEvents = useMemo(() => (
    showRepay
      ? filtered
      : filtered.filter(e => e.category !== CREDIT_REPAY_KEY)
  ), [filtered, showRepay])

  const totals = useMemo(() => {
    let income = 0, expense = 0
    for (const e of visibleEvents) {
      if (e.type === 'income') income += e.amount
      else expense += e.amount
    }
    return { income, expense, net: income - expense }
  }, [visibleEvents])

  const byCategory = useMemo(() => groupByCategory(visibleEvents), [visibleEvents])

  const grouped = useMemo(() => groupByDate(visibleEvents), [visibleEvents])

  function openAdd() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(e: CashFlowEvent) {
    setEditing(e)
    setEditorOpen(true)
  }

  return (
    <div style={{ padding: '0 0 88px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map(k => (
          <button key={k} type="button" onClick={() => setRange(k)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: range === k ? 'var(--primary)' : 'var(--button-secondary-bg)',
              color: range === k ? '#fff' : 'var(--button-secondary-text)',
            }}>
            {RANGE_LABELS[k]}
          </button>
        ))}
      </div>

      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 12,
      }}>
        <Row label="📥 收入" value={`+${formatCNY(totals.income)}`} accent="positive" />
        <Row label="📤 支出" value={`-${formatCNY(totals.expense)}`} accent="negative" />
        <div style={{ height: 1, background: 'var(--border)', margin: '10px 0' }} />
        <Row label="净注入"
          value={`${totals.net >= 0 ? '+' : ''}${formatCNY(totals.net)}`}
          accent={totals.net >= 0 ? 'positive' : 'negative'} bold />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
          <input type="checkbox" checked={showRepay} onChange={e => setShowRepay(e.target.checked)} />
          显示信用卡还款（默认隐藏，避免与信用消费双计）
        </label>
      </div>

      {byCategory.length > 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>按分类</div>
          {byCategory.map(c => (
            <CategoryBar key={`${c.type}-${c.key}`} cat={c} />
          ))}
        </div>
      )}

      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: 16, marginBottom: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>流水</div>
        {grouped.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            该周期暂无现金流。点下方「＋」开始记录。
          </div>
        ) : grouped.map(g => (
          <div key={g.date} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
              {formatGroupDate(g.date)}
            </div>
            {g.events.map(e => (
              <EventRow key={e.id} event={e} onClick={() => openEdit(e)} />
            ))}
          </div>
        ))}
      </div>

      <button type="button" onClick={openAdd}
        style={{
          position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom))',
          left: '50%', transform: 'translateX(-50%)',
          padding: '12px 24px', borderRadius: 999, border: 'none',
          background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          zIndex: 10,
        }}>
        ＋ 添加现金流
      </button>

      <CashFlowEditor open={editorOpen} initial={editing}
        onClose={() => { setEditorOpen(false); setEditing(null) }} />
    </div>
  )
}

function Row({ label, value, accent, bold }: {
  label: string; value: string;
  accent?: 'positive' | 'negative'; bold?: boolean
}) {
  const color = accent === 'positive' ? 'var(--primary-strong)'
    : accent === 'negative' ? 'var(--danger)'
    : 'var(--text)'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: bold ? 18 : 14, fontWeight: bold ? 800 : 600, color, letterSpacing: '-0.02em' }}>
        {value}
      </span>
    </div>
  )
}

interface CategoryAgg {
  type: 'income' | 'expense'
  key: string
  label: string
  icon: string
  total: number
}

function groupByCategory(events: CashFlowEvent[]): CategoryAgg[] {
  const map = new Map<string, CategoryAgg>()
  for (const e of events) {
    const k = `${e.type}-${e.category}`
    const meta = findCategoryMeta(e.type, e.category)
    const label = meta?.label ?? e.category
    const icon = meta?.icon ?? (e.type === 'income' ? '✨' : '⚠️')
    const cur = map.get(k) ?? { type: e.type, key: e.category, label, icon, total: 0 }
    cur.total += e.amount
    map.set(k, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

function CategoryBar({ cat }: { cat: CategoryAgg }) {
  const sign = cat.type === 'income' ? '+' : '-'
  const color = cat.type === 'income' ? 'var(--primary-strong)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
      <span style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cat.icon} {cat.label}
      </span>
      <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, color }}>
        {sign}{formatCNY(cat.total)}
      </span>
    </div>
  )
}

interface DateGroup { date: string; events: CashFlowEvent[] }

function groupByDate(events: CashFlowEvent[]): DateGroup[] {
  const map = new Map<string, CashFlowEvent[]>()
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, [])
    map.get(e.date)!.push(e)
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, list]) => ({
      date,
      events: list.sort((a, b) => b.amount - a.amount),
    }))
}

function EventRow({ event, onClick }: { event: CashFlowEvent; onClick: () => void }) {
  const meta = findCategoryMeta(event.type, event.category)
  const label = meta?.label ?? event.category
  const icon = meta?.icon ?? (event.type === 'income' ? '✨' : '⚠️')
  const sign = event.type === 'income' ? '+' : '-'
  const color = event.type === 'income' ? 'var(--primary-strong)' : 'var(--danger)'
  const platformLabel = event.platform
    ? (event.platform === 'other' && event.customPlatformName
        ? event.customPlatformName
        : PLATFORM_LABELS[event.platform as AssetPlatform])
    : null

  return (
    <button onClick={onClick} type="button"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text)', textAlign: 'left',
      }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          {event.type === 'expense' && event.paymentMethod === 'credit' && (
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 4,
              background: 'var(--accent-soft, #f0e8d8)', color: 'var(--accent, #c58a20)',
              fontWeight: 700, letterSpacing: 0.5,
            }}>信用</span>
          )}
        </div>
        {(platformLabel || event.note) && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[platformLabel, event.note].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color, flexShrink: 0 }}>
        {sign}{formatCNY(event.amount)}
      </span>
    </button>
  )
}

function filterByRange(events: CashFlowEvent[], range: RangeKey): CashFlowEvent[] {
  if (range === 'all') return events
  const now = new Date()
  if (range === 'month') {
    const ymPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return events.filter(e => e.date.startsWith(ymPrefix))
  }
  // year
  const yPrefix = String(now.getFullYear())
  return events.filter(e => e.date.startsWith(yPrefix))
}

function formatGroupDate(date: string): string {
  const d = new Date(date)
  const todayKey = formatDateKey(new Date())
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  const yestKey = formatDateKey(yest)
  if (date === todayKey) return `今天 · ${date}`
  if (date === yestKey) return `昨天 · ${date}`
  return `${d.getMonth() + 1}/${d.getDate()} · ${date}`
}

// silence unused imports — kept for future per-category drilldown
void BUILTIN_INCOME_CATEGORIES
void BUILTIN_EXPENSE_CATEGORIES
