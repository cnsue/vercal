import { useMemo, useState } from 'react'
import {
  DIVIDEND_STOCKS,
  DIVIDEND_STOCKS_UPDATED_AT,
  dividendYieldPct,
  researchUpsidePct,
  type DividendStockRef,
} from '../data/dividendStocks'

const CATEGORY_OPTIONS = ['全部', '银行', '能源', '基建', '消费', '通信'] as const
type CategoryFilter = typeof CATEGORY_OPTIONS[number]

export default function DividendStocksPage() {
  const [category, setCategory] = useState<CategoryFilter>('全部')

  const filteredStocks = useMemo(() => {
    return category === '全部'
      ? DIVIDEND_STOCKS
      : DIVIDEND_STOCKS.filter(stock => stock.category === category)
  }, [category])

  const averageYield = useMemo(() => {
    if (DIVIDEND_STOCKS.length === 0) return 0
    return DIVIDEND_STOCKS.reduce((sum, stock) => sum + dividendYieldPct(stock), 0) / DIVIDEND_STOCKS.length
  }, [])

  const researchedCount = DIVIDEND_STOCKS.filter(stock => stock.research).length

  return (
    <div style={{ paddingBottom: 20 }}>
      <section style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 16, marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
          数据更新 {DIVIDEND_STOCKS_UPDATED_AT}
        </div>
        <div style={{ fontSize: 22, fontWeight: 850, color: 'var(--text-strong)', marginBottom: 12 }}>
          高股息股票库
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <SummaryCell label="覆盖股票" value={`${DIVIDEND_STOCKS.length}`} />
          <SummaryCell label="平均股息率" value={formatPct(averageYield)} />
          <SummaryCell label="研报覆盖" value={`${researchedCount}`} />
        </div>
      </section>

      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', padding: '0 0 10px',
        scrollbarWidth: 'none',
      }}>
        {CATEGORY_OPTIONS.map(option => (
          <button
            key={option}
            onClick={() => setCategory(option)}
            style={{
              flex: '0 0 auto',
              border: '1px solid var(--border)',
              background: category === option ? 'var(--primary)' : 'var(--surface)',
              color: category === option ? '#fff' : 'var(--text)',
              borderRadius: 999,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {filteredStocks.map(stock => (
        <StockCard key={stock.code} stock={stock} />
      ))}
    </div>
  )
}

function StockCard({ stock }: { stock: DividendStockRef }) {
  const yieldPct = dividendYieldPct(stock)
  const upsidePct = researchUpsidePct(stock)

  return (
    <article style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 17, fontWeight: 850, color: 'var(--text-strong)' }}>{stock.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 800, color: 'var(--primary-text)',
              background: 'var(--primary-soft)', border: '1px solid var(--primary-border)',
              borderRadius: 999, padding: '2px 7px',
            }}>
              {stock.category}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {stock.code} · {stock.asOfYear} 分红口径 · 现价日期 {stock.priceAsOf}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 850, color: 'var(--primary-strong)' }}>
            {formatPct(yieldPct)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>参考股息率</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <MetricBox label="每股分红" value={`¥${stock.dividendPerShare.toFixed(3)}`} />
        <MetricBox label="参考价" value={`¥${stock.referencePrice.toFixed(2)}`} />
        <MetricBox
          label="目标空间"
          value={upsidePct === null ? '暂无' : signedPct(upsidePct)}
          tone={upsidePct === null ? 'muted' : 'default'}
          color={upsidePct === null ? undefined : pctTone(upsidePct)}
        />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
        background: 'var(--surface-muted)', borderRadius: 12, padding: 8, marginBottom: 10,
      }}>
        <GrowthPill label="悲观" value={stock.growth.pessimistic * 100} />
        <GrowthPill label="中性" value={stock.growth.neutral * 100} />
        <GrowthPill label="乐观" value={stock.growth.optimistic * 100} />
      </div>

      <ResearchBlock stock={stock} />

      {stock.disclosureNote && (
        <div style={{
          marginTop: 10, fontSize: 11, lineHeight: 1.55, color: 'var(--warning-text)',
          background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
          borderRadius: 10, padding: '8px 10px',
        }}>
          {stock.disclosureNote}
        </div>
      )}
    </article>
  )
}

function ResearchBlock({ stock }: { stock: DividendStockRef }) {
  const research = stock.research

  if (!research) {
    return (
      <div style={{
        border: '1px dashed var(--border-dashed)', borderRadius: 12,
        padding: 10, color: 'var(--muted)', fontSize: 12, textAlign: 'center',
      }}>
        近 3-6 个月研报预期暂无可靠公开数据
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-strong)' }}>
          {research.reportWindow} · {research.metric}预测
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          目标价 {research.targetPriceAvg === undefined ? '暂无' : `¥${research.targetPriceAvg.toFixed(2)}`}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {research.forecasts.map(forecast => (
          <div key={forecast.year} style={{
            border: '1px solid var(--border)', borderRadius: 10,
            padding: '8px 6px', textAlign: 'center', background: 'var(--surface-subtle)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{forecast.year}</div>
            <div style={{
              fontSize: 14, fontWeight: 850,
              color: forecast.growthPct === null ? 'var(--muted)' : pctTone(forecast.growthPct),
            }}>
              {forecast.growthPct === null ? '暂无' : signedPct(forecast.growthPct)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginTop: 8 }}>
        {research.sourceNote}
      </div>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 850, color: 'var(--text-strong)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function MetricBox({ label, value, tone = 'default', color }: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'muted'
  color?: string
}) {
  const valueColor = color ?? (tone === 'positive'
    ? 'var(--primary-strong)'
    : tone === 'negative'
      ? 'var(--danger)'
      : tone === 'muted'
        ? 'var(--muted)'
        : 'var(--text-strong)')

  return (
    <div style={{ background: 'var(--surface-muted)', borderRadius: 12, padding: '9px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 850, color: valueColor }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function GrowthPill({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 850, color: pctTone(value) }}>{signedPct(value)}</div>
    </div>
  )
}

function pctTone(value: number): string {
  if (value > 0.05) return 'var(--primary-strong)'
  if (value < -0.05) return 'var(--danger)'
  return 'var(--text-strong)'
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`
}

function signedPct(value: number): string {
  if (Math.abs(value) < 0.05) return '0.0%'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}
