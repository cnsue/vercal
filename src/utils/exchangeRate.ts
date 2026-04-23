import type { ExchangeRate } from '../types/models'

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export function isFresh(rate: ExchangeRate | null): boolean {
  if (!rate) return false
  return Date.now() - new Date(rate.updatedAt).getTime() < CACHE_TTL_MS
}

export async function fetchUsdCny(): Promise<number> {
  // Primary: Frankfurter (no API key required)
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=CNY')
    if (res.ok) {
      const data = await res.json() as { rates: { CNY: number } }
      return data.rates.CNY
    }
  } catch { /* fall through */ }

  // Fallback: hardcoded recent rate
  return 7.25
}
