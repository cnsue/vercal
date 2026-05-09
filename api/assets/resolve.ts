import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  EASTMONEY_TOKEN,
  eastmoneyMarket,
  inferAssetType,
  inferExchange,
  makeAssetRef,
  normalizeCode,
  quotePrice,
  type EastmoneyQuote,
} from './_shared.js'
import type { DividendAssetType } from '../../src/data/dividendStocks.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const code = normalizeCode(typeof req.query.code === 'string' ? req.query.code : '')
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Invalid code' })

  const queryName = typeof req.query.name === 'string' ? req.query.name.trim() : ''
  const exchange = typeof req.query.exchange === 'string' ? req.query.exchange.toUpperCase() : inferExchange(code)
  const queryType = req.query.assetType === 'etf' ? 'etf' : req.query.assetType === 'stock' ? 'stock' : undefined

  const url = new URL('https://push2.eastmoney.com/api/qt/stock/get')
  url.searchParams.set('secid', `${eastmoneyMarket(exchange)}.${code}`)
  url.searchParams.set('fields', 'f43,f57,f58')
  url.searchParams.set('token', EASTMONEY_TOKEN)

  let quote: EastmoneyQuote | null = null
  try {
    const upstream = await fetch(url, {
      headers: {
        accept: 'application/json,text/plain,*/*',
        'user-agent': 'Coinsight/1.0 asset resolver',
      },
    })
    if (upstream.ok) {
      const payload = await upstream.json() as { data?: EastmoneyQuote | null }
      quote = payload.data ?? null
    }
  } catch {
    quote = null
  }

  const name = typeof quote?.f58 === 'string' && quote.f58.trim()
    ? quote.f58.trim()
    : queryName || code
  const assetType: DividendAssetType = queryType ?? inferAssetType(code, name)
  const asset = makeAssetRef({
    code,
    name,
    assetType,
    exchange,
    price: quote ? quotePrice(quote) : 0,
  })

  return res.status(200).json({ asset })
}
