/**
 * 商贷提前还款计算。
 *
 * 约定：
 * - 月利率 = 年利率 / 12（中国房贷惯例，而非几何年化）
 * - 等额本息（EPI）月供恒定；等额本金（EMP）首期高、逐月递减
 * - v1 只支持一次性提前还款
 */

export type RepaymentMethod = 'epi' | 'emp'
export type PrepaymentMode = 'shortenTerm' | 'reduceMonthly'

export interface MortgageInputs {
  principal: number         // 本金（元）
  years: number             // 贷款年限
  annualRatePct: number     // 年利率（百分数，例如 4.1）
  method: RepaymentMethod
  paidMonths: number        // 已还月数
  prepaymentAmount: number  // 预还金额（元）
  prepaymentMode: PrepaymentMode
}

export const DEFAULT_MORTGAGE_INPUTS: MortgageInputs = {
  principal: 1_000_000,
  years: 30,
  annualRatePct: 4.1,
  method: 'epi',
  paidMonths: 0,
  prepaymentAmount: 0,
  prepaymentMode: 'shortenTerm',
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
  // 总利息 = r * Σ(剩余本金) = r * P * (n+1)/2
  const totalInterest = r * principal * (totalMonths + 1) / 2
  return {
    monthlyPrincipal: mp, firstPayment, lastPayment,
    totalInterest, totalPayment: principal + totalInterest,
  }
}

/* -------- 进度推导（剩余本金 / 已付利息） -------- */

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
  // Σ_{i=1..k} (P - (i-1)*mp) * r = r * (P*k - mp*k*(k-1)/2)
  return r * (principal * k - mp * k * (k - 1) / 2)
}

/* -------- 提前还款 -------- */

export interface PrepayResult {
  valid: boolean
  original: {
    method: RepaymentMethod
    totalMonths: number
    monthlyPayment?: number     // EPI
    firstPayment?: number       // EMP
    lastPayment?: number        // EMP
    monthlyPrincipal?: number   // EMP
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
    newMonthlyPayment?: number        // EPI
    newFirstPayment?: number          // EMP
    newLastPayment?: number           // EMP
    newMonthlyPrincipal?: number      // EMP
    remainingInterest: number
    settled: boolean                   // 是否已全部还清
  }
  savings: {
    interestSaved: number              // 对比两种未来应付利息
    monthsShortened: number            // 仅 shortenTerm 非 0
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

export function prepay(inputs: MortgageInputs): PrepayResult {
  const {
    principal, years, annualRatePct, method,
    paidMonths, prepaymentAmount, prepaymentMode,
  } = inputs
  const totalMonths = Math.round(years * 12)
  const r = monthlyRate(annualRatePct)

  if (principal <= 0 || totalMonths <= 0 || paidMonths < 0 || paidMonths >= totalMonths) {
    return emptyResult(method)
  }

  if (method === 'epi') return prepayEPI(principal, annualRatePct, totalMonths, r, paidMonths, prepaymentAmount, prepaymentMode)
  return prepayEMP(principal, annualRatePct, totalMonths, r, paidMonths, prepaymentAmount, prepaymentMode)
}

function prepayEPI(
  P: number, annualRatePct: number, n: number, r: number,
  k: number, prepayAmount: number, mode: PrepaymentMode,
): PrepayResult {
  const orig = computeEPI(P, annualRatePct, n)
  const balanceBefore = remainingBalanceEPI(P, annualRatePct, n, k)
  const paidInterest = paidInterestEPI(P, annualRatePct, n, k)
  const paidPrincipal = P - balanceBefore
  // 原方案剩余应付利息
  const remainingInterestOriginal = orig.totalInterest - paidInterest

  const actualPrepay = Math.min(Math.max(0, prepayAmount), balanceBefore)
  const balanceAfter = balanceBefore - actualPrepay

  const originalBlock = {
    method: 'epi' as const, totalMonths: n,
    monthlyPayment: orig.monthlyPayment,
    totalInterest: orig.totalInterest, totalPayment: orig.totalPayment,
  }
  const paidBlock = { paidMonths: k, paidPrincipal, paidInterest }

  // 全部还清
  if (balanceAfter <= 0.01) {
    return {
      valid: true,
      original: originalBlock,
      paid: paidBlock,
      beforePrepay: { remainingBalance: balanceBefore },
      afterPrepay: {
        actualPrepayment: actualPrepay,
        newBalance: 0, newRemainingMonths: 0,
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
        // 月供还不足以覆盖当月利息（极端情况，通常不会出现）
        newRemainingMonths = 1
        remainingInterestAfter = balanceAfter * r
      } else {
        const tReal = -Math.log(1 - balanceAfter * r / newMonthlyPayment) / Math.log(1 + r)
        newRemainingMonths = Math.ceil(tReal)
        // 精确剩余利息（按真实非整数 t）
        remainingInterestAfter = Math.max(0, newMonthlyPayment * tReal - balanceAfter)
      }
    }
  } else {
    // reduceMonthly：保持剩余月数，重算月供
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
    valid: true,
    original: originalBlock,
    paid: paidBlock,
    beforePrepay: { remainingBalance: balanceBefore },
    afterPrepay: {
      actualPrepayment: actualPrepay,
      newBalance: balanceAfter, newRemainingMonths, newMonthlyPayment,
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
      valid: true,
      original: originalBlock,
      paid: paidBlock,
      beforePrepay: { remainingBalance: balanceBefore },
      afterPrepay: {
        actualPrepayment: actualPrepay,
        newBalance: 0, newRemainingMonths: 0,
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
    // 每月本金保持原 mp 不变
    newMonthlyPrincipal = orig.monthlyPrincipal
    const fullMonths = Math.floor(balanceAfter / newMonthlyPrincipal)
    const residual = balanceAfter - fullMonths * newMonthlyPrincipal
    const lastMonthPrincipal = residual > 0.01 ? residual : newMonthlyPrincipal
    newRemainingMonths = residual > 0.01 ? fullMonths + 1 : fullMonths
    newFirstPayment = newMonthlyPrincipal + balanceAfter * r
    newLastPayment = lastMonthPrincipal + lastMonthPrincipal * r
    // 利息 = r * (首 n-1 月完整 mp 的剩余本金之和 + 末月残留)
    const full = newRemainingMonths - 1
    const fullSum = balanceAfter * full - newMonthlyPrincipal * full * (full - 1) / 2
    remainingInterestAfter = r * (fullSum + lastMonthPrincipal)
  } else {
    // reduceMonthly：保持剩余月数，每月本金降低
    newRemainingMonths = remainOriginal
    newMonthlyPrincipal = balanceAfter / remainOriginal
    newFirstPayment = newMonthlyPrincipal + balanceAfter * r
    newLastPayment = newMonthlyPrincipal + newMonthlyPrincipal * r
    remainingInterestAfter = r * balanceAfter * (remainOriginal + 1) / 2
  }

  return {
    valid: true,
    original: originalBlock,
    paid: paidBlock,
    beforePrepay: { remainingBalance: balanceBefore },
    afterPrepay: {
      actualPrepayment: actualPrepay,
      newBalance: balanceAfter, newRemainingMonths,
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
