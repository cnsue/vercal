import type { Snapshot, ExchangeRate } from '../types/models'
import type { RetirementPlan, PensionConfig, DecentStandard, DecentBreakdownItem, DecentDimensionKey } from '../types/retirement'
import { DEFAULT_RETIREMENT_PLAN, DEFAULT_PENSION, DECENT_DIMENSIONS, sumBreakdown } from '../types/retirement'
import type { ThemePreference } from '../types/theme'

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
  themePreference: 'asset-tracker:themePreference',
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

/** 把给定 "从今起 N 个月后" 转成 (year, month)。 */
function offsetFromNow(months: number): { year: number; month: number } {
  const now = new Date()
  const idx = now.getFullYear() * 12 + now.getMonth() + Math.max(0, Math.round(months))
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

/**
 * 迁移历史 PensionConfig 到当前模型。
 * - v0.2.0：年单位 + 单一缴费指数 + 固定退休年龄
 * - v0.3.0：月单位 + plannedFutureMonths（月数，没有绝对日期）
 * - v0.4.0：月单位 + plannedStopYear/Month（绝对日期）← 当前
 */
function migratePension(stored: unknown): PensionConfig {
  if (!stored || typeof stored !== 'object') return DEFAULT_PENSION
  const s = stored as Record<string, unknown>

  // 已是 v0.4+
  if (typeof s.plannedStopYear === 'number' && typeof s.plannedStopMonth === 'number') {
    return {
      ...DEFAULT_PENSION,
      ...s,
      monthsContributed: clampNonNegativeInt(s.monthsContributed, 600),
      // 缺失的两个可选参数回退到默认
      socialWageGrowthRate: typeof s.socialWageGrowthRate === 'number' ? s.socialWageGrowthRate : DEFAULT_PENSION.socialWageGrowthRate,
      personalAccountRate: typeof s.personalAccountRate === 'number' ? s.personalAccountRate : DEFAULT_PENSION.personalAccountRate,
      averageWageOverride: typeof s.averageWageOverride === 'number' && isFinite(s.averageWageOverride) && s.averageWageOverride > 0
        ? s.averageWageOverride
        : undefined,
    } as PensionConfig
  }

  // v0.3：有 monthsContributed + plannedFutureMonths
  if (typeof s.monthsContributed === 'number' && typeof s.plannedFutureMonths === 'number') {
    const stop = offsetFromNow(s.plannedFutureMonths as number)
    return {
      ...DEFAULT_PENSION,
      ...s,
      monthsContributed: clampNonNegativeInt(s.monthsContributed, 600),
      plannedStopYear: stop.year,
      plannedStopMonth: stop.month,
    } as PensionConfig
  }

  // v0.2 及更早：年单位旧模型
  const years = typeof s.yearsContributed === 'number' ? s.yearsContributed : 0
  const futureYears = typeof s.plannedFutureYears === 'number' ? s.plannedFutureYears : 0
  const currentAge = typeof s.currentAge === 'number' ? s.currentAge : 30
  const retirementAge = typeof s.retirementAge === 'number' ? s.retirementAge : 60
  const idx = typeof s.averageContributionIndex === 'number' ? s.averageContributionIndex : 1.0
  const stop = offsetFromNow(futureYears * 12)
  return {
    cityKey: typeof s.cityKey === 'string' ? s.cityKey : DEFAULT_PENSION.cityKey,
    gender: 'male',
    birthYear: new Date().getFullYear() - currentAge,
    birthMonth: 1,
    monthsContributed: clampNonNegativeInt(years * 12, 600),
    plannedStopYear: stop.year,
    plannedStopMonth: stop.month,
    historicalIndex: idx,
    futureIndex: idx,
    retirementOffsetMonths: (retirementAge - 60) * 12,
    personalAccountBalance: typeof s.personalAccountBalance === 'number' ? s.personalAccountBalance : 0,
    socialWageGrowthRate: DEFAULT_PENSION.socialWageGrowthRate,
    personalAccountRate: DEFAULT_PENSION.personalAccountRate,
  }
}

function clampNonNegativeInt(v: unknown, max: number): number {
  if (typeof v !== 'number' || !isFinite(v)) return 0
  return Math.max(0, Math.min(Math.round(v), max))
}

/**
 * 迁移历史 DecentStandard 到 6 维度模型。
 * - 老数据只有 monthlyAmount，且 >0 → 按默认权重比例拆为 6 维
 * - 老数据有 breakdown（旧自由结构）→ 尝试按 id 映射到固定 6 维，补齐缺失维度
 * - 全 0 / 无 breakdown → 返回空 breakdown，触发首次向导
 */
function migrateDecentStandard(stored: unknown): DecentStandard {
  if (!stored || typeof stored !== 'object') {
    return { monthlyAmount: 0, breakdown: [] }
  }
  const s = stored as Record<string, unknown>
  const rawMonthly = typeof s.monthlyAmount === 'number' && isFinite(s.monthlyAmount) ? Math.max(0, s.monthlyAmount) : 0
  const rawBreakdown = Array.isArray(s.breakdown) ? s.breakdown : []

  const validKeys = new Set<DecentDimensionKey>(DECENT_DIMENSIONS.map(d => d.key))
  const typedItems: DecentBreakdownItem[] = []
  for (const raw of rawBreakdown) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const key = r.key
    if (typeof key !== 'string' || !validKeys.has(key as DecentDimensionKey)) continue
    const amount = typeof r.monthlyAmount === 'number' && isFinite(r.monthlyAmount) ? Math.max(0, r.monthlyAmount) : 0
    typedItems.push({ key: key as DecentDimensionKey, monthlyAmount: amount })
  }

  // 已是新模型且所有 6 维都在
  if (typedItems.length === DECENT_DIMENSIONS.length) {
    const ordered = DECENT_DIMENSIONS.map(d => typedItems.find(i => i.key === d.key) ?? { key: d.key, monthlyAmount: 0 })
    return { monthlyAmount: sumBreakdown(ordered), breakdown: ordered }
  }

  // 老数据仅有 monthlyAmount 且 > 0 → 按默认权重分摊
  if (rawMonthly > 0) {
    const defaultTotal = DECENT_DIMENSIONS.reduce((s, d) => s + d.defaultMonthly, 0)
    const scale = defaultTotal > 0 ? rawMonthly / defaultTotal : 0
    const breakdown = DECENT_DIMENSIONS.map(d => ({
      key: d.key,
      monthlyAmount: Math.round(d.defaultMonthly * scale),
    }))
    return { monthlyAmount: sumBreakdown(breakdown), breakdown }
  }

  // 首次 / 无数据
  return { monthlyAmount: 0, breakdown: [] }
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
      decentStandard: migrateDecentStandard(stored.decentStandard),
      pension: migratePension(stored.pension),
      holdings: stored.holdings ?? [],
      otherIncomes: stored.otherIncomes ?? [],
    }
  },
  saveRetirementPlan: (p: RetirementPlan): void => set(K.retirementPlan, p),

  getThemePreference: (): ThemePreference => {
    const value = get<ThemePreference>(K.themePreference, 'system')
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  },
  saveThemePreference: (v: ThemePreference): void => set(K.themePreference, v),

  estimateSizeKB: (): number => {
    let total = 0
    for (const key of Object.values(K)) {
      total += (localStorage.getItem(key) ?? '').length
    }
    return Math.round(total * 2 / 1024) // UTF-16 → bytes → KB
  },
}
