import type {
  DividendHolding, PensionConfig, RetirementPlan, OtherIncome, Gender, DividendGrowthScenario,
} from '../types/retirement'
import { findDividendStock } from '../data/dividendStocks'
import {
  findPensionCity, getPersonalAccountMonths, SOCIAL_WAGE_GROWTH_RATE,
} from '../data/pensionCities'

/* -------- 股息收入 -------- */

export interface HoldingIncome {
  holding: DividendHolding
  dividendPerShare: number
  grossAnnual: number
  netAnnual: number
  referenceMarketValue: number
  yieldPct: number
}

export function computeHoldingIncome(h: DividendHolding): HoldingIncome {
  const ref = findDividendStock(h.stockCode)
  const dps = h.dividendPerShareOverride ?? ref?.dividendPerShare ?? 0
  const grossAnnual = h.shares * dps
  const taxRate = h.taxRate ?? 0
  const netAnnual = grossAnnual * (1 - taxRate)
  const referencePrice = ref?.referencePrice ?? 0
  const referenceMarketValue = h.shares * referencePrice
  const yieldPct = referencePrice > 0 ? (dps / referencePrice) * 100 : 0
  return { holding: h, dividendPerShare: dps, grossAnnual, netAnnual, referenceMarketValue, yieldPct }
}

/** 按场景把该持仓的年股息前瞻推算到未来 N 年后（实际增长口径） */
export function projectHoldingIncome(h: DividendHolding, scenario: DividendGrowthScenario, yearsForward: number): HoldingIncome {
  const base = computeHoldingIncome(h)
  const ref = findDividendStock(h.stockCode)
  const growth = ref?.growth?.[scenario] ?? 0
  const factor = Math.pow(1 + growth, Math.max(0, yearsForward))
  return {
    ...base,
    dividendPerShare: base.dividendPerShare * factor,
    grossAnnual: base.grossAnnual * factor,
    netAnnual: base.netAnnual * factor,
  }
}

export interface DividendSummary {
  grossAnnual: number
  netAnnual: number
  netMonthly: number
  totalReferenceMarketValue: number
  perHolding: HoldingIncome[]
}

export function computeDividendSummary(holdings: DividendHolding[]): DividendSummary {
  const perHolding = holdings.map(computeHoldingIncome)
  const grossAnnual = perHolding.reduce((s, h) => s + h.grossAnnual, 0)
  const netAnnual = perHolding.reduce((s, h) => s + h.netAnnual, 0)
  const totalReferenceMarketValue = perHolding.reduce((s, h) => s + h.referenceMarketValue, 0)
  return {
    grossAnnual, netAnnual,
    netMonthly: netAnnual / 12,
    totalReferenceMarketValue,
    perHolding,
  }
}

/** 按场景 + 年限推算的股息汇总（所有持仓前瞻到 yearsForward 年后） */
export function projectDividendSummary(
  holdings: DividendHolding[], scenario: DividendGrowthScenario, yearsForward: number,
): DividendSummary {
  const perHolding = holdings.map(h => projectHoldingIncome(h, scenario, yearsForward))
  const grossAnnual = perHolding.reduce((s, h) => s + h.grossAnnual, 0)
  const netAnnual = perHolding.reduce((s, h) => s + h.netAnnual, 0)
  const totalReferenceMarketValue = perHolding.reduce((s, h) => s + h.referenceMarketValue, 0)
  return {
    grossAnnual, netAnnual,
    netMonthly: netAnnual / 12,
    totalReferenceMarketValue,
    perHolding,
  }
}

/* -------- 渐进式标准退休年龄（2025-01-01 起实施） --------
 * 男：1965.01 起出生的，每 4 个月加 1 个月，封顶 63 岁（+36 月）
 * 女干部：1970.01 起出生的，每 4 个月加 1 个月，封顶 58 岁（+36 月）
 * 女工人：1975.01 起出生的，每 2 个月加 1 个月，封顶 55 岁（+60 月）
 */

export interface StandardRetirementAge {
  /** 标准退休年 */
  years: number
  /** 标准退休附加月（0-11） */
  months: number
  /** 标准退休总月龄 */
  totalMonths: number
}

