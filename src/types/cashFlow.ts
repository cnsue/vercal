import type { AssetPlatform } from './models'

export type CashFlowType = 'income' | 'expense'

/** 支出方式：资产直付 vs 信用卡（信用卡消费不影响当下资产，到期还款时另记一笔 asset 类型） */
export type PaymentMethod = 'asset' | 'credit'

export interface CashFlowEvent {
  id: string
  date: string                 // 'YYYY-MM-DD'
  type: CashFlowType
  amount: number               // 元，恒正；正负由 type 决定
  category: string             // 见 BUILTIN_*_CATEGORIES，也可自定义
  paymentMethod: PaymentMethod // 仅在 type='expense' 时有意义；income 永远 'asset'
  platform?: AssetPlatform
  customPlatformName?: string
  note: string
}

export interface CategoryMeta {
  key: string
  label: string
  icon: string
}

export const BUILTIN_INCOME_CATEGORIES: readonly CategoryMeta[] = [
  { key: 'salary',      label: '工资',      icon: '💰' },
  { key: 'bonus',       label: '奖金',      icon: '🎉' },
  { key: 'redPocket',   label: '红包礼金',  icon: '🧧' },
  { key: 'reimburse',   label: '报销',      icon: '📥' },
  { key: 'interestRent',label: '利息租金',  icon: '💸' },
  { key: 'otherIncome', label: '其他收入',  icon: '✨' },
]

export const BUILTIN_EXPENSE_CATEGORIES: readonly CategoryMeta[] = [
  { key: 'daily',       label: '日常',       icon: '🍱' },
  { key: 'housing',     label: '房贷/房租',  icon: '🏠' },
  { key: 'bigPurchase', label: '大额消费',   icon: '🛍️' },
  { key: 'creditRepay', label: '信用卡还款', icon: '💳' },
  { key: 'transferGift',label: '转账赠予',   icon: '💝' },
  { key: 'otherExpense',label: '其他支出',   icon: '⚠️' },
]

/** 信用卡还款分类的 key —— 在「分类聚合 / 真实盈亏」里需要特殊处理 */
export const CREDIT_REPAY_KEY = 'creditRepay'

export function findCategoryMeta(type: CashFlowType, key: string): CategoryMeta | null {
  const list = type === 'income' ? BUILTIN_INCOME_CATEGORIES : BUILTIN_EXPENSE_CATEGORIES
  return list.find(c => c.key === key) ?? null
}
