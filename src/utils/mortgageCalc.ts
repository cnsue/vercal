/**
 * 房贷提前还款计算（支持商业贷款、公积金贷款、组合贷款）。
 *
 * 约定：
 * - 月利率 = 年利率 / 12（中国房贷惯例，而非几何年化）
 * - 等额本息（EPI）月供恒定；等额本金（EMP）首期高、逐月递减
 * - 已还月数由首次还款年月自动推算
 */

export type RepaymentMethod = 'epi' | 'emp'
export type PrepaymentMode = 'shortenTerm' | 'reduceMonthly'
export type LoanType = 'commercial' | 'providentFund' | 'combined'
export type PrepayTarget = 'commercial' | 'pf'

// 参考利率基准（2024 年末）
export const LPR_5Y = 3.10        // 5 年期 LPR
export const PF_RATE_5Y = 2.85    // 公积金 5 年以上基准利率

export const LPR_PRESETS_BPS = [-100, -50, -30, -20, -10, 0, 10, 20, 30] as const
export const PF_PRESETS_BPS  = [-20, -10, 0, 10, 20] as const

export interface MortgageInputs {
  loanType: LoanType

  // 商业贷款（或纯公积金时同一套字段）
  principal: number
  years: number
  annualRatePct: number
  method: RepaymentMethod

  // 公积金部分（仅组合贷款使用）
  pfPrincipal: number
  pfYears: number
  pfAnnualRatePct: number
  pfMethod: RepaymentMethod

  firstRepaymentDate: string   // "YYYY-MM"
  prepaymentAmount: number
  prepaymentMode: PrepaymentMode
  prepayTarget: PrepayTarget   // 组合贷款提前还哪部分
}

/** 由首次还款年月推算已还月数（截至当前月） */
export function computePaidMonths(firstRepaymentDate: string): number {
  const m = firstRepaymentDate.match(/^(\d{4})-(\d{2})$/)
  if (!m) return 0
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const now = new Date()
  const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month)
  return Math.max(0, months)
}

function defaultFirstRepaymentDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 3)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const DEFAULT_MORTGAGE_INPUTS: MortgageInputs = {
  loanType: 'commercial',
  principal: 1_000_000,
  years: 30,
  annualRatePct: LPR_5Y,
  method: 'epi',
  pfPrincipal: 300_000,
  pfYears: 20,
  pfAnnualRatePct: PF_RATE_5Y,
  pfMethod: 'epi',
  firstRepaymentDate: defaultFirstRepaymentDate(),
  prepaymentAmount: 0,
  prepaymentMode: 'shortenTerm',
  prepayTarget: 'commercial',
}

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12
}

/* -------- 原方案 -------- */

export interface EPIPlan {
  monthlyPayment: number
  totalInterest: number
  totalPayment: number
}

export function computeEPI(principal: number, annualRatePct: number, totalMonths: number): EPIPlan {
  if (totalMonths <= 0 || principal <= 0) {
    return { monthlyPayment: 0, totalInterest: 0, totalPayment: 0 }
  }
  const r = monthlyRate(annualRatePct)
  if (r <= 0) {
    const m = principal / totalMonths
    return { monthlyPayment: m, totalInterest: 0, totalPayment: principal }
  }
  const pow = Math.pow(1 + r, totalMonths)
  const m = principal * r * pow / (pow - 1)
  return {
    monthlyPayment: m,
    totalInterest: m * totalMonths - principal,
    totalPayment: m * totalMonths,
  }
}

export interface EMPPlan {
  monthlyPrincipal: number
  firstPayment: number
  lastPayment: number
  totalInterest: number
  totalPayment: number
}

export function computeEMP(principal: number, annualRatePct: number, totalMonths: number): EMPPlan {
  if (totalMonths <= 0 || principal <= 0) {
    return { monthlyPrincipal: 0, firstPayment: 0, lastPayment: 0, totalInterest: 0, totalPayment: 0 }
  }
  const r = monthlyRate(annualRatePct)
  const mp = principal / totalMonths
  const firstPayment = mp + principal * r
  const lastPayment = mp + mp * r
  const totalInterest = r * principal * (totalMonths + 1) / 2
  return {
    monthlyPrincipal: mp, firstPayment, lastPayment,
    totalInterest, totalPayment: principal + totalInterest,
  }
}

