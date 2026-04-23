// 养老规划（"岁月"tab）的数据模型

/** 单只股息股票持仓 */
export interface DividendHolding {
  id: string
  stockCode: string          // 例如 "600036"
  stockName: string          // 例如 "招商银行"
  shares: number             // 持股数
  /** 用户手动覆盖的每股年股息（元）。未设置时使用内置表默认值。 */
  dividendPerShareOverride?: number
  /** 近似税率；A股持有满1年免税，这里给用户自定义。默认 0。 */
  taxRate?: number
}

export type Gender = 'male' | 'femaleCadre' | 'femaleWorker'

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男性',
  femaleCadre: '女性（干部／管理技术岗）',
  femaleWorker: '女性（工人岗）',
}

/** 养老金缴费配置（MVP：企业职工简化公式，支持 2025 渐进式延迟退休） */
export interface PensionConfig {
  /** 缴费城市 key，见 pensionCities.ts */
  cityKey: string
  /** 性别与身份 */
  gender: Gender
  /** 出生年份 */
  birthYear: number
  /** 出生月份 1-12 */
  birthMonth: number
  /** 已缴费总月数 */
  monthsContributed: number
  /** 计划继续缴费月数（今起到退休止） */
  plannedFutureMonths: number
  /** 已缴费期间的平均缴费指数 0.6 - 3.0 */
  historicalIndex: number
  /** 未来期望的平均缴费指数 0.6 - 3.0 */
  futureIndex: number
  /** 弹性退休偏移（月）：负=提前；正=延后；区间 [-36, +36] */
  retirementOffsetMonths: number
  /** 个人账户累计储存额（元） */
  personalAccountBalance: number
}

/** "体面标准" —— 月度目标开支；未来可扩展为"体面指数"拆衣食住行 */
export interface DecentStandard {
  /** 月目标开支（元，税后） */
  monthlyAmount: number
  /** 预留：衣食住行拆分 */
  breakdown?: DecentBreakdownItem[]
}

export interface DecentBreakdownItem {
  id: string
  name: string            // 衣 / 食 / 住 / 行 / 其他
  monthlyAmount: number
}

/** 其它稳定被动收入（租金、年金等） */
export interface OtherIncome {
  id: string
  name: string
  monthlyAmount: number
}

/** 整体养老规划根对象 */
export interface RetirementPlan {
  decentStandard: DecentStandard
  holdings: DividendHolding[]
  pension: PensionConfig
  otherIncomes: OtherIncome[]
}

export const DEFAULT_PENSION: PensionConfig = {
  cityKey: 'beijing',
  gender: 'male',
  birthYear: 1990,
  birthMonth: 1,
  monthsContributed: 0,
  plannedFutureMonths: 0,
  historicalIndex: 1.0,
  futureIndex: 1.0,
  retirementOffsetMonths: 0,
  personalAccountBalance: 0,
}

export const DEFAULT_RETIREMENT_PLAN: RetirementPlan = {
  decentStandard: { monthlyAmount: 0 },
  holdings: [],
  pension: DEFAULT_PENSION,
  otherIncomes: [],
}
