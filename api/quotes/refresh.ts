import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  EASTMONEY_TOKEN,
  parseQuoteCode,
  quoteMarketSecidPrefix,
  quotePrice,
  type EastmoneyQuote,
  type ParsedQuoteCode,
  type QuoteMarket,
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

const EASTMONEY_FIELDS = 'f43,f57,f58,f86,f152'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = (req.body ?? {}) as RefreshBody
  if (!Array.isArray(body.codes)) {
    return res.status(400).json({ error: 'codes 必须是非空数组' })
  }

  const parsed: Array<{ raw: string; parsed: ParsedQuoteCode | null }> = body.codes
    .filter((c): c is string => typeof c === 'string')
    .map(raw => ({ raw, parsed: parseQuoteCode(raw) }))

  if (parsed.length === 0) {
    return res.status(400).json({ error: 'codes 必须是非空数组' })
  }
  if (parsed.length > 50) {
    return res.status(400).json({ error: '单次最多 50 条' })
  }

  const asOf = todayOrPreviousWeekday()
  const results = await Promise.all(parsed.map(async ({ raw, parsed }) => {
    if (!parsed) return { ok: false as const, code: raw }
    return fetchOne(parsed, asOf)
  }))

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

async function fetchOne(parsed: ParsedQuoteCode, asOf: string): Promise<FetchResult> {
  const markets: QuoteMarket[] = [parsed.market, ...(parsed.fallbackMarkets ?? [])]

  // 1. 东方财富主路径（含同代码多市场 fallback：美股 NASDAQ → NYSE）
  for (const market of markets) {
    const item = await fetchEastmoney(parsed.code, market, asOf)
    if (item) return { ok: true, item }
  }

  // 2. 新浪兜底（A 股 + 港股 + 美股）
  for (const market of markets) {
    const item = await fetchSina(parsed.code, market, asOf)
    if (item) return { ok: true, item }
  }

  return { ok: false, code: parsed.code }
}

async function fetchEastmoney(code: string, market: QuoteMarket, asOf: string): Promise<QuoteRefreshItem | null> {
  const url = new URL('https://push2.eastmoney.com/api/qt/stock/get')
  url.searchParams.set('secid', `${quoteMarketSecidPrefix(market)}.${code}`)
  url.searchParams.set('fields', EASTMONEY_FIELDS)
  url.searchParams.set('token', EASTMONEY_TOKEN)

  try {
    const upstream = await fetch(url, {
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'Coinsight/1.0 quote-refresh',
      },
    })
    if (!upstream.ok) return null
    const payload = await upstream.json() as { data?: EastmoneyQuote & { f86?: number | string } | null }
    const data = payload.data
    if (!data) return null

    const price = quotePrice(data)
    if (!(price > 0)) return null

    const name = typeof data.f58 === 'string' && data.f58.trim() ? data.f58.trim() : code
    const priceAsOf = parseEastmoneyTime(data.f86) ?? asOf
    return { code, name, referencePrice: price, priceAsOf, exchange: market }
  } catch {
    return null
  }
}

/**
 * 新浪行情兜底：hq.sinajs.cn/list= 接口。
 * - A 股：sh600036 / sz000001 → CSV[0]=name, CSV[3]=current price, CSV[30]=YYYY-MM-DD
 * - 港股：hk00700 → CSV[1]=name(中文), CSV[6]=current price, CSV[17]=YYYY/MM/DD
 * - 美股：gb_aapl → CSV[0]=name, CSV[1]=current price, CSV[3]=YYYY-MM-DD HH:mm:ss
 * 任何一步解析失败都返回 null，让上层归入 missing。
 */
async function fetchSina(code: string, market: QuoteMarket, asOf: string): Promise<QuoteRefreshItem | null> {
  const sinaSymbol = sinaSymbolFor(code, market)
  if (!sinaSymbol) return null

  try {
    const upstream = await fetch(`https://hq.sinajs.cn/list=${sinaSymbol}`, {
      headers: {
        accept: 'text/plain,*/*',
        'user-agent': 'Coinsight/1.0 quote-refresh',
        referer: 'https://finance.sina.com.cn',
      },
    })
    if (!upstream.ok) return null
    const text = await upstream.text()
    const match = text.match(/="([^"]*)"/)
    if (!match) return null
    const fields = match[1].split(',')
    if (fields.length < 4) return null

    if (market === 'SH' || market === 'SZ' || market === 'BJ') {
      const name = fields[0]?.trim() || code
      const price = Number(fields[3])
      if (!(price > 0)) return null
      const priceAsOf = /^\d{4}-\d{2}-\d{2}$/.test(fields[30] ?? '') ? fields[30] : asOf
      return { code, name, referencePrice: price, priceAsOf, exchange: market }
    }
    if (market === 'HK') {
      const name = fields[1]?.trim() || fields[0]?.trim() || code
      const price = Number(fields[6])
      if (!(price > 0)) return null
      const dateMatch = (fields[17] ?? '').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
      const priceAsOf = dateMatch
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
        : asOf
      return { code, name, referencePrice: price, priceAsOf, exchange: market }
    }
    // US
    const name = fields[0]?.trim() || code
    const price = Number(fields[1])
    if (!(price > 0)) return null
    const priceAsOf = (fields[3] ?? '').slice(0, 10).replace(/\//g, '-')
    return {
      code,
      name,
      referencePrice: price,
      priceAsOf: /^\d{4}-\d{2}-\d{2}$/.test(priceAsOf) ? priceAsOf : asOf,
      exchange: market,
    }
  } catch {
    return null
  }
}

function sinaSymbolFor(code: string, market: QuoteMarket): string | null {
  switch (market) {
    case 'SH': return `sh${code}`
    case 'SZ': return `sz${code}`
    case 'BJ': return `bj${code}`
    case 'HK': return `hk${code}`
    case 'US-NASDAQ':
    case 'US-NYSE':
      return `gb_${code.toLowerCase()}`
  }
}

function parseEastmoneyTime(raw: number | string | undefined): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return undefined
  const d = new Date(n * 1000)
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
