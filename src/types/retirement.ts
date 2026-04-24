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
  /** 手动覆盖社平工资/养老金计发基数（元/月）。未设置时使用城市内置值。 */
  averageWageOverride?: number
  /** 性别与身份 */
  gender: Gender
  /** 出生年份 */
  birthYear: number
  /** 出生月份 1-12 */
  birthMonth: number
  /** 已缴费总月数 */
  monthsContributed: number
  /** 计划停止缴费的年份（用户选定）；系统据此派生 plannedFutureMonths */
  plannedStopYear: number
  /** 计划停止缴费的月份 1-12 */
  plannedStopMonth: number
  /** 已缴费期间的平均缴费指数 0.6 - 3.0 */
  historicalIndex: number
  /** 未来期望的平均缴费指数 0.6 - 3.0 */
  futureIndex: number
  /** 弹性退休偏移（月）：负=提前；正=延后；区间 [-36, +36] */
  retirementOffsetMonths: number
  /** 个人账户累计储存额（元） */
  personalAccountBalance: number
  /** 在岗职工平均工资年增长率（小数，如 0.05 = 5%）。人社部默认 0（按今日购买力）。 */
  socialWageGrowthRate: number
  /** 个人账户记账利率（小数，如 0.0262 = 2.62%）。人社部默认 2.62%。 */
  personalAccountRate: number
}

/** 股息增长预期场景 */
export type DividendGrowthScenario = 'pessimistic' | 'neutral' | 'optimistic'

export const DIVIDEND_SCENARIO_LABELS: Record<DividendGrowthScenario, string> = {
  pessimistic: '悲观',
  neutral: '中立',
  optimistic: '乐观',
}

/** "体面标准" —— 支持 6 个内置维度 + 用户自定义 */
export type DecentDimensionKey = 'food' | 'housing' | 'transport' | 'medical' | 'leisure' | 'social'

export interface DecentBreakdownItem {
  /** 内置项 = builtinKey；自定义 = uuid */
  id: string
  /** 仅内置项携带；自定义项为空 */
  builtinKey?: DecentDimensionKey
  name: string
  icon: string
  monthlyAmount: number
}

export interface DecentStandard {
  /** 月目标开支（元，税后）。由 breakdown 汇总，保持冗余方便老代码读取。 */
  monthlyAmount: number
  /** 维度预算；未设置时为空数组（触发首次向导） */
  breakdown: DecentBreakdownItem[]
}

export interface DecentDimensionMeta {
  key: DecentDimensionKey
  label: string
  icon: string
  description: string
  defaultMonthly: number
  suggestion: string
}

export const DECENT_DIMENSIONS: readonly DecentDimensionMeta[] = [
  {
    key: 'food', label: '食', icon: '🍱', defaultMonthly: 2400,
    description: '三餐、食材、外卖、饮品、节日食品',
    suggestion: '可关注食品饮料、必选消费板块的稳定分红标的，生活刚需现金流波动小。',
  },
  {
    key: 'housing', label: '住', icon: '🏠', defaultMonthly: 3000,
    description: '房租 / 按揭、水电煤、物业、维修、家装',
    suggestion: '若租房，可通过 REITs / 公用事业股息对冲房租；若自住，重点覆盖物业与维护。',
  },
  {
    key: 'transport', label: '行', icon: '🚌', defaultMonthly: 1000,
    description: '公共交通、打车、油费、停车、远行出游',
    suggestion: '出行开销弹性大，可用红利低波类 ETF 或公共交通类个股覆盖。',
  },
  {
    key: 'medical', label: '医', icon: '🏥', defaultMonthly: 2400,
    description: '日常医疗、保健、体检、慢病、长期护理',
    suggestion: '医疗开销随年龄上行，建议增加医药、保险板块的高股息配置，并留出医疗专项应急金。',
  },
  {
    key: 'leisure', label: '乐', icon: '🎨', defaultMonthly: 1800,
    description: '娱乐、订阅、旅行、学习成长、文体活动',
    suggestion: '娱乐、旅行、文化消费，可由文娱、传媒或自由现金流覆盖，弹性调整。',
  },
  {
    key: 'social', label: '爱', icon: '💞', defaultMonthly: 1400,
    description: '人情、赡养、子女教育、公益、宠物',
    suggestion: '家庭、人情、公益支出，优先用稳定现金流（债息、年金）托底。',
  },
] as const

export const DEFAULT_CUSTOM_SUGGESTION = '按自身计划调整预算与对应现金流来源。'

export function findDimensionMeta(key: DecentDimensionKey | undefined): DecentDimensionMeta | undefined {
  if (!key) return undefined
  return DECENT_DIMENSIONS.find(d => d.key === key)
}

export function defaultDecentBreakdown(): DecentBreakdownItem[] {
  return DECENT_DIMENSIONS.map(d => ({
    id: d.key,
    builtinKey: d.key,
    name: d.label,
    icon: d.icon,
    monthlyAmount: d.defaultMonthly,
  }))
}

export function sumBreakdown(items: DecentBreakdownItem[]): number {
  return items.reduce((s, i) => s + Math.max(0, i.monthlyAmount), 0)
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
  dividendScenario: DividendGrowthScenario
}

export const DEFAULT_PENSION: PensionConfig = {
  cityKey: 'beijing',
  gender: 'male',
  birthYear: 1990,
  birthMonth: 1,
  monthsContributed: 0,
  plannedStopYear: new Date().getFullYear(),
  plannedStopMonth: new Date().getMonth() + 1,
  historicalIndex: 1.0,
  futureIndex: 1.0,
  retirementOffsetMonths: 0,
  personalAccountBalance: 0,
  socialWageGrowthRate: 0,
  personalAccountRate: 0.0262,
}

export const DEFAULT_RETIREMENT_PLAN: RetirementPlan = {
  decentStandard: { monthlyAmount: 0, breakdown: [] },
  holdings: [],
  pension: DEFAULT_PENSION,
  otherIncomes: [],
  dividendScenario: 'neutral',
}
