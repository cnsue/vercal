import type { Snapshot, ExchangeRate } from '../types/models'
import type { RetirementPlan } from '../types/retirement'
import { DEFAULT_RETIREMENT_PLAN } from '../types/retirement'

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
      pension: { ...DEFAULT_RETIREMENT_PLAN.pension, ...stored.pension },
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
