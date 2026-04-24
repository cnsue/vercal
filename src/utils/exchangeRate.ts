import type { ExchangeRate } from '../types/models'

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function isFresh(rate: ExchangeRate | null): boolean {
  if (!rate) return false
  return Date.now() - new Date(rate.updatedAt).getTime() < CACHE_TTL_MS
}

export async function fetchUsdCny(): Promise<number> {
  // Primary: open.er-api.com (free, no key, accessible from CN)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (res.ok) {
      const data = await res.json() as { rates: { CNY: number } }
      if (data.rates?.CNY > 0) return data.rates.CNY
    }
  } catch { /* fall through */ }

  // Secondary: exchangerate-api free tier
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    if (res.ok) {
      const data = await res.json() as { rates: { CNY: number } }
      if (data.rates?.CNY > 0) return data.rates.CNY
    }
  } catch { /* fall through */ }

  // Tertiary: Frankfurter
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=CNY')
    if (res.ok) {
      const data = await res.json() as { rates: { CNY: number } }
      if (data.rates?.CNY > 0) return data.rates.CNY
    }
  } catch { /* fall through */ }

  return 7.25
}
