import type { ChartSlot, Snapshot } from '../types/models'
import { compactDate, formatDateKey } from './formatters'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth()
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun
  d.setDate(d.getDate() - dow)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function generateSlots(snapshots: Snapshot[], period: 'day' | 'week' | 'month' | 'year'): ChartSlot[] {
  if (snapshots.length === 0) return []
  switch (period) {
    case 'day': return dailySlots(snapshots, 3)
    case 'week': return weeklySlots(snapshots)
    case 'month': return monthlySlots(snapshots)
    case 'year': return yearlySlots(snapshots)
  }
}

function dailySlots(snapshots: Snapshot[], futureDays: number): ChartSlot[] {
  const sorted = [...snapshots].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const firstDay = startOfDay(new Date(sorted[0].snapshotDate))
  const today = startOfDay(new Date())
  const byKey = new Map(snapshots.map(s => [s.dateKey, s]))
  const total = Math.max(1, Math.round((today.getTime() - firstDay.getTime()) / 86_400_000) + 1 + futureDays)
  return Array.from({ length: total }, (_, i) => {
    const date = addDays(firstDay, i)
    const key = formatDateKey(date)
    const snap = byKey.get(key) ?? null
    return { id: `d${i}`, label: compactDate(key), totalValueCNY: snap?.totalValueCNY ?? 0, snapshot: snap }
  })
}

function weeklySlots(snapshots: Snapshot[]): ChartSlot[] {
  const sorted = [...snapshots].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const firstWeek = startOfWeek(new Date(sorted[0].snapshotDate))
  const currentWeek = startOfWeek(new Date())
  const count = Math.max(1, Math.round((currentWeek.getTime() - firstWeek.getTime()) / (7 * 86_400_000)) + 1)
  return Array.from({ length: count }, (_, i) => {
    const wStart = addDays(firstWeek, i * 7)
    const wEnd = addDays(wStart, 6)
    const snap = sorted.filter(s => {
      const d = startOfDay(new Date(s.snapshotDate))
      return d >= wStart && d <= wEnd
    }).at(-1) ?? null
    const label = `${wStart.getMonth() + 1}/${wStart.getDate()}`
    return { id: `w${i}`, label, totalValueCNY: snap?.totalValueCNY ?? 0, snapshot: snap }
  })
}

function monthlySlots(snapshots: Snapshot[]): ChartSlot[] {
  const sorted = [...snapshots].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const firstMonth = startOfMonth(new Date(sorted[0].snapshotDate))
  const currentMonth = startOfMonth(new Date())
  const count = Math.max(1, monthDiff(firstMonth, currentMonth) + 1)
  return Array.from({ length: count }, (_, i) => {
    const anchor = addMonths(firstMonth, i)
    const mStart = startOfMonth(anchor)
    const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0)
    const snap = sorted.filter(s => {
      const d = startOfDay(new Date(s.snapshotDate))
      return d >= mStart && d <= mEnd
    }).at(-1) ?? null
    const label = `${mStart.getMonth() + 1}月`
    return { id: `m${i}`, label, totalValueCNY: snap?.totalValueCNY ?? 0, snapshot: snap }
  })
}

function yearlySlots(snapshots: Snapshot[]): ChartSlot[] {
  const sorted = [...snapshots].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const firstYear = new Date(sorted[0].snapshotDate).getFullYear()
  const lastYear = Math.max(new Date().getFullYear(), new Date(sorted[sorted.length - 1].snapshotDate).getFullYear())
  return Array.from({ length: lastYear - firstYear + 1 }, (_, i) => {
    const year = firstYear + i
    const snap = sorted.filter(s => new Date(s.snapshotDate).getFullYear() === year).at(-1) ?? null
    return { id: `y${year}`, label: `${year}年`, totalValueCNY: snap?.totalValueCNY ?? 0, snapshot: snap }
  })
}
