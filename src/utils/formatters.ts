export function formatCNY(value: number): string {
  if (value >= 1_000_000) {
    return `¥${(value / 10_000).toFixed(2)}万`
  }
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatSignedCNY(value: number): string {
  const prefix = value >= 0 ? '+' : ''
  return prefix + formatCNY(value)
}

export function formatSignedPercent(value: number): string {
  const prefix = value >= 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function displayDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

export function compactDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-')
  return `${m}-${d}`
}
