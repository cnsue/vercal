import type { DividendAssetCategory, DividendAssetRef, DividendAssetType } from '../../src/data/dividendStocks.js'

export interface AssetCandidate {
  code: string
  name: string
  assetType: DividendAssetType
  exchange: string
  sourceProvider: string
}

export interface EastmoneyQuote {
  f43?: number | string
  f57?: string
  f58?: string
}

export const EASTMONEY_TOKEN = 'D43BF722C8E33A0EB5D0476A4A6B2C31'
export const SOURCE_PROVIDER = '东方财富公开行情接口'

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function normalizeCode(code: string): string {
  return code.trim().replace(/\.(SH|SZ|BJ)$/i, '').padStart(6, '0')
}

export function inferExchange(code: string): string {
  if (code.startsWith('6')) return 'SH'
  if (code.startsWith('8') || code.startsWith('4')) return 'BJ'
  return 'SZ'
}

export function eastmoneyMarket(exchange: string): string {
  if (exchange === 'SH') return '1'
  if (exchange === 'BJ') return '0'
  return '0'
}

export function inferAssetType(code: string, name: string): DividendAssetType {
  const text = `${code} ${name}`.toLowerCase()
  if (/etf|基金|联接|lof|指数|红利|沪深300|中证|上证50|创业板|科创/.test(text)) return 'etf'
  if (code.startsWith('5') || code.startsWith('1')) return 'etf'
  return 'stock'
}

export function inferCategory(assetType: DividendAssetType, name: string): DividendAssetCategory {
  if (assetType === 'stock') {
    if (/银行/.test(name)) return '银行'
    if (/电力|能源|煤|石油|燃气/.test(name)) return '能源'
    if (/高速|铁路|港口|航运|海控|基建/.test(name)) return '基建'
    if (/移动|电信|联通|通信/.test(name)) return '通信'
    if (/消费|家电|食品|酒|乳/.test(name)) return '消费'
    return '其它'
  }
  if (/红利|股息|分红|高息/.test(name)) return '红利ETF'
  if (/沪深300|中证500|中证1000|上证50|创业板|科创|A500|宽基/.test(name)) return '宽基ETF'
  return '行业ETF'
}

export function quotePrice(raw: EastmoneyQuote): number {
  const value = Number(raw.f43)
  if (!Number.isFinite(value) || value <= 0) return 0
  return value / 100
}

export function toCandidate(raw: Record<string, unknown>): AssetCandidate | null {
  const codeValue = raw.Code ?? raw.code ?? raw.SecurityCode ?? raw.SECURITY_CODE ?? raw.QuoteCode ?? raw.quoteCode
  const nameValue = raw.Name ?? raw.name ?? raw.SecurityName ?? raw.SECURITY_NAME ?? raw.ShortName ?? raw.shortName
  const code = typeof codeValue === 'string' || typeof codeValue === 'number'
    ? normalizeCode(String(codeValue))
    : ''
  const name = typeof nameValue === 'string' ? nameValue.trim() : ''
  if (!/^\d{6}$/.test(code) || !name) return null

  const exchangeValue = raw.MktNum ?? raw.Market ?? raw.market ?? raw.Exchange ?? raw.exchange
  const exchangeText = typeof exchangeValue === 'string' ? exchangeValue.toUpperCase() : ''
  const exchange = exchangeText.includes('SH') || exchangeText === '1'
    ? 'SH'
    : exchangeText.includes('BJ')
      ? 'BJ'
      : exchangeText.includes('SZ') || exchangeText === '0'
        ? 'SZ'
        : inferExchange(code)
  const assetType = inferAssetType(code, name)
  if (assetType === 'stock' && !/^[0368]\d{5}$/.test(code)) return null
  return { code, name, assetType, exchange, sourceProvider: SOURCE_PROVIDER }
}

export function collectObjects(value: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    value.forEach(item => collectObjects(item, out))
  } else if (value && typeof value === 'object') {
    out.push(value as Record<string, unknown>)
    Object.values(value).forEach(item => collectObjects(item, out))
  }
  return out
}

export function makeAssetRef(input: {
  code: string
  name: string
  assetType: DividendAssetType
  exchange: string
  price: number
}): DividendAssetRef {
  const sourceAsOf = today()
  const category = inferCategory(input.assetType, input.name)
  return {
    code: input.code,
    name: input.name,
    assetType: input.assetType,
    category,
    referencePrice: input.price,
    priceAsOf: sourceAsOf,
    dividendPerShare: 0,
    asOfYear: '用户确认',
    sourceProvider: SOURCE_PROVIDER,
    sourceAsOf,
    sourceNote: `${input.name} ${input.code} 的名称、类型和参考价来自确定性行情接口；分红/分派金额与增长假设需用户核对后保存。`,
    growth: {
      pessimistic: 0,
      neutral: input.assetType === 'etf' ? 0 : 0.03,
      optimistic: input.assetType === 'etf' ? 0.02 : 0.05,
    },
  }
}
