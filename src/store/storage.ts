import type { Snapshot, ExchangeRate } from '../types/models'

const K = {
  snapshots: 'asset-tracker:snapshots',
  annualTarget: 'asset-tracker:annualTarget',
  customPlatforms: 'asset-tracker:platforms',
  customClasses: 'asset-tracker:classes',
  hiddenPlatforms: 'asset-tracker:hiddenPlatforms',
  hiddenClasses: 'asset-tracker:hiddenClasses',
  exchangeRate: 'asset-tracker:exchangeRate',
  installBannerDismissed: 'asset-tracker:installBannerDismissed',
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

  estimateSizeKB: (): number => {
    let total = 0
    for (const key of Object.values(K)) {
      total += (localStorage.getItem(key) ?? '').length
    }
    return Math.round(total * 2 / 1024) // UTF-16 → bytes → KB
  },
}
