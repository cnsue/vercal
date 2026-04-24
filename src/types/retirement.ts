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

/** "体面标准" —— 支持 7 个内置维度 + 用户自定义 */
export type DecentDimensionKey = 'clothing' | 'food' | 'housing' | 'transport' | 'medical' | 'leisure' | 'social'

/** 优先级：1 = 必需（衣食住行），2 = 弹性（医乐爱及自定义）。收入瀑布式分摊，高优先级先满足。 */
export type DecentPriority = 1 | 2

export const DECENT_PRIORITY_LABELS: Record<DecentPriority, string> = {
  1: '必需',
  2: '弹性',
}

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
  priority: DecentPriority
}

export const DECENT_DIMENSIONS: readonly DecentDimensionMeta[] = [
  {
    key: 'clothing', label: '衣', icon: '👕', defaultMonthly: 600,
    description: '衣着、鞋袜、洗护、换季更新',
    priority: 1,
    suggestion: '衣着支出波动不大，可由综合消费类股息或通用流动性资金覆盖。',
  },
  {
    key: 'food', label: '食', icon: '🍱', defaultMonthly: 2400,
    description: '三餐、食材、外卖、饮品、节日食品',
    priority: 1,
    suggestion: '可关注食品饮料、必选消费板块的稳定分红标的，生活刚需现金流波动小。',
  },
  {
    key: 'housing', label: '住', icon: '🏠', defaultMonthly: 3000,
    description: '房租 / 按揭、水电煤、物业、维修、家装',
    priority: 1,
    suggestion: '若租房，可通过 REITs / 公用事业股息对冲房租；若自住，重点覆盖物业与维护。',
  },
  {
    key: 'transport', label: '行', icon: '🚌', defaultMonthly: 1000,
    description: '公共交通、打车、油费、停车、远行出游',
    priority: 1,
    suggestion: '出行开销弹性大，可用红利低波类 ETF 或公共交通类个股覆盖。',
  },
  {
    key: 'medical', label: '医', icon: '🏥', defaultMonthly: 2400,
    description: '日常医疗、保健、体检、慢病、长期护理',
    priority: 2,
    suggestion: '医疗开销随年龄上行，建议增加医药、保险板块的高股息配置，并留出医疗专项应急金。',
  },
  {
    key: 'leisure', label: '乐', icon: '🎨', defaultMonthly: 1800,
    description: '娱乐、订阅、旅行、学习成长、文体活动',
    priority: 2,
    suggestion: '娱乐、旅行、文化消费，可由文娱、传媒或自由现金流覆盖，弹性调整。',
  },
  {
    key: 'social', label: '爱', icon: '💞', defaultMonthly: 1400,
    description: '人情、赡养、子女教育、公益、宠物',
    priority: 2,
    suggestion: '家庭、人情、公益支出，优先用稳定现金流（债息、年金）托底。',
  },
] as const

export const CUSTOM_PRIORITY: DecentPriority = 2
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

/* ────────────────────────────────────────────────
   体面覆盖率层级系统（L1–L5）
──────────────────────────────────────────────── */

export interface CoverageLevel {
  key:         'subsistence' | 'stable' | 'decent' | 'comfortable' | 'fulfilled'
  label:       string
  emoji:       string
  slogan:      string
  description: string   // 三口之家一线城市生活状态
  minRatio:    number   // 触发该层级所需最低覆盖率
  color:       string   // 主色 hex
  gradient:    string   // 卡片背景渐变
}

export const COVERAGE_LEVELS: CoverageLevel[] = [
  {
    key: 'subsistence', label: '温饱', emoji: '🏠', minRatio: 0.5,
    color: '#8B9D6B', gradient: 'linear-gradient(135deg, #6a7a50 0%, #9baf74 100%)',
    slogan: '日子能过，心不慌',
    description: '住偏远小户型（房贷/租约8.5k），吃饭基本自己做，孩子仅上公立普惠幼儿园，医疗靠医保小病扛，无娱乐预算。艰难维持，但能活。',
  },
  {
    key: 'stable', label: '安稳', emoji: '⚓', minRatio: 0.7,
    color: '#5B8CBE', gradient: 'linear-gradient(135deg, #3c6e9e 0%, #6fa4d2 100%)',
    slogan: '日常够用，有存款',
    description: '住独立一房一厅（房贷约13k），每周可外食一次，孩子有牛奶水果，能报一个低价兴趣班，偶尔去免费公园。日子紧巴但稳定，有些许期待。',
  },
  {
    key: 'decent', label: '体面', emoji: '✨', minRatio: 1.0,
    color: '#C58A20', gradient: 'linear-gradient(135deg, #c07c15 0%, #e8a735 100%)',
    slogan: '活得有尊严，不将就',
    description: '房贷26k，优质公立幼儿园+多个兴趣班，每月存6k孩子未来基金，周末可去科技馆/动物园，每年一次旅行，父母月汇500元。有尊严、不窘迫，孩子快乐成长。',
  },
  {
    key: 'comfortable', label: '从容', emoji: '☕', minRatio: 1.2,
    color: '#7C6A9E', gradient: 'linear-gradient(135deg, #5c4a7e 0%, #8a75ae 100%)',
    slogan: '宽裕有余，不急不躁',
    description: '房贷34k（更大地段），孩子私立双语幼儿园/国际班，每月存8k托举，每年两次长途旅行，医疗升级到私立门诊。从容不迫，生活有品质。',
  },
  {
    key: 'fulfilled', label: '圆满', emoji: '🦋', minRatio: 1.5,
    color: '#D96B5C', gradient: 'linear-gradient(135deg, #b85a4d 0%, #e08575 100%)',
    slogan: '人生无憾，心满意足',
    description: '房贷42k（或已还清），国际学校，每月存10k托举（可为孩子存够首付），旅行自由，有大额捐赠能力。精神物质双丰收，人生无憾。',
  },
]

