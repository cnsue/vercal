import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  EASTMONEY_TOKEN,
  apiFieldSource,
  collectObjects,
  eastmoneyMarket,
  inferAssetType,
  inferExchange,
  makeAssetRef,
  normalizeCode,
  quotePrice,
  userFieldSource,
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

  const dividend = assetType === 'etf'
    ? await resolveEtfTrailingDistribution(code)
    : await resolveStockDividend(code)
  if (dividend) {
    asset.dividendPerShare = dividend.dividendPerShare
    asset.asOfYear = dividend.asOfYear
    asset.sourceNote = `${asset.sourceNote} ${dividend.sourceNote}`
    asset.fieldSources = {
      ...asset.fieldSources,
      dividendPerShare: apiFieldSource(dividend.sourceNote, dividend.confidence),
      asOfYear: apiFieldSource(dividend.sourceNote, dividend.confidence),
    }
    if (dividend.disclosureNote) asset.disclosureNote = dividend.disclosureNote
  } else {
    asset.fieldSources = {
      ...asset.fieldSources,
      dividendPerShare: userFieldSource(assetType === 'etf'
        ? '未能自动解析近 12 个月 ETF 分派，需要用户确认'
        : '未能自动解析股票现金分红，需要用户确认'),
      asOfYear: userFieldSource('未能自动解析分红/分派口径，需要用户确认'),
    }
  }

  return res.status(200).json({ asset })
}

interface DividendResolveResult {
  dividendPerShare: number
  asOfYear: string
  sourceNote: string
  confidence: 'high' | 'medium' | 'low'
  disclosureNote?: string
}

async function resolveStockDividend(code: string): Promise<DividendResolveResult | null> {
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get')
  url.searchParams.set('sortColumns', 'REPORT_DATE')
  url.searchParams.set('sortTypes', '-1')
  url.searchParams.set('pageSize', '10')
  url.searchParams.set('pageNumber', '1')
  url.searchParams.set('reportName', 'RPT_F10_DIVIDEND')
  url.searchParams.set('columns', 'ALL')
  url.searchParams.set('filter', `(SECURITY_CODE="${code}")`)

  try {
    const response = await fetch(url, { headers: { accept: 'application/json,text/plain,*/*' } })
    if (!response.ok) return null
    const data = await response.json() as unknown
    for (const obj of collectObjects(data)) {
      const text = Object.values(obj)
        .filter(v => typeof v === 'string' || typeof v === 'number')
        .join(' ')
      const perShare = parsePerShareDividend(text)
      if (perShare <= 0) continue
      const year = parseYear(text) ?? new Date().getFullYear().toString()
      return {
        dividendPerShare: perShare,
        asOfYear: year,
        sourceNote: `股票现金分红由东方财富分红送配数据自动解析：${shortenText(text)}`,
        confidence: 'medium',
        disclosureNote: /预案|董事会|股东大会|待实施|尚未/i.test(text)
          ? '自动解析的分红记录可能仍处预案或待实施状态，请以公告为准'
          : undefined,
      }
    }
  } catch {
    return null
  }
  return null
}

async function resolveEtfTrailingDistribution(code: string): Promise<DividendResolveResult | null> {
  const url = `https://fundf10.eastmoney.com/fhsp_${code}.html`
  try {
    const response = await fetch(url, { headers: { accept: 'text/html,*/*' } })
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const html = buffer.toString('utf8')
    const rows = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .split(/<\/tr>/i)
      .map(row => row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    const cutoff = Date.now() - 366 * 24 * 60 * 60 * 1000
    let total = 0
    const usedDates: string[] = []
    for (const row of rows) {
      const date = parseDate(row)
      if (!date || new Date(date).getTime() < cutoff) continue
      const perShare = parsePerShareDividend(row)
      if (perShare <= 0) continue
      total += perShare
      usedDates.push(date)
    }
    if (total > 0) {
      return {
        dividendPerShare: Number(total.toFixed(4)),
        asOfYear: '近12个月',
        sourceNote: `ETF 近 12 个月单位分派由东方财富基金分红配送页自动汇总，覆盖 ${usedDates.length} 条记录`,
        confidence: 'medium',
      }
    }
  } catch {
    return null
  }
  return null
}

function parsePerShareDividend(text: string): number {
  const normalized = text.replace(/，/g, ',').replace(/\s+/g, '')
  const tenShareMatch = normalized.match(/(?:每)?10(?:股|份|份基金份额)?(?:派|发|分配|现金红利|派发现金红利)(?:人民币)?([0-9]+(?:\.[0-9]+)?)元?/)
    ?? normalized.match(/10(?:股|份)[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)元/)
  if (tenShareMatch) return Number(tenShareMatch[1]) / 10
  const oneShareMatch = normalized.match(/每(?:股|份)(?:派|发|分配|现金红利|派发现金红利)(?:人民币)?([0-9]+(?:\.[0-9]+)?)元?/)
  if (oneShareMatch) return Number(oneShareMatch[1])
  return 0
}

function parseYear(text: string): string | null {
  const match = text.match(/(20\d{2})/)
  return match?.[1] ?? null
}

function parseDate(text: string): string | null {
  const match = text.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function shortenText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 160)
}