/* -------- 进度推导 -------- */

export function remainingBalanceEPI(
  principal: number, annualRatePct: number, totalMonths: number, paidMonths: number,
): number {
  if (paidMonths >= totalMonths) return 0
  if (paidMonths <= 0) return principal
  const r = monthlyRate(annualRatePct)
  if (r <= 0) return principal * (1 - paidMonths / totalMonths)
  const { monthlyPayment } = computeEPI(principal, annualRatePct, totalMonths)
  const pow = Math.pow(1 + r, paidMonths)
  const b = principal * pow - monthlyPayment * (pow - 1) / r
  return Math.max(0, b)
}

export function remainingBalanceEMP(principal: number, totalMonths: number, paidMonths: number): number {
  if (paidMonths >= totalMonths) return 0
  if (paidMonths <= 0) return principal
  return principal * (totalMonths - paidMonths) / totalMonths
}

function paidInterestEPI(principal: number, annualRatePct: number, totalMonths: number, paidMonths: number): number {
  if (paidMonths <= 0) return 0
  const { monthlyPayment } = computeEPI(principal, annualRatePct, totalMonths)
  const balance = remainingBalanceEPI(principal, annualRatePct, totalMonths, paidMonths)
  const paidPrincipal = principal - balance
  return Math.max(0, monthlyPayment * Math.min(paidMonths, totalMonths) - paidPrincipal)
}

function paidInterestEMP(principal: number, annualRatePct: number, totalMonths: number, paidMonths: number): number {
  if (paidMonths <= 0) return 0
  const r = monthlyRate(annualRatePct)
  const mp = principal / totalMonths
  const k = Math.min(paidMonths, totalMonths)
  return r * (principal * k - mp * k * (k - 1) / 2)
}

/* -------- 提前还款结果类型 -------- */

export interface PrepayResult {
  valid: boolean
  original: {
    method: RepaymentMethod
    totalMonths: number
    monthlyPayment?: number
    firstPayment?: number
    lastPayment?: number
    monthlyPrincipal?: number
    totalInterest: number
    totalPayment: number
  }
  paid: {
    paidMonths: number
    paidPrincipal: number
    paidInterest: number
  }
  beforePrepay: {
    remainingBalance: number
  }
  afterPrepay: {
    actualPrepayment: number
    newBalance: number
    newRemainingMonths: number
    newMonthlyPayment?: number
    newFirstPayment?: number
    newLastPayment?: number
    newMonthlyPrincipal?: number
    remainingInterest: number
    settled: boolean
  }
  savings: {
    interestSaved: number
    monthsShortened: number
  }
}

function emptyResult(method: RepaymentMethod): PrepayResult {
  return {
    valid: false,
    original: { method, totalMonths: 0, totalInterest: 0, totalPayment: 0 },
    paid: { paidMonths: 0, paidPrincipal: 0, paidInterest: 0 },
    beforePrepay: { remainingBalance: 0 },
    afterPrepay: { actualPrepayment: 0, newBalance: 0, newRemainingMonths: 0, remainingInterest: 0, settled: false },
    savings: { interestSaved: 0, monthsShortened: 0 },
  }
}

/* -------- 核心计算（接受已还月数） -------- */

export function prepayLoan(
  principal: number, years: number, annualRatePct: number,
  method: RepaymentMethod, paidMonths: number,
  prepaymentAmount: number, prepaymentMode: PrepaymentMode,
): PrepayResult {
  const totalMonths = Math.round(years * 12)
  const r = monthlyRate(annualRatePct)
  if (principal <= 0 || totalMonths <= 0 || paidMonths < 0 || paidMonths >= totalMonths) {
    return emptyResult(method)
  }
  if (method === 'epi') {
    return prepayEPI(principal, annualRatePct, totalMonths, r, paidMonths, prepaymentAmount, prepaymentMode)
  }
  return prepayEMP(principal, annualRatePct, totalMonths, r, paidMonths, prepaymentAmount, prepaymentMode)
}

