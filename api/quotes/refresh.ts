import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  EASTMONEY_TOKEN,
  eastmoneyMarket,
  inferExchange,
  normalizeCode,
  quotePrice,
  type EastmoneyQuote,
} from '../assets/_shared.js'

interface RefreshBody {
  codes?: unknown
}

export interface QuoteRefreshItem {
  code: string
  name: string
  referencePrice: number
  priceAsOf: string
  exchange: string
}

export interface QuoteRefreshResult {
  items: QuoteRefreshItem[]
  missing: string[]
  asOf: string
}

const FIELDS = 'f43,f57,f58,f86' // f43 最新价(分) f57 代码 f58 名称 f86 行情时间

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body ?? {}) as RefreshBody
  const codes = Array.isArray(body.codes)
    ? body.codes
      .map(c => (typeof c === 'string' ? normalizeCode(c) : ''))
      .filter(c => /^\d{6}$/.test(c))
    : []

  if (codes.length === 0) {
    return res.status(400).json({ error: 'codes 必须是 6 位代码的非空数组' })
  }
  if (codes.length > 50) {
    return res.status(400).json({ error: '单次最多 50 条' })
  }

  const asOf = todayOrPreviousWeekday()
  const results = await Promise.all(codes.map(code => fetchOne(code, asOf)))

  const items: QuoteRefreshItem[] = []
  const missing: string[] = []
  for (const r of results) {
    if (r.ok) items.push(r.item)
    else missing.push(r.code)
  }

  return res.status(200).json({ items, missing, asOf } satisfies QuoteRefreshResult)
}

type FetchResult =
  | { ok: true; item: QuoteRefreshItem }
  | { ok: false; code: string }

async function fetchOne(code: string, asOf: string): Promise<FetchResult> {
  const exchange = inferExchange(code)
  const url = new URL('https://push2.eastmoney.com/api/qt/stock/get')
  url.searchParams.set('secid', `${eastmoneyMarket(exchange)}.${code}`)
  url.searchParams.set('fields', FIELDS)
  url.searchParams.set('token', EASTMONEY_TOKEN)

  try {
    const upstream = await fetch(url, {
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'Coinsight/1.0 quote-refresh',
      },
    })
    if (!upstream.ok) return { ok: false, code }
    const payload = await upstream.json() as { data?: EastmoneyQuote & { f86?: number | string } | null }
    const data = payload.data
    if (!data) return { ok: false, code }

    const price = quotePrice(data)
    if (!(price > 0)) return { ok: false, code }

    const name = typeof data.f58 === 'string' && data.f58.trim() ? data.f58.trim() : code

    // f86 是行情时间秒级 Unix 时间戳；若拿到则用它的日期，否则用 asOf
    const priceAsOf = parseQuoteTime(data.f86) ?? asOf

    return {
      ok: true,
      item: { code, name, referencePrice: price, priceAsOf, exchange },
    }
  } catch {
    return { ok: false, code }
  }
}

function parseQuoteTime(raw: number | string | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return undefined
  const ms = n * 1000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return undefined
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 返回今日 ISO 日期；如果是周末则回退到上一个工作日 */
function todayOrPreviousWeekday(): string {
  const d = new Date()
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
