/**
 * 内置常见高股息 A 股默认表。
 *
 * 口径：dividendPerShare 为「完整会计年度每股现金分红（税前，元）」。
 *   - 银行股：2025 年中期派息 + 2025 年年度派息（年度方案已董事会通过，尚待股东会审议）
 *   - 其它：2025 年度分红预案（若已披露），否则使用 2024 全年或 2025 部分数据，
 *     并在 disclosureNote 注明。
 *
 * referencePrice 为 2026 年 4 月中下旬收盘价近似值，仅用于展示股息率参考，
 * 用户可手动覆盖每股股息。数据请定期（建议每年 4-7 月年报季后）手动更新一次。
 *
 * 数据更新日期：2026-04-23
 */
export interface DividendStockRef {
  code: string
  name: string
  /** 完整年度每股现金分红（税前，元）— 银行股含中期+年度 */
  dividendPerShare: number
  /** 数据覆盖的会计年度；带「*」表示尚有部分未披露，已在 disclosureNote 说明 */
  asOfYear: string
  /** 参考价（元） */
  referencePrice: number
  /** 参考价取价日期 */
  priceAsOf: string
  category: '银行' | '能源' | '基建' | '消费' | '通信'
  /** 披露状态备注（仅在非完整披露时填写） */
  disclosureNote?: string
  /**
   * 每年现金分红的三档增长率估计（实际 = 去除通胀的"实际增长"口径）。
   * 基于该股近 5-10 年历史分红 CAGR 与行业周期性粗估，用于退休后覆盖率的前瞻推算。
   */
  growth: { pessimistic: number; neutral: number; optimistic: number }
}