/** 高层入口：从 MortgageInputs 中取商业贷款字段计算，已还月数由首次还款日期推算 */
export function prepay(inputs: MortgageInputs): PrepayResult {
  const paidMonths = computePaidMonths(inputs.firstRepaymentDate)
  return prepayLoan(
    inputs.principal, inputs.years, inputs.annualRatePct, inputs.method,
    paidMonths, inputs.prepaymentAmount, inputs.prepaymentMode,
  )
}

/* -------- EPI / EMP 内部实现（与原版完全一致） -------- */

function prepayEPI(
  P: number, annualRatePct: number, n: number, r: number,
  k: number, prepayAmount: number, mode: PrepaymentMode,
): PrepayResult {
  const orig = computeEPI(P, annualRatePct, n)
  const balanceBefore = remainingBalanceEPI(P, annualRatePct, n, k)
  const paidInterest = paidInterestEPI(P, annualRatePct, n, k)
  const paidPrincipal = P - balanceBefore
  const remainingInterestOriginal = orig.totalInterest - paidInterest

  const actualPrepay = Math.min(Math.max(0, prepayAmount), balanceBefore)
  const balanceAfter = balanceBefore - actualPrepay

  const originalBlock = {
    method: 'epi' as const, totalMonths: n,
    monthlyPayment: orig.monthlyPayment,
    totalInterest: orig.totalInterest, totalPayment: orig.totalPayment,
  }
  const paidBlock = { paidMonths: k, paidPrincipal, paidInterest }

  if (balanceAfter <= 0.01) {
    return {
      valid: true, original: originalBlock, paid: paidBlock,
      beforePrepay: { remainingBalance: balanceBefore },
      afterPrepay: {
        actualPrepayment: actualPrepay, newBalance: 0, newRemainingMonths: 0,
        newMonthlyPayment: 0, remainingInterest: 0, settled: true,
      },
      savings: { interestSaved: remainingInterestOriginal, monthsShortened: n - k },
    }
  }

  const remainOriginal = n - k
  let newMonthlyPayment: number
  let newRemainingMonths: number
  let remainingInterestAfter: number

  if (mode === 'shortenTerm') {
    newMonthlyPayment = orig.monthlyPayment
    if (r <= 0) {
      newRemainingMonths = Math.ceil(balanceAfter / newMonthlyPayment)
      remainingInterestAfter = 0
    } else {
      const denom = newMonthlyPayment - balanceAfter * r
      if (denom <= 0) {
        newRemainingMonths = 1
        remainingInterestAfter = balanceAfter * r
      } else {
        const tReal = -Math.log(1 - balanceAfter * r / newMonthlyPayment) / Math.log(1 + r)
        newRemainingMonths = Math.ceil(tReal)
        remainingInterestAfter = Math.max(0, newMonthlyPayment * tReal - balanceAfter)
      }
    }
  } else {
    newRemainingMonths = remainOriginal
    if (r <= 0) {
      newMonthlyPayment = balanceAfter / remainOriginal
      remainingInterestAfter = 0
    } else {
      const pow = Math.pow(1 + r, remainOriginal)
      newMonthlyPayment = balanceAfter * r * pow / (pow - 1)
      remainingInterestAfter = newMonthlyPayment * remainOriginal - balanceAfter
    }
  }

  return {
    valid: true, original: originalBlock, paid: paidBlock,
    beforePrepay: { remainingBalance: balanceBefore },
    afterPrepay: {
      actualPrepayment: actualPrepay, newBalance: balanceAfter,
      newRemainingMonths, newMonthlyPayment,
      remainingInterest: remainingInterestAfter, settled: false,
    },
    savings: {
      interestSaved: remainingInterestOriginal - remainingInterestAfter,
      monthsShortened: mode === 'shortenTerm' ? remainOriginal - newRemainingMonths : 0,
    },
  }
}