export function computeStandardRetirement(gender: Gender, birthYear: number, birthMonth: number): StandardRetirementAge {
  const birthIdx = birthYear * 12 + (birthMonth - 1)
  let baseYears: number, cutoffIdx: number, stepMonths: number, capExtra: number
  if (gender === 'male') {
    baseYears = 60; cutoffIdx = 1965 * 12; stepMonths = 4; capExtra = 36
  } else if (gender === 'femaleCadre') {
    baseYears = 55; cutoffIdx = 1970 * 12; stepMonths = 4; capExtra = 36
  } else {
    baseYears = 50; cutoffIdx = 1975 * 12; stepMonths = 2; capExtra = 60
  }
  let extra = 0
  if (birthIdx >= cutoffIdx) {
    extra = Math.min(Math.floor((birthIdx - cutoffIdx) / stepMonths) + 1, capExtra)
  }
  const totalMonths = baseYears * 12 + extra
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    totalMonths,
  }
}

/* -------- 养老金预估 -------- */

export interface PensionProjection {
  valid: boolean
  projectedSocialWage: number         // 退休时社平工资（元/月）
  basicPension: number                // 基础养老金（元/月）
  personalAccountPension: number      // 个人账户养老金（元/月）
  monthlyTotal: number                // 月养老金合计
  totalMonths: number                 // 总缴费月数
  plannedFutureMonths: number         // 派生的计划继续缴费月数
  projectedPersonalBalance: number    // 退休时个人账户预计余额
  standardRetirement: StandardRetirementAge  // 标准退休年龄
  /** 实际退休年（标准 + 弹性） */
  actualRetirementYears: number
  /** 实际退休附加月 0-11 */
  actualRetirementExtraMonths: number
  /** 实际退休年月 'YYYY-MM' */
  retirementYearMonth: string
  /** 到退休还剩的年数（小数） */
  yearsToRetire: number
  /** 加权平均缴费指数 */
  weightedIndex: number
}

/** 从今起到指定 (year, month) 还剩多少月（向下取整，最少 0）。 */
export function monthsUntil(year: number, month: number): number {
  const now = new Date()
  const nowIdx = now.getFullYear() * 12 + now.getMonth()
  const targetIdx = year * 12 + (month - 1)
  return Math.max(0, targetIdx - nowIdx)
}

export function computePensionProjection(cfg: PensionConfig): PensionProjection {
  const city = findPensionCity(cfg.cityKey)
  const std = computeStandardRetirement(cfg.gender, cfg.birthYear, cfg.birthMonth)
  const actualTotalMonths = std.totalMonths + cfg.retirementOffsetMonths
  const actualYears = Math.floor(actualTotalMonths / 12)
  const actualExtraMonths = actualTotalMonths % 12

  // 出生日期 + 月龄 = 退休日期
  const retirementDateObj = new Date(cfg.birthYear, cfg.birthMonth - 1 + actualTotalMonths, 1)
  const retirementYearMonth = `${retirementDateObj.getFullYear()}-${String(retirementDateObj.getMonth() + 1).padStart(2, '0')}`
  const now = new Date()
  const yearsToRetire = Math.max((retirementDateObj.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000), 0)

  // 计划停缴月数：以用户设定的 stopYear/Month 为准，且不能超过到退休为止
  const plannedFutureMonths = Math.min(
    monthsUntil(cfg.plannedStopYear, cfg.plannedStopMonth),
    Math.max(0, Math.round(yearsToRetire * 12)),
  )

  const totalMonths = cfg.monthsContributed + plannedFutureMonths
  const weightedIndex = totalMonths > 0
    ? (cfg.monthsContributed * cfg.historicalIndex + plannedFutureMonths * cfg.futureIndex) / totalMonths
    : cfg.historicalIndex

  if (!city || totalMonths <= 0) {
    return {
      valid: false,
      projectedSocialWage: city?.averageWage ?? 0,
      basicPension: 0,
      personalAccountPension: 0,
      monthlyTotal: 0,
      totalMonths,
      plannedFutureMonths,
      projectedPersonalBalance: cfg.personalAccountBalance,
      standardRetirement: std,
      actualRetirementYears: actualYears,
      actualRetirementExtraMonths: actualExtraMonths,
      retirementYearMonth,
      yearsToRetire,
      weightedIndex,
    }
  }

  const boundedIdx = Math.max(0.6, Math.min(weightedIndex, 3.0))
  const projectedSocialWage = city.averageWage * Math.pow(1 + SOCIAL_WAGE_GROWTH_RATE, yearsToRetire)

  // 基础养老金 = 退休时社平 × (1 + 加权指数) / 2 × (总月数/12) × 1%
  const totalYearsCredit = totalMonths / 12
  const basicPension = projectedSocialWage * (1 + boundedIdx) / 2 * totalYearsCredit * 0.01

  // 个人账户（3% 年化增长 + 未来月缴入按中位社平算）
  const grownBalance = cfg.personalAccountBalance * Math.pow(1.03, yearsToRetire)
  const midWage = (city.averageWage + projectedSocialWage) / 2
  const futureMonthlyContribution = midWage * boundedIdx * 0.08
  const projectedPersonalBalance = grownBalance + futureMonthlyContribution * plannedFutureMonths

  // 个人账户计发月数按实际退休年龄（整岁）查表
  const payoutMonths = getPersonalAccountMonths(actualYears)
  const personalAccountPension = projectedPersonalBalance / payoutMonths

  return {
    valid: true,
    projectedSocialWage,
    basicPension,
    personalAccountPension,
    monthlyTotal: basicPension + personalAccountPension,
    totalMonths,
    plannedFutureMonths,
    projectedPersonalBalance,
    standardRetirement: std,
    actualRetirementYears: actualYears,
    actualRetirementExtraMonths: actualExtraMonths,
    retirementYearMonth,
    yearsToRetire,
    weightedIndex,
  }
}

