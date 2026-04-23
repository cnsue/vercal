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

/** 养老金缴费配置（MVP：企业职工简化公式） */
export interface PensionConfig {
  /** 缴费城市 key，见 pensionCities.ts */
  cityKey: string
  /** 平均缴费指数，0.6 - 3.0 */
  averageContributionIndex: number
  /** 已缴费年限 */
  yearsContributed: number
  /** 计划继续缴费年限（到退休为止） */
  plannedFutureYears: number
  /** 个人账户累计储存额（元） */
  personalAccountBalance: number
  /** 预期退休年龄 */
  retirementAge: number
  /** 当前年龄 */
  currentAge: number
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

export const DEFAULT_RETIREMENT_PLAN: RetirementPlan = {
  decentStandard: { monthlyAmount: 0 },
  holdings: [],
  pension: {
    cityKey: 'beijing',
    averageContributionIndex: 1.0,
    yearsContributed: 0,
    plannedFutureYears: 0,
    personalAccountBalance: 0,
    retirementAge: 60,
    currentAge: 30,
  },
  otherIncomes: [],
}
