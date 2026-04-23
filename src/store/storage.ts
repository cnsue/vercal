import type { Snapshot, ExchangeRate } from '../types/models'
import type { RetirementPlan, PensionConfig } from '../types/retirement'
import { DEFAULT_RETIREMENT_PLAN, DEFAULT_PENSION } from '../types/retirement'

const K = {
  snapshots: 'asset-tracker:snapshots',
  annualTarget: 'asset-tracker:annualTarget',
  customPlatforms: 'asset-tracker:platforms',
  customClasses: 'asset-tracker:classes',
  hiddenPlatforms: 'asset-tracker:hiddenPlatforms',
  hiddenClasses: 'asset-tracker:hiddenClasses',
  exchangeRate: 'asset-tracker:exchangeRate',
  installBannerDismissed: 'asset-tracker:installBannerDismissed',
  retirementPlan: 'asset-tracker:retirementPlan',
} as const

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function set(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // localStorage full — silently ignore
  }
}

/**
 * 把 v0.2.0 的 PensionConfig（年单位 + 单一缴费指数 + 固定退休年龄）
 * 迁移到 v0.3.0 的新模型（月单位 + 历史/未来指数 + 渐进式退休）。
 */
function migratePension(stored: unknown): PensionConfig {
  if (!stored || typeof stored !== 'object') return DEFAULT_PENSION
  const s = stored as Record<string, unknown>

  // 已是新模型
  if (typeof s.monthsContributed === 'number' && typeof s.birthYear === 'number') {
    return { ...DEFAULT_PENSION, ...s } as PensionConfig
  }

  // 旧模型 → 新模型
  const years = typeof s.yearsContributed === 'number' ? s.yearsContributed : 0
  const futureYears = typeof s.plannedFutureYears === 'number' ? s.plannedFutureYears : 0
  const currentAge = typeof s.currentAge === 'number' ? s.currentAge : 30
  const retirementAge = typeof s.retirementAge === 'number' ? s.retirementAge : 60
  const idx = typeof s.averageContributionIndex === 'number' ? s.averageContributionIndex : 1.0
  return {
    cityKey: typeof s.cityKey === 'string' ? s.cityKey : DEFAULT_PENSION.cityKey,
    gender: 'male',
    birthYear: new Date().getFullYear() - currentAge,
    birthMonth: 1,
    monthsContributed: Math.round(years * 12),
    plannedFutureMonths: Math.round(futureYears * 12),
    historicalIndex: idx,
    futureIndex: idx,
    retirementOffsetMonths: (retirementAge - 60) * 12,
    personalAccountBalance: typeof s.personalAccountBalance === 'number' ? s.personalAccountBalance : 0,
  }
}

export const StorageService = {
  getSnapshots: (): Snapshot[] => get<Snapshot[]>(K.snapshots, []),
  saveSnapshots: (s: Snapshot[]): void => set(K.snapshots, s),

  getAnnualTarget: (): number => get<number>(K.annualTarget, 0),
  saveAnnualTarget: (v: number): void => set(K.annualTarget, v),

  getCustomPlatforms: (): string[] => get<string[]>(K.customPlatforms, []),
  saveCustomPlatforms: (v: string[]): void => set(K.customPlatforms, v),

  getCustomClasses: (): string[] => get<string[]>(K.customClasses, []),
  saveCustomClasses: (v: string[]): void => set(K.customClasses, v),

  getHiddenPlatforms: (): string[] => get<string[]>(K.hiddenPlatforms, []),
  saveHiddenPlatforms: (v: string[]): void => set(K.hiddenPlatforms, v),

  getHiddenClasses: (): string[] => get<string[]>(K.hiddenClasses, []),
  saveHiddenClasses: (v: string[]): void => set(K.hiddenClasses, v),

  getExchangeRate: (): ExchangeRate | null => get<ExchangeRate | null>(K.exchangeRate, null),
  saveExchangeRate: (r: ExchangeRate): void => set(K.exchangeRate, r),

  isInstallBannerDismissed: (): boolean => get<boolean>(K.installBannerDismissed, false),
  dismissInstallBanner: (): void => set(K.installBannerDismissed, true),

  getRetirementPlan: (): RetirementPlan => {
    const stored = get<Partial<RetirementPlan> | null>(K.retirementPlan, null)
    if (!stored) return DEFAULT_RETIREMENT_PLAN
    return {
      ...DEFAULT_RETIREMENT_PLAN,
      ...stored,
      decentStandard: { ...DEFAULT_RETIREMENT_PLAN.decentStandard, ...stored.decentStandard },
      pension: migratePension(stored.pension),
      holdings: stored.holdings ?? [],
      otherIncomes: stored.otherIncomes ?? [],
    }
  },
  saveRetirementPlan: (p: RetirementPlan): void => set(K.retirementPlan, p),

  estimateSizeKB: (): number => {
    let total = 0
    for (const key of Object.values(K)) {
      total += (localStorage.getItem(key) ?? '').length
    }
    return Math.round(total * 2 / 1024) // UTF-16 → bytes → KB
  },
}
