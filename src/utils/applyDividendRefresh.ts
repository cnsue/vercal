import {
  DIVIDEND_BUILTIN_ASSETS,
  findDividendStock,
  type DividendAssetFieldSource,
  type DividendAssetRef,
} from '../data/dividendStocks'
import type {
  AIProviderKey,
  DividendPriceRefreshItem,
  DividendPriceRefreshLogEntry,
} from '../types/ai'
import { v4 as uuidv4 } from './uuid'

export interface ApplyRefreshContext {
  customAssets: DividendAssetRef[]
  addCustomDividendAsset: (asset: DividendAssetRef) => void
  updateCustomDividendAsset: (code: string, patch: Partial<DividendAssetRef>) => void
  providerKey: AIProviderKey
  providerLabel: string
  model: string
}

/**
 * 把 AI 返回的单条参考价写入 customDividendAssets 覆盖层。
 * - 已有 custom 条目 → 更新 referencePrice/priceAsOf/fieldSources
 * - 没 custom 条目但内置库里有 → 浅拷贝整条内置项后写入 custom（custom 优先于内置）
 * - 都没有 → 丢弃（不可能凭空创建一个未知标的）
 * 返回 log 条目供调用方追加进 dividendPriceRefreshLog
 */
export function applyPriceRefresh(
  item: DividendPriceRefreshItem,
  ctx: ApplyRefreshContext,
  appliedBy: 'auto' | 'manual',
): DividendPriceRefreshLogEntry | null {
  const existing = ctx.customAssets.find(a => a.code === item.code)
  const previous = existing ?? DIVIDEND_BUILTIN_ASSETS.find(a => a.code === item.code)
  if (!previous) return null

  const fieldSource: DividendAssetFieldSource = {
    kind: 'api',
    provider: ctx.providerKey,
    sourceAsOf: item.priceAsOf,
    sourceNote: item.sourceNote ?? `${ctx.providerLabel} 联网刷新 · ${appliedBy === 'auto' ? '高置信度自动应用' : '用户确认应用'}`,
    confidence: item.confidence,
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
    // 把内置项完整浅拷贝下来再 patch，写入 custom 后 getDividendAssets() 即返回 custom 而非内置
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
    confidence: item.confidence,
    provider: ctx.providerKey,
    providerLabel: ctx.providerLabel,
    model: ctx.model,
    sourceUrl: item.sourceUrl,
    sourceNote: item.sourceNote,
    appliedAt: new Date().toISOString(),
    appliedBy,
  }
}

/** 从持仓列表构造 AI 刷新的输入项（去重，按 code 唯一） */
export function buildHoldingsRefreshInput(
  holdings: { stockCode: string; stockName: string }[],
  customAssets: DividendAssetRef[],
): { code: string; name: string; lastReferencePrice: number }[] {
  const seen = new Set<string>()
  const items: { code: string; name: string; lastReferencePrice: number }[] = []
  for (const h of holdings) {
    if (seen.has(h.stockCode)) continue
    seen.add(h.stockCode)
    const ref = findDividendStock(h.stockCode, customAssets)
    items.push({
      code: h.stockCode,
      name: ref?.name ?? h.stockName,
      lastReferencePrice: ref?.referencePrice ?? 0,
    })
  }
  return items
}
