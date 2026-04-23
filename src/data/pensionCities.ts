/**
 * 内置 10 个主要城市/地区的养老保险待遇计发基数或全口径加权平均工资（元/月）。
 * 用于企业职工基本养老金 MVP 简化公式的基础养老金计算。
 * 数据为近似 2024 年公布数据（2025 年退休/缴费基数使用），精确以各地人社局公告为准。
 */
export interface PensionCity {
  key: string
  name: string
  /** 上年度全口径城镇单位就业人员月平均工资或待遇计发基数（元/月） */
  averageWage: number
}

export const PENSION_CITIES: PensionCity[] = [
  { key: 'beijing',   name: '北京', averageWage: 11525 },
  { key: 'shanghai',  name: '上海', averageWage: 12183 },
  { key: 'shenzhen',  name: '深圳', averageWage: 12964 },
  { key: 'guangzhou', name: '广州', averageWage: 11484 },
  { key: 'hangzhou',  name: '杭州', averageWage: 8433  },
  { key: 'nanjing',   name: '南京', averageWage: 9901  },
  { key: 'chengdu',   name: '成都', averageWage: 8823  },
  { key: 'wuhan',     name: '武汉', averageWage: 8579  },
  { key: 'xian',      name: '西安', averageWage: 7880  },
  { key: 'chongqing', name: '重庆', averageWage: 7909  },
]

/**
 * 社平工资年均增长率假设。
 * 人社部"退休待遇测算器"默认为 0%（结果按今日购买力表示），这里与之一致。
 * 如需按名义金额估算，可上调（历史实际约 5% 名义 / 2% 实际增长）。
 */
export const SOCIAL_WAGE_GROWTH_RATE = 0

/**
 * 个人账户记账利率（年）。
 * 人社部默认 2.62%（近 5 年公布值 2.62%-4.17%）。
 */
export const PERSONAL_ACCOUNT_RATE = 0.0262

/** 个人账户计发月数（按退休年龄），依据 2005 年 38 号文 */
export const PERSONAL_ACCOUNT_MONTHS: Record<number, number> = {
  40: 233, 41: 230, 42: 226, 43: 223, 44: 220,
  45: 216, 46: 212, 47: 208, 48: 204, 49: 199,
  50: 195, 51: 190, 52: 185, 53: 180, 54: 175,
  55: 170, 56: 164, 57: 158, 58: 152, 59: 145,
  60: 139, 61: 132, 62: 125, 63: 117, 64: 109,
  65: 101, 66: 93,  67: 84,  68: 75,  69: 65,  70: 56,
}

export function findPensionCity(key: string): PensionCity | undefined {
  return PENSION_CITIES.find(c => c.key === key)
}

export function getPersonalAccountMonths(retirementAge: number, extraMonths = 0): number {
  const age = Math.max(40, Math.min(70, retirementAge))
  const base = PERSONAL_ACCOUNT_MONTHS[age] ?? 139
  const months = Math.max(0, Math.min(11, extraMonths))
  if (months === 0) return base
  const next = PERSONAL_ACCOUNT_MONTHS[Math.min(age + 1, 70)] ?? base
  return Math.round((base - ((base - next) / 12) * months) * 10) / 10
}
