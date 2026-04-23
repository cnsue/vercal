import type {
  DividendHolding, PensionConfig, RetirementPlan, OtherIncome,
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
  referenceMarketValue: number // 参考市值（按内置参考价），用于估算仓位
  /** 按参考价计算的年化股息率（%）；未知参考价时为 0 */
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
    grossAnnual,
    netAnnual,
    netMonthly: netAnnual / 12,
    totalReferenceMarketValue,
    perHolding,
  }
}

/* -------- 养老金简化公式 -------- */

export interface PensionProjection {
  valid: boolean
  /** 退休时当地社平工资（元/月，含增长假设） */
  projectedSocialWage: number
  /** 基础养老金（元/月） */
  basicPension: number
  /** 个人账户养老金（元/月） */
  personalAccountPension: number
  /** 月养老金合计（元） */
  monthlyTotal: number
  /** 总缴费年限 */
  totalYears: number
  /** 退休时预计个人账户余额（元） */
  projectedPersonalBalance: number
}

export function computePensionProjection(cfg: PensionConfig): PensionProjection {
  const city = findPensionCity(cfg.cityKey)
  const yearsToRetire = Math.max(cfg.retirementAge - cfg.currentAge, 0)
  const totalYears = cfg.yearsContributed + Math.min(cfg.plannedFutureYears, yearsToRetire)

  if (!city || totalYears <= 0) {
    return {
      valid: false,
      projectedSocialWage: city?.averageWage ?? 0,
      basicPension: 0,
      personalAccountPension: 0,
      monthlyTotal: 0,
      totalYears,
      projectedPersonalBalance: cfg.personalAccountBalance,
    }
  }

  // 退休时社平工资（按年增长率复利）
  const projectedSocialWage = city.averageWage * Math.pow(1 + SOCIAL_WAGE_GROWTH_RATE, yearsToRetire)

  // 基础养老金 = 退休时社平工资 × (1 + 平均缴费指数) / 2 × 缴费年限 × 1%
  const idx = Math.max(0.6, Math.min(cfg.averageContributionIndex, 3.0))
  const basicPension = projectedSocialWage * (1 + idx) / 2 * totalYears * 0.01

  // 退休时个人账户余额 ≈ 现有余额 + 未来缴费期间年均缴入（中位社平工资）
  const futureYears = Math.min(cfg.plannedFutureYears, yearsToRetire)
  const midWage = (city.averageWage + projectedSocialWage) / 2
  const annualContribution = midWage * idx * 0.08 * 12
  // 简化：按 3% 年化复利粗略膨胀现有账户
  const grownBalance = cfg.personalAccountBalance * Math.pow(1.03, yearsToRetire)
  const projectedPersonalBalance = grownBalance + annualContribution * futureYears

  const months = getPersonalAccountMonths(cfg.retirementAge)
  const personalAccountPension = projectedPersonalBalance / months

  return {
    valid: true,
    projectedSocialWage,
    basicPension,
    personalAccountPension,
    monthlyTotal: basicPension + personalAccountPension,
    totalYears,
    projectedPersonalBalance,
  }
}

/* -------- 体面覆盖率 -------- */

export interface CoverageSummary {
  /** 月目标开支（体面标准） */
  decentMonthly: number
  /** 月度总现金流（股息 + 养老金 + 其他被动） */
  monthlyIncome: number
  /** 覆盖率，0 = 未设置 */
  ratio: number
  /** 构成 */
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
): CoverageSummary {
  const otherMonthly = plan.otherIncomes.reduce((s, o) => s + o.monthlyAmount, 0)
  const monthlyIncome = dividend.netMonthly + pension.monthlyTotal + otherMonthly
  const decent = plan.decentStandard.monthlyAmount
  const ratio = decent > 0 ? monthlyIncome / decent : 0
  return {
    decentMonthly: decent,
    monthlyIncome,
    ratio,
    breakdown: {
      dividend: dividend.netMonthly,
      pension: pension.monthlyTotal,
      other: otherMonthly,
    },
  }
}

/* -------- 4% 安全提现率（基于总资产） -------- */

export function safeWithdrawMonthly(totalAssetsCNY: number): number {
  return (totalAssetsCNY * 0.04) / 12
}

/* -------- 缺口分析 / 智能建议 -------- */

export interface GapAnalysis {
  gapMonthly: number             // >0 表示缺口
  gapAnnual: number
  /** 要完全覆盖，需要再增加多少高股息本金（按 5% 参考股息率） */
  extraPrincipalAtReferenceYield: number
  referenceYield: number
}

const REFERENCE_YIELD = 0.05

export function computeGap(coverage: CoverageSummary): GapAnalysis {
  const gapMonthly = Math.max(coverage.decentMonthly - coverage.monthlyIncome, 0)
  const gapAnnual = gapMonthly * 12
  return {
    gapMonthly,
    gapAnnual,
    extraPrincipalAtReferenceYield: gapAnnual > 0 ? gapAnnual / REFERENCE_YIELD : 0,
    referenceYield: REFERENCE_YIELD,
  }
}

/* -------- 其它被动收入合计（方便调用） -------- */

export function sumOtherIncome(items: OtherIncome[]): number {
  return items.reduce((s, o) => s + o.monthlyAmount, 0)
}
