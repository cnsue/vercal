import type {
  DividendAssetCategory,
  DividendAssetFieldSource,
  DividendAssetRef,
  DividendAssetType,
} from '../../src/data/dividendStocks.js'

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

/**
 * 行情接口支持的市场。
 * A 股 SH/SZ/BJ：6 位数字代码。
 * 港股 HK：5 位数字代码（不足左侧补 0）。
 * 美股 US-NASDAQ / US-NYSE：字母（含 .、-）代码，无法从代码本身区分交易所，
 *   refresh.ts 会先按 NASDAQ 试，失败再降级到 NYSE。
 */
export type QuoteMarket = 'SH' | 'SZ' | 'BJ' | 'HK' | 'US-NASDAQ' | 'US-NYSE'

export interface ParsedQuoteCode {
  /** 标准化后的代码：A 股 6 位、港股 5 位、美股大写字母 */
  code: string
  market: QuoteMarket
  /** 若主市场拿不到行情，按顺序尝试的备用市场（目前只用于美股 NASDAQ↔NYSE） */
  fallbackMarkets?: QuoteMarket[]
}

/**
 * 解析用户输入的代码：识别 A 股 / 港股 / 美股并返回标准化形式与候选市场。
 * 支持显式后缀（.SH .SZ .BJ .HK .US .N .O）。
 * 返回 null 表示无法识别，refresh 层应直接把它放入 missing。
 */
export function parseQuoteCode(rawCode: string): ParsedQuoteCode | null {
  const trimmed = rawCode.trim().toUpperCase()
  if (!trimmed) return null

  // 拆出可选后缀，例如 600036.SH / 00700.HK / AAPL.O
  const suffixMatch = trimmed.match(/^(.+?)\.(SH|SZ|BJ|HK|US|N|O)$/)
  const baseCode = suffixMatch ? suffixMatch[1] : trimmed
  const suffixHint = suffixMatch ? suffixMatch[2] : null

  // 纯数字：A 股 6 位 / 港股 5 位
  if (/^\d+$/.test(baseCode)) {
    if (suffixHint === 'HK' || (!suffixHint && baseCode.length > 0 && baseCode.length <= 5)) {
      if (baseCode.length > 5) return null
      return { code: baseCode.padStart(5, '0'), market: 'HK' }
    }
    if (baseCode.length > 6) return null
    const padded = baseCode.padStart(6, '0')
    if (suffixHint === 'SH') return { code: padded, market: 'SH' }
    if (suffixHint === 'SZ') return { code: padded, market: 'SZ' }
    if (suffixHint === 'BJ') return { code: padded, market: 'BJ' }
    if (padded.startsWith('6') || padded.startsWith('5') || padded.startsWith('9')) return { code: padded, market: 'SH' }
    if (padded.startsWith('8') || padded.startsWith('4')) return { code: padded, market: 'BJ' }
    return { code: padded, market: 'SZ' }
  }

  // 字母（美股）：允许 A-Z 0-9 . -，必须以字母开头
  if (/^[A-Z][A-Z0-9.\-]*$/.test(baseCode)) {
    if (suffixHint === 'N') return { code: baseCode, market: 'US-NYSE' }
    return { code: baseCode, market: 'US-NASDAQ', fallbackMarkets: ['US-NYSE'] }
  }

  return null
}

/** 把市场映射到 push2.eastmoney.com 的 secid 前缀。 */
export function quoteMarketSecidPrefix(market: QuoteMarket): string {
  switch (market) {
    case 'SH': return '1'
    case 'SZ': return '0'
    case 'BJ': return '0'
    case 'HK': return '116'
    case 'US-NASDAQ': return '105'
    case 'US-NYSE': return '106'
  }
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

export function apiFieldSource(sourceNote: string, confidence: DividendAssetFieldSource['confidence'] = 'medium'): DividendAssetFieldSource {
  return {
    kind: 'api',
    provider: SOURCE_PROVIDER,
    sourceAsOf: today(),
    sourceNote,
    confidence,
  }
}

export function userFieldSource(sourceNote: string): DividendAssetFieldSource {
  return {
    kind: 'user',
    provider: '用户确认',
    sourceAsOf: today(),
    sourceNote,
    confidence: 'low',
  }
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
    fieldSources: {
      referencePrice: input.price > 0
        ? apiFieldSource('参考价来自东方财富行情快照', 'high')
        : userFieldSource('接口未返回有效参考价，需要用户确认'),
      dividendPerShare: userFieldSource('接口暂未解析到分红/分派金额，需要用户确认'),
      asOfYear: userFieldSource('分红/分派口径需要用户确认'),
    },
    growth: {
      pessimistic: 0,
      neutral: input.assetType === 'etf' ? 0 : 0.03,
      optimistic: input.assetType === 'etf' ? 0.02 : 0.05,
    },
  }
}
