/**
 * 确定性参考价刷新：直连 /api/quotes/refresh（东方财富官方行情接口）。
 * 与 aiDividendRefresh 不同：
 * - 不经过 AI，没有幻觉风险
 * - 价格、名称、行情时间戳都来自上游 JSON，零自由发挥
 * - 没有 confidence 概念，全部按 high 写入（接口本身就是 high 置信度）
 */

import {
  DIVIDEND_BUILTIN_ASSETS,
  type DividendAssetFieldSource,
  type DividendAssetRef,
} from '../data/dividendStocks'
import type { DividendPriceRefreshLogEntry } from '../types/ai'
import { StorageService } from '../store/storage'
import { v4 as uuidv4 } from './uuid'

export interface DeterministicRefreshInput {
  code: string
  name: string
  lastReferencePrice: number
}

export interface DeterministicRefreshItem {
  code: string
  name: string
  referencePrice: number
  priceAsOf: string
  exchange: string
}

export interface DeterministicRefreshResult {
  items: DeterministicRefreshItem[]
  missing: string[]
  asOf: string
}

/** 调用 /api/quotes/refresh 批量拿最新价 */
export async function refreshHoldingPricesDeterministic(args: {
  holdings: DeterministicRefreshInput[]
}): Promise<DeterministicRefreshResult> {
  const codes = args.holdings.map(h => h.code)
  if (codes.length === 0) {
    return { items: [], missing: [], asOf: '' }
  }
  const res = await fetch('/api/quotes/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ codes }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = typeof data?.error === 'string' ? data.error : `行情接口失败 ${res.status}`
    throw new Error(msg)
  }
  const items = Array.isArray(data.items) ? (data.items as DeterministicRefreshItem[]) : []
  const missing = Array.isArray(data.missing) ? (data.missing as string[]) : []
  const asOf = typeof data.asOf === 'string' ? data.asOf : ''

  // 价格数量级 sanity 校验（防止接口给出明显异常值）
  const inputMap = new Map(args.holdings.map(h => [h.code, h]))
  const sane: DeterministicRefreshItem[] = []
  const fail: string[] = []
  for (const item of items) {
    const ref = inputMap.get(item.code)
    if (ref && ref.lastReferencePrice > 0) {
      if (item.referencePrice > ref.lastReferencePrice * 3
        || item.referencePrice < ref.lastReferencePrice * 0.33) {
        fail.push(item.code)
        continue
      }
    }
    sane.push(item)
  }
  return { items: sane, missing: [...missing, ...fail], asOf }
}

export interface ApplyDeterministicContext {
  customAssets: DividendAssetRef[]
  addCustomDividendAsset: (asset: DividendAssetRef) => void
  updateCustomDividendAsset: (code: string, patch: Partial<DividendAssetRef>) => void
}

/**
 * 把确定性接口返回的单条价格写入 customDividendAssets 覆盖层。
 * 返回 log 条目供调用方追加进 dividendPriceRefreshLog。
 */
export function applyDeterministicRefresh(
  item: DeterministicRefreshItem,
  ctx: ApplyDeterministicContext,
): DividendPriceRefreshLogEntry | null {
  const existing = ctx.customAssets.find(a => a.code === item.code)
  const previous = existing ?? DIVIDEND_BUILTIN_ASSETS.find(a => a.code === item.code)
  if (!previous) return null

  const fieldSource: DividendAssetFieldSource = {
    kind: 'api',
    provider: '东方财富公开行情接口',
    sourceAsOf: item.priceAsOf,
    sourceNote: `直连 push2.eastmoney.com 实时行情，${item.priceAsOf} 当日数据`,
    confidence: 'high',
  }

  const patch: Partial<DividendAssetRef> = {
    referencePrice: item.referencePrice,
    priceAsOf: item.priceAsOf,
    fieldSources: {
      ...(existing?.fieldSources ?? {}),
      referencePrice: fieldSource,
    },
  }

  if (existing) {
    ctx.updateCustomDividendAsset(item.code, patch)
  } else {
    const cloned: DividendAssetRef = {
      ...previous,
      referencePrice: item.referencePrice,
      priceAsOf: item.priceAsOf,
      fieldSources: {
        ...(previous.fieldSources ?? {}),
        referencePrice: fieldSource,
      },
    }
    ctx.addCustomDividendAsset(cloned)
  }

  return {
    id: uuidv4(),
    code: item.code,
    previousPrice: previous.referencePrice,
    previousPriceAsOf: previous.priceAsOf,
    newPrice: item.referencePrice,
    newPriceAsOf: item.priceAsOf,
    confidence: 'high',
    provider: 'custom',
    providerLabel: '东方财富行情接口',
    model: 'push2-eastmoney',
    sourceUrl: undefined,
    sourceNote: '确定性接口，零幻觉风险',
    appliedAt: new Date().toISOString(),
    appliedBy: 'auto',
  }
}

export function logRefresh(entries: DividendPriceRefreshLogEntry[]): void {
  if (entries.length === 0) return
  const prev = StorageService.getDividendPriceRefreshLog()
  StorageService.saveDividendPriceRefreshLog([...entries, ...prev])
}