export const DIVIDEND_STOCKS: DividendStockRef[] = [
  // 银行股：2025 年中期 + 年度 合计（年度方案已公告，待股东会审议）
  { code: '601398', name: '工商银行',   dividendPerShare: 0.3103, asOfYear: '2025', referencePrice: 7.52,  priceAsOf: '2026-04-22', category: '银行',
    growth: { pessimistic: 0.00, neutral: 0.03, optimistic: 0.05 } },
  { code: '601939', name: '建设银行',   dividendPerShare: 0.3887, asOfYear: '2025', referencePrice: 9.85,  priceAsOf: '2026-04-21', category: '银行',
    growth: { pessimistic: 0.01, neutral: 0.04, optimistic: 0.06 } },
  { code: '601288', name: '农业银行',   dividendPerShare: 0.2495, asOfYear: '2025', referencePrice: 7.19,  priceAsOf: '2026-04-20', category: '银行',
    growth: { pessimistic: 0.02, neutral: 0.05, optimistic: 0.08 } },
  { code: '601988', name: '中国银行',   dividendPerShare: 0.2263, asOfYear: '2025', referencePrice: 5.93,  priceAsOf: '2026-04-21', category: '银行',
    growth: { pessimistic: 0.01, neutral: 0.04, optimistic: 0.06 } },
  { code: '601328', name: '交通银行',   dividendPerShare: 0.3247, asOfYear: '2025', referencePrice: 7.16,  priceAsOf: '2026-04',    category: '银行',
    growth: { pessimistic: 0.00, neutral: 0.03, optimistic: 0.05 } },
  { code: '600036', name: '招商银行',   dividendPerShare: 2.016,  asOfYear: '2025', referencePrice: 39.90, priceAsOf: '2026-04-15', category: '银行',
    growth: { pessimistic: 0.03, neutral: 0.08, optimistic: 0.13 } },
  { code: '601166', name: '兴业银行',   dividendPerShare: 1.066,  asOfYear: '2025', referencePrice: 18.22, priceAsOf: '2026-04-22', category: '银行',
    growth: { pessimistic: 0.02, neutral: 0.06, optimistic: 0.10 } },

  // 能源 / 公用
  { code: '600900', name: '长江电力',   dividendPerShare: 0.943,  asOfYear: '2025*', referencePrice: 27.13, priceAsOf: '2026-04-21', category: '能源',
    disclosureNote: '2025 年度末期分红方案尚在征求意见阶段，当前值 = 2025 中期 0.21 + 2024 末期 0.733 估算',
    growth: { pessimistic: 0.03, neutral: 0.07, optimistic: 0.10 } },
  { code: '601006', name: '大秦铁路',   dividendPerShare: 0.269,  asOfYear: '2024', referencePrice: 5.33,  priceAsOf: '2026-04-02', category: '基建',
    disclosureNote: '2025 年报截至 2026-04 未披露末期方案，暂用 2024 年全年合计（中期 0.129 + 末期 0.140）',
    growth: { pessimistic: -0.03, neutral: 0.00, optimistic: 0.03 } },
  { code: '601088', name: '中国神华',   dividendPerShare: 2.010,  asOfYear: '2025', referencePrice: 45.23, priceAsOf: '2026-04-20', category: '能源',
    growth: { pessimistic: -0.05, neutral: 0.03, optimistic: 0.10 } },
  { code: '600028', name: '中国石化',   dividendPerShare: 0.200,  asOfYear: '2025', referencePrice: 5.44,  priceAsOf: '2026-04-22', category: '能源',
    growth: { pessimistic: -0.03, neutral: 0.02, optimistic: 0.05 } },
  { code: '601857', name: '中国石油',   dividendPerShare: 0.470,  asOfYear: '2025', referencePrice: 11.45, priceAsOf: '2026-04-22', category: '能源',
    growth: { pessimistic: -0.02, neutral: 0.03, optimistic: 0.08 } },
  { code: '601919', name: '中远海控',   dividendPerShare: 1.000,  asOfYear: '2025', referencePrice: 14.46, priceAsOf: '2026-04-22', category: '基建',
    growth: { pessimistic: -0.20, neutral: 0.00, optimistic: 0.15 } },
  { code: '600188', name: '兖矿能源',   dividendPerShare: 0.500,  asOfYear: '2025', referencePrice: 19.52, priceAsOf: '2026-04-21', category: '能源',
    growth: { pessimistic: -0.15, neutral: 0.00, optimistic: 0.10 } },
  { code: '600377', name: '宁沪高速',   dividendPerShare: 0.490,  asOfYear: '2025', referencePrice: 12.04, priceAsOf: '2026-04-21', category: '基建',
    growth: { pessimistic: 0.00, neutral: 0.03, optimistic: 0.05 } },

  // 消费
  { code: '000651', name: '格力电器',   dividendPerShare: 3.000,  asOfYear: '2024', referencePrice: 36.91, priceAsOf: '2026-04-21', category: '消费',
    disclosureNote: '2025 年度末期方案尚未披露，暂用 2024 年全年合计（中期 1.00 + 末期 2.00）',
    growth: { pessimistic: 0.00, neutral: 0.05, optimistic: 0.10 } },
  { code: '000333', name: '美的集团',   dividendPerShare: 4.300,  asOfYear: '2025', referencePrice: 79.50, priceAsOf: '2026-04-22', category: '消费',
    growth: { pessimistic: 0.03, neutral: 0.08, optimistic: 0.12 } },

  // 通信
  { code: '600941', name: '中国移动',   dividendPerShare: 4.790,  asOfYear: '2025*', referencePrice: 96.66, priceAsOf: '2026-04-21', category: '通信',
    disclosureNote: '2025 末期 A 股人民币派发金额待后续公告，当前值按 HKD→CNY≈0.91 临时折算',
    growth: { pessimistic: 0.02, neutral: 0.05, optimistic: 0.08 } },
]

/** 计算某只股票按参考价的年股息率（%） */
export function dividendYieldPct(ref: DividendStockRef): number {
  return ref.referencePrice > 0 ? (ref.dividendPerShare / ref.referencePrice) * 100 : 0
}

export function findDividendStock(code: string): DividendStockRef | undefined {
  return DIVIDEND_STOCKS.find(s => s.code === code)
}