/** 返回当前比率对应的最高层级；< 0.5 时返回 null */
export function getCoverageLevel(ratio: number): CoverageLevel | null {
  return [...COVERAGE_LEVELS].reverse().find(l => ratio >= l.minRatio) ?? null
}

/** 返回下一个未达到的层级；圆满已达时返回 null */
export function getNextCoverageLevel(ratio: number): CoverageLevel | null {
  return COVERAGE_LEVELS.find(l => ratio < l.minRatio) ?? null
}

/* ────────────────────────────────────────────────
   家庭套餐预算数据（三口之家 × 一线城市基准）
──────────────────────────────────────────────── */

export type FamilySize = 'single' | 'couple' | 'family3' | 'family4'
export type CityTier   = 'tier1' | 'newTier1' | 'tier23' | 'tier45'

export const FAMILY_SIZE_LABELS: Record<FamilySize, string> = {
  single: '单人', couple: '两口', family3: '三口', family4: '四口',
}

export const CITY_TIER_LABELS: Record<CityTier, string> = {
  tier1: '一线', newTier1: '新一线', tier23: '二三线', tier45: '四五线',
}

/**
 * 三口之家 × 一线城市各层级维度月度预算基准（元/月）
 * 合计：温饱 13,150 / 安稳 22,200 / 体面 49,400 / 从容 65,700 / 圆满 82,900
 * 爱(social)内部：L3 = 教育4k+赡养1.3k+托举6k；L4 托举8k；L5 托举10k
 */
export const BUDGET_PRESETS_FAMILY3_TIER1: Record<string, Record<string, number>> = {
  subsistence: { clothing: 250,  food: 2500,  housing: 8500,  transport: 400,  medical: 400,  leisure: 300,  social: 800   },
  stable:      { clothing: 500,  food: 4200,  housing: 13000, transport: 700,  medical: 700,  leisure: 900,  social: 2200  },
  decent:      { clothing: 1000, food: 6500,  housing: 26000, transport: 1300, medical: 1300, leisure: 2000, social: 11300 },
  comfortable: { clothing: 1300, food: 8500,  housing: 34000, transport: 1800, medical: 1800, leisure: 2800, social: 15500 },
  fulfilled:   { clothing: 2000, food: 10500, housing: 42000, transport: 2200, medical: 2200, leisure: 4000, social: 20000 },
}

/**
 * 各维度城市等级系数（以一线为基准 1.0）
 * 住宅系数差异最大；爱(social)系数由教育/赡养/托举三项按L3比例加权推导
 */
export const CITY_DIM_MULTIPLIERS: Record<CityTier, Record<string, number>> = {
  tier1:    { clothing: 1.00, food: 1.00, housing: 1.00, transport: 1.00, medical: 1.00, leisure: 1.00, social: 1.00 },
  newTier1: { clothing: 0.85, food: 0.85, housing: 0.65, transport: 0.85, medical: 0.90, leisure: 0.80, social: 0.73 },
  tier23:   { clothing: 0.70, food: 0.70, housing: 0.45, transport: 0.70, medical: 0.75, leisure: 0.60, social: 0.53 },
  tier45:   { clothing: 0.55, food: 0.55, housing: 0.30, transport: 0.55, medical: 0.60, leisure: 0.45, social: 0.36 },
}

export const FAMILY_SIZE_MULTIPLIER: Record<FamilySize, number> = {
  single: 0.50, couple: 0.72, family3: 1.00, family4: 1.22,
}

/** 生成推荐预算明细（取整到百元） */
export function buildPresetBreakdown(
  levelKey: string,
  familySize: FamilySize,
  cityTier: CityTier,
): DecentBreakdownItem[] {
  const base   = BUDGET_PRESETS_FAMILY3_TIER1[levelKey] ?? BUDGET_PRESETS_FAMILY3_TIER1.decent
  const fMul   = FAMILY_SIZE_MULTIPLIER[familySize]
  const dimMul = CITY_DIM_MULTIPLIERS[cityTier]
  return DECENT_DIMENSIONS.map(dim => ({
    id: dim.key,
    builtinKey: dim.key as DecentDimensionKey,
    name: dim.label,
    icon: dim.icon,
    monthlyAmount: Math.round((base[dim.key] ?? 0) * fMul * dimMul[dim.key] / 100) * 100,
  }))
}
