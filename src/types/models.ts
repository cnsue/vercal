export type AssetPlatform =
  | 'binance' | 'okx' | 'bybit' | 'kraken'
  | 'futu' | 'tiger' | 'alipay' | 'cmb'
  | 'gfSecurities' | 'citicSecurities' | 'other'

export type AssetClass =
  | 'crypto' | 'stock' | 'fund' | 'cash' | 'wealth' | 'futures' | 'other'

export type ChartPeriod = 'day' | 'week' | 'month' | 'year'

export const PLATFORM_LABELS: Record<AssetPlatform, string> = {
  binance: '币安', okx: '欧易', bybit: 'Bybit', kraken: 'Kraken',
  futu: '富途', tiger: '老虎', alipay: '支付宝', cmb: '招商银行',
  gfSecurities: '广发证券', citicSecurities: '中信证券', other: '其他',
}

export const CLASS_LABELS: Record<AssetClass, string> = {
  crypto: '加密资产', stock: '证券', fund: '基金',
  cash: '现金', wealth: '理财', futures: '合约/保证金', other: '其他',
}

export const PLATFORM_DEFAULT_CURRENCY: Record<AssetPlatform, 'CNY' | 'USD'> = {
  binance: 'USD', okx: 'USD', bybit: 'USD', kraken: 'USD',
  futu: 'CNY', tiger: 'CNY', alipay: 'CNY', cmb: 'CNY',
  gfSecurities: 'CNY', citicSecurities: 'CNY', other: 'CNY',
}

export interface SnapshotItem {
  id: string
  platform: AssetPlatform
  customPlatformName: string
  accountType: string
  assetClass: AssetClass
  customAssetClassName: string
  assetLabel: string
  amount: number
  currency: 'CNY' | 'USD'
  valueCNY: number
  note: string
}

export interface Snapshot {
  id: string
  dateKey: string       // 'YYYY-MM-DD'
  snapshotDate: string  // ISO date string
  items: SnapshotItem[]
  note: string
  totalValueCNY: number
}

export interface ExchangeRate {
  rate: number
  updatedAt: string
}

export interface ChartSlot {
  id: string
  label: string
  totalValueCNY: number
  snapshot: Snapshot | null
}

export function effectivePlatformLabel(item: SnapshotItem): string {
  return item.platform === 'other' && item.customPlatformName
    ? item.customPlatformName
    : PLATFORM_LABELS[item.platform]
}

export function effectiveClassLabel(item: SnapshotItem): string {
  return item.assetClass === 'other' && item.customAssetClassName
    ? item.customAssetClassName
    : CLASS_LABELS[item.assetClass]
}
