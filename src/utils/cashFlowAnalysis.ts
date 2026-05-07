import type { CashFlowEvent } from '../types/cashFlow'
import type { ChartSlot } from '../types/models'

/** 一个事件对资产总值的净影响：
 *  - 收入（永远 asset）→ +amountCNY
 *  - 支出 · 资产直付 → -amountCNY
 *  - 支出 · 信用卡（赊账）→ 0（资产没动）
 */
export function netContribution(e: CashFlowEvent): number {
  if (e.type === 'income') return e.amountCNY
  if (e.paymentMethod === 'asset') return -e.amountCNY
  return 0
}

export interface PeriodAnalysis {
  fromDate: string
  toDate: string
  baseValue: number
  endValue: number
  bookChange: number       // endValue - baseValue
  netInjection: number     // 区间内净注入（含 fromDate 当天之后到 toDate 含）
  realPnL: number          // bookChange - netInjection
  realPnLPct: number       // realPnL / baseValue * 100
  income: number           // 区间内总收入（CNY）
  expense: number          // 区间内 asset 直付支出（CNY）
  hasEvents: boolean
}

/**
 * 把 chart slots 转成「真实盈亏曲线」：每个 slot 的 totalValueCNY = 当前账面值 - baseValue - 累计净注入(到该 slot)
 * baseValue 取首个有效 slot 的账面值，第一个有效 slot 始终为 0。
 * 没数据 / 在第一个有效 slot 之前的 slot：snapshot 置 null（图上不绘点）。
 */
export function toRealPnLSlots(slots: ChartSlot[], events: CashFlowEvent[]): ChartSlot[] {
  const firstIdx = slots.findIndex(s => s.snapshot && s.totalValueCNY > 0)
  if (firstIdx < 0) return slots
  const baseValue = slots[firstIdx].totalValueCNY
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date))

  // 累计到每个 slot.endDate（含）的 netContribution
  const cum: number[] = []
  let idx = 0, acc = 0
  for (const slot of slots) {
    while (idx < sortedEvents.length && sortedEvents[idx].date <= slot.endDate) {
      acc += netContribution(sortedEvents[idx])
      idx++
    }
    cum.push(acc)
  }
  const baseCum = cum[firstIdx]

  return slots.map((slot, i) => {
    if (i < firstIdx || !slot.snapshot || slot.totalValueCNY <= 0) {
      return { ...slot, totalValueCNY: 0, snapshot: null }
    }
    const realPnL = slot.totalValueCNY - baseValue - (cum[i] - baseCum)
    return { ...slot, totalValueCNY: realPnL }
  })
}

/** 对当前 chart 区间做一次完整分析。返回 null 表示数据不足（少于 2 个有效点）。 */
export function analyzePeriod(slots: ChartSlot[], events: CashFlowEvent[]): PeriodAnalysis | null {
  const dataSlots = slots.filter(s => s.snapshot && s.totalValueCNY > 0)
  if (dataSlots.length < 2) return null
  const first = dataSlots[0]
  const last = dataSlots[dataSlots.length - 1]
  const fromDate = first.endDate
  const toDate = last.endDate
  let income = 0
  let expense = 0
  let netInjection = 0
  let hasEvents = false
  for (const e of events) {
    if (e.date <= fromDate || e.date > toDate) continue
    hasEvents = true
    netInjection += netContribution(e)
    if (e.type === 'income') income += e.amountCNY
    else if (e.paymentMethod === 'asset') expense += e.amountCNY
  }
  const bookChange = last.totalValueCNY - first.totalValueCNY
  const realPnL = bookChange - netInjection
  const realPnLPct = first.totalValueCNY > 0 ? (realPnL / first.totalValueCNY) * 100 : 0
  return {
    fromDate, toDate,
    baseValue: first.totalValueCNY,
    endValue: last.totalValueCNY,
    bookChange, netInjection, realPnL, realPnLPct,
    income, expense, hasEvents,
  }
}
