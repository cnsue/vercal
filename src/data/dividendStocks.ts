/**
 * 内置常见高股息 A 股默认表。
 *
 * 口径：dividendPerShare 为「完整会计年度每股现金分红（税前，元）」。
 *   - 银行股：2025 年中期派息 + 2025 年年度派息（年度方案已董事会通过，尚待股东会审议）
 *   - 其它：2025 年度分红预案（若已披露），否则使用 2024 全年或 2025 部分数据，
 *     并在 disclosureNote 注明。
 *
 * referencePrice 为最近可核验收盘价或盘中价，仅用于展示股息率参考，
 * 用户可手动覆盖每股股息。数据请定期（建议每年 4-7 月年报季后）手动更新一次。
 *
 * 数据更新日期：2026-05-08
 */
export const DIVIDEND_STOCKS_UPDATED_AT = '2026-05-08'

export interface DividendResearchForecast {
  year: 2026 | 2027 | 2028
  /** 归母净利润同比增速（%）；缺少可靠预测时为 null */
  growthPct: number | null
}

export interface DividendStockResearch {
  metric: '归母净利润'
  reportWindow: '近3-6个月'
  /** 研报或一致预期目标价均值（元）；缺失时不展示上涨空间 */
  targetPriceAvg?: number
  /** 目标价口径日期 */
  targetPriceAsOf?: string
  /** 相对 referencePrice 的目标价空间（%），按录入时价格静态计算 */
  upsidePct?: number
  forecasts: DividendResearchForecast[]
  sourceNote: string
}

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
  /** 近 3-6 个月研报或一致预期摘要 */
  research?: DividendStockResearch
  /**
   * 每年现金分红的三档增长率估计（实际 = 去除通胀的"实际增长"口径）。
   * 基于该股近 5-10 年历史分红 CAGR 与行业周期性粗估，用于退休后覆盖率的前瞻推算。
   */
  growth: { pessimistic: number; neutral: number; optimistic: number }
}

function research(
  targetPriceAvg: number,
  targetPriceAsOf: string,
  forecasts: [number | null, number | null, number | null],
  sourceNote: string,
): DividendStockResearch {
  return {
    metric: '归母净利润',
    reportWindow: '近3-6个月',
    targetPriceAvg,
    targetPriceAsOf,
    forecasts: [
      { year: 2026, growthPct: forecasts[0] },
      { year: 2027, growthPct: forecasts[1] },
      { year: 2028, growthPct: forecasts[2] },
    ],
    sourceNote,
  }
}

const DIVIDEND_STOCK_RESEARCH_BY_CODE: Record<string, DividendStockResearch> = {
  '601398': research(8.84, '2026-04-10', [2.2, 3.6, null], '同花顺 6 个月内机构盈利预测与富途/Investing 目标价；公开均值暂未提供 2028 归母净利预测'),
  '601939': research(10.57, '2026-03-20', [3.5, 3.5, 4.5], '同花顺 2026-2028 机构预测表与 Investing 目标价均值'),
  '601288': research(7.79, '2026-04-17', [3.8, 4.2, 5.9], '同花顺 2026-2028 机构预测均值与富途目标价均值'),
  '601988': research(6.34, '2026-04-29', [5.8, 4.8, 5.0], '同花顺 2026-2028 机构预测表与 Investing 目标价均值'),
  '601328': research(8.07, '2026-05-05', [2.7, 3.1, 4.2], '同花顺 2026-2028 机构预测均值与 Investing 目标价均值'),
  '600036': research(52.20, '2026-04-16', [2.9, 4.5, 5.7], '同花顺 2026-2028 机构预测均值与 Investing 目标价均值'),
  '601166': research(24.84, '2026-03-28', [2.8, 4.0, 4.3], '同花顺与华泰证券 2026-2028 盈利预测摘录；目标价采用华泰证券 A 股目标价'),
  '600900': research(33.86, '2026-04-17', [4.2, 4.0, null], '同花顺 6 个月内机构预测与富途目标价均值；公开均值暂未提供 2028 归母净利预测'),
  '601006': research(6.92, '2026-03-23', [5.0, 3.8, null], '华泰证券 2026-2027 归母净利预测与目标价；公开研报暂未提供 2028 归母净利预测'),
  '601088': research(49.70, '2026-04-15', [10.8, 3.6, 3.2], '同花顺 2026-2028 机构预测表与富途目标价均值'),
  '600028': research(6.51, '2026-03-23', [49.1, 15.0, 16.4], '同花顺/Simply Wall St 2026-2028 盈利预测与 Fintel 目标价均值'),
  '601857': research(15.02, '2026-04-07', [13.8, 0.7, 5.1], '同花顺 2026-2028 机构预测表；目标价采用华泰证券与中银国际研究目标价均值'),
  '601919': research(17.36, '2026-04-17', [-17.9, -11.3, 3.3], '同花顺/富途/Investing 公开一致预期与研报摘录；航运盈利对运价和红海绕行假设敏感'),
  '600188': research(20.67, '2026-04-18', [81.9, 6.5, 18.9], '同花顺 2026-2028 机构预测均值与 Fintel 目标价均值'),
  '600377': research(13.48, '2026-05-01', [8.2, 4.2, 2.2], '同花顺 2026-2028 机构预测均值与 Investing 目标价均值'),
  '000651': research(46.27, '2026-04-30', [5.8, 11.0, 10.7], '山西证券 2026-2028 归母净利预测与 Investing 目标价均值'),
  '000333': research(92.72, '2026-04-16', [7.5, 8.5, 8.3], '同花顺 2026-2028 机构预测表与 Investing 目标价均值'),
  '000858': research(111.55, '2026-05-06', [57.0, 7.2, 7.6], '中邮证券 2026-2028 归母净利润预测；目标价采用 Investing 公开一致预期均值'),
  '600941': research(116.93, '2026-04-16', [4.6, 3.5, -4.7], '同花顺 2026-2028 机构预测均值与 Fintel 目标价均值；2028 均值受样本机构数下降影响较大'),
  '601728': research(7.81, '2026-04-28', [-6.8, 3.8, 3.8], '同花顺研报预测表与 Investing/Fintel 公开目标价均值；预测已反映增值税税目调整后利润承压'),
}