/* -------- 体面覆盖率 -------- */

export interface CoverageSummary {
  decentMonthly: number
  nowMonthly: number
  retiredMonthly: number
  nowRatio: number
  retiredRatio: number
  breakdown: {
    dividend: number
    pension: number
    other: number
  }
}

export function computeCoverage(
  plan: RetirementPlan,
  dividend: DividendSummary,
  pension: PensionProjection,
  projectedDividend?: DividendSummary,
): CoverageSummary {
  const otherMonthly = plan.otherIncomes.reduce((s, o) => s + o.monthlyAmount, 0)
  const nowDividendMonthly = dividend.netMonthly
  const retiredDividendMonthly = (projectedDividend ?? dividend).netMonthly
  const nowMonthly = nowDividendMonthly + otherMonthly
  const retiredMonthly = retiredDividendMonthly + pension.monthlyTotal + otherMonthly
  const decent = plan.decentStandard.monthlyAmount
  return {
    decentMonthly: decent,
    nowMonthly,
    retiredMonthly,
    nowRatio: decent > 0 ? nowMonthly / decent : 0,
    retiredRatio: decent > 0 ? retiredMonthly / decent : 0,
    breakdown: {
      dividend: retiredDividendMonthly,
      pension: pension.monthlyTotal,
      other: otherMonthly,
    },
  }
}

/* -------- 4% 安全提现率 -------- */

export function safeWithdrawMonthly(totalAssetsCNY: number): number {
  return (totalAssetsCNY * 0.04) / 12
}

/* -------- 缺口分析 -------- */

export interface GapAnalysis {
  gapMonthly: number
  gapAnnual: number
  extraPrincipalAtReferenceYield: number
  referenceYield: number
}

const REFERENCE_YIELD = 0.05

export function computeGap(coverage: CoverageSummary): GapAnalysis {
  const gapMonthly = Math.max(coverage.decentMonthly - coverage.retiredMonthly, 0)
  const gapAnnual = gapMonthly * 12
  return {
    gapMonthly,
    gapAnnual,
    extraPrincipalAtReferenceYield: gapAnnual > 0 ? gapAnnual / REFERENCE_YIELD : 0,
    referenceYield: REFERENCE_YIELD,
  }
}

export function sumOtherIncome(items: OtherIncome[]): number {
  return items.reduce((s, o) => s + o.monthlyAmount, 0)
}

/**
 * 按月领取基本养老金的最低缴费年限（月）。
 * 依据《国务院关于渐进式延迟法定退休年龄的办法》附件二：
 *  - 2025-2029 年退休：保持 15 年（180 月）
 *  - 2030 起每年 +6 月（2030=186、2031=192 …）
 *  - 2039 及以后：20 年（240 月）
 */
export function getMinimumContributionMonths(retirementYear: number): number {
  if (retirementYear < 2030) return 180
  if (retirementYear >= 2039) return 240
  return 180 + (retirementYear - 2029) * 6
}