function prepayEMP(
  P: number, annualRatePct: number, n: number, r: number,
  k: number, prepayAmount: number, mode: PrepaymentMode,
): PrepayResult {
  const orig = computeEMP(P, annualRatePct, n)
  const balanceBefore = remainingBalanceEMP(P, n, k)
  const paidInterest = paidInterestEMP(P, annualRatePct, n, k)
  const paidPrincipal = P - balanceBefore
  const remainingInterestOriginal = orig.totalInterest - paidInterest

  const actualPrepay = Math.min(Math.max(0, prepayAmount), balanceBefore)
  const balanceAfter = balanceBefore - actualPrepay

  const originalBlock = {
    method: 'emp' as const, totalMonths: n,
    monthlyPrincipal: orig.monthlyPrincipal,
    firstPayment: orig.firstPayment, lastPayment: orig.lastPayment,
    totalInterest: orig.totalInterest, totalPayment: orig.totalPayment,
  }
  const paidBlock = { paidMonths: k, paidPrincipal, paidInterest }

  if (balanceAfter <= 0.01) {
    return {
      valid: true, original: originalBlock, paid: paidBlock,
      beforePrepay: { remainingBalance: balanceBefore },
      afterPrepay: {
        actualPrepayment: actualPrepay, newBalance: 0, newRemainingMonths: 0,
        newMonthlyPrincipal: 0, newFirstPayment: 0, newLastPayment: 0,
        remainingInterest: 0, settled: true,
      },
      savings: { interestSaved: remainingInterestOriginal, monthsShortened: n - k },
    }
  }

  const remainOriginal = n - k
  let newMonthlyPrincipal: number
  let newRemainingMonths: number
  let newFirstPayment: number
  let newLastPayment: number
  let remainingInterestAfter: number

  if (mode === 'shortenTerm') {
    newMonthlyPrincipal = orig.monthlyPrincipal
    const fullMonths = Math.floor(balanceAfter / newMonthlyPrincipal)
    const residual = balanceAfter - fullMonths * newMonthlyPrincipal
    const lastMonthPrincipal = residual > 0.01 ? residual : newMonthlyPrincipal
    newRemainingMonths = residual > 0.01 ? fullMonths + 1 : fullMonths
    newFirstPayment = newMonthlyPrincipal + balanceAfter * r
    newLastPayment = lastMonthPrincipal + lastMonthPrincipal * r
    const full = newRemainingMonths - 1
    const fullSum = balanceAfter * full - newMonthlyPrincipal * full * (full - 1) / 2
    remainingInterestAfter = r * (fullSum + lastMonthPrincipal)
  } else {
    newRemainingMonths = remainOriginal
    newMonthlyPrincipal = balanceAfter / remainOriginal
    newFirstPayment = newMonthlyPrincipal + balanceAfter * r
    newLastPayment = newMonthlyPrincipal + newMonthlyPrincipal * r
    remainingInterestAfter = r * balanceAfter * (remainOriginal + 1) / 2
  }

  return {
    valid: true, original: originalBlock, paid: paidBlock,
    beforePrepay: { remainingBalance: balanceBefore },
    afterPrepay: {
      actualPrepayment: actualPrepay, newBalance: balanceAfter, newRemainingMonths,
      newMonthlyPrincipal, newFirstPayment, newLastPayment,
      remainingInterest: remainingInterestAfter, settled: false,
    },
    savings: {
      interestSaved: remainingInterestOriginal - remainingInterestAfter,
      monthsShortened: mode === 'shortenTerm' ? remainOriginal - newRemainingMonths : 0,
    },
  }
}

/** 把月数格式化为 "X 年 Y 月" */
export function formatMonths(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return '0 月'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m} 月`
  if (m === 0) return `${y} 年`
  return `${y} 年 ${m} 月`
}