const BASE_DIVIDEND_STOCKS: DividendStockRef[] = [
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
  { code: '601838', name: '成都银行',   dividendPerShare: 0.921,  asOfYear: '2025*', referencePrice: 18.16, priceAsOf: '2026-04',    category: '银行',
    disclosureNote: '2025 年度分红方案已董事会通过，拟每 10 股派 9.21 元，尚待股东会审议',
    growth: { pessimistic: 0.00, neutral: 0.04, optimistic: 0.07 } },
  { code: '002142', name: '宁波银行',   dividendPerShare: 1.200,  asOfYear: '2025*', referencePrice: 31.42, priceAsOf: '2026-03-09', category: '银行',
    disclosureNote: '2025 年全年 = 2025 中期 0.30 + 2025 末期 0.90；末期方案已董事会通过，尚待股东会审议',
    growth: { pessimistic: 0.02, neutral: 0.06, optimistic: 0.09 } },
  { code: '600919', name: '江苏银行',   dividendPerShare: 0.5641, asOfYear: '2025*', referencePrice: 11.21, priceAsOf: '2026-05-07', category: '银行',
    disclosureNote: '2025 年全年 = 2025 中期 0.3309 + 2025 末期 0.2332；末期方案已董事会通过，尚待股东会审议',
    growth: { pessimistic: 0.02, neutral: 0.05, optimistic: 0.08 } },

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
  { code: '601919', name: '中远海控',   dividendPerShare: 1.000,  asOfYear: '2025*', referencePrice: 14.10, priceAsOf: '2026-05-06', category: '基建',
    disclosureNote: '2025 年全年 = 2025 中期 0.56 + 2025 末期 0.44；末期方案已董事会通过，尚待股东会审议',
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
  { code: '000858', name: '五粮液',     dividendPerShare: 5.156,  asOfYear: '2025*', referencePrice: 92.26, priceAsOf: '2026-05-06', category: '消费',
    disclosureNote: '2025 年全年 = 2025 中期 2.578 + 2025 末期 2.578；末期方案已董事会通过，尚待股东会审议',
    growth: { pessimistic: -0.02, neutral: 0.04, optimistic: 0.08 } },

  // 通信
  { code: '600941', name: '中国移动',   dividendPerShare: 4.790,  asOfYear: '2025*', referencePrice: 96.66, priceAsOf: '2026-04-21', category: '通信',
    disclosureNote: '2025 末期 A 股人民币派发金额待后续公告，当前值按 HKD→CNY≈0.91 临时折算',
    growth: { pessimistic: 0.02, neutral: 0.05, optimistic: 0.08 } },
  { code: '601728', name: '中国电信',   dividendPerShare: 0.272,  asOfYear: '2025*', referencePrice: 5.95,  priceAsOf: '2026-05-06', category: '通信',
    disclosureNote: '2025 年全年 = 2025 中期 0.1812 + 2025 末期 0.0908；末期方案已董事会通过，尚待股东会审议',
    growth: { pessimistic: 0.00, neutral: 0.03, optimistic: 0.05 } },
]

export const DIVIDEND_STOCKS: DividendStockRef[] = BASE_DIVIDEND_STOCKS.map(stock => {
  const researchRef = DIVIDEND_STOCK_RESEARCH_BY_CODE[stock.code] ?? stock.research
  const researchWithUpside = researchRef && researchRef.targetPriceAvg !== undefined && stock.referencePrice > 0
    ? {
        ...researchRef,
        upsidePct: ((researchRef.targetPriceAvg - stock.referencePrice) / stock.referencePrice) * 100,
      }
    : researchRef

  return {
    ...stock,
    research: researchWithUpside,
  }
})

/** 计算某只股票按参考价的年股息率（%） */
export function dividendYieldPct(ref: DividendStockRef): number {
  return ref.referencePrice > 0 ? (ref.dividendPerShare / ref.referencePrice) * 100 : 0
}

export function researchUpsidePct(ref: DividendStockRef): number | null {
  if (ref.research?.upsidePct !== undefined) return ref.research.upsidePct
  const target = ref.research?.targetPriceAvg
  return target !== undefined && ref.referencePrice > 0
    ? ((target - ref.referencePrice) / ref.referencePrice) * 100
    : null
}

export function findDividendStock(code: string): DividendStockRef | undefined {
  return DIVIDEND_STOCKS.find(s => s.code === code)
}
