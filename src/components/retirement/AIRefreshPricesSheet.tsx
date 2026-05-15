import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { findDividendStock, type DividendAssetRef } from '../../data/dividendStocks'
import type { DividendPriceRefreshItem } from '../../types/ai'
import { formatCNY } from '../../utils/formatters'

interface Props {
  items: DividendPriceRefreshItem[]
  missing: string[]
  customAssets: DividendAssetRef[]
  providerLabel: string
  modelLabel: string
  /** 已自动应用的 code 集合（high 置信度） */
  autoAppliedCodes: Set<string>
  onApplySelected: (items: DividendPriceRefreshItem[]) => void
  onClose: () => void
}

export default function AIRefreshPricesSheet({
  items, missing, customAssets, providerLabel, modelLabel,
  autoAppliedCodes, onApplySelected, onClose,
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const autoItems = useMemo(() => items.filter(i => autoAppliedCodes.has(i.code)), [items, autoAppliedCodes])
  const pendingItems = useMemo(() => items.filter(i => !autoAppliedCodes.has(i.code)), [items, autoAppliedCodes])

  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  function toggle(code: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function applySelected() {
    const chosen = pendingItems.filter(i => selected.has(i.code))
    if (chosen.length === 0) return
    onApplySelected(chosen)
    setSelected(new Set())
  }

  function selectAllPending() {
    setSelected(new Set(pendingItems.map(i => i.code)))
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={sheetStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>AI 刷新参考价</div>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 12 }}>
          {providerLabel} · {modelLabel}（已启用联网搜索）。高置信度数据已自动覆盖到本地；中/低置信度需要你审核后应用。
        </div>

        {autoItems.length > 0 && (
          <Section title={`已自动应用（${autoItems.length}）`} tone="success">
            {autoItems.map(item => (
              <RefreshRow
                key={item.code}
                item={item}
                customAssets={customAssets}
                mode="applied"
              />
            ))}
          </Section>
        )}

        {pendingItems.length > 0 && (
          <Section
            title={`需要确认（${pendingItems.length}）`}
            tone="warning"
            actions={
              <button onClick={selectAllPending} style={linkBtnStyle}>全选</button>
            }
          >
            {pendingItems.map(item => (
              <RefreshRow
                key={item.code}
                item={item}
                customAssets={customAssets}
                mode="pending"
                checked={selected.has(item.code)}
                onToggle={() => toggle(item.code)}
              />
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}>
                关闭
              </button>
              <button
                onClick={applySelected}
                disabled={selected.size === 0}
                style={{
                  ...btn, flex: 2,
                  background: selected.size === 0 ? 'var(--surface-muted)' : 'var(--primary)',
                  color: selected.size === 0 ? 'var(--muted)' : '#fff',
                  cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                应用选中（{selected.size}）
              </button>
            </div>
          </Section>
        )}

        {missing.length > 0 && (
          <Section title={`未返回价格（${missing.length}）`} tone="muted">
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 6 }}>
              下列标的 AI 未能给出可靠最新价（可能停牌、休市或检索失败）：
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {missing.map(code => {
                const ref = findDividendStock(code, customAssets)
                return (
                  <span key={code} style={chipStyle}>
                    {ref?.name ?? code} <span style={{ color: 'var(--muted)' }}>{code}</span>
                  </span>
                )
              })}
            </div>
          </Section>
        )}

        {autoItems.length === 0 && pendingItems.length === 0 && missing.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>
            没有持仓需要刷新。
          </div>
        )}

        {autoItems.length === 0 && pendingItems.length > 0 && (
          // 没有 auto applied 时单独给个关闭按钮
          <></>
        )}

        {autoItems.length > 0 && pendingItems.length === 0 && (
          <div style={{ display: 'flex', marginTop: 12 }}>
            <button onClick={onClose} style={{ ...btn, flex: 1, background: 'var(--primary)', color: '#fff' }}>
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({
  title, tone, actions, children,
}: {
  title: string
  tone: 'success' | 'warning' | 'muted'
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const accent = tone === 'success' ? 'var(--primary-strong)'
    : tone === 'warning' ? 'var(--warning-text)' : 'var(--muted)'
  return (
    <section style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: accent }}>{title}</div>
        {actions}
      </div>
      {children}
    </section>
  )
}

function RefreshRow({
  item, customAssets, mode, checked, onToggle,
}: {
  item: DividendPriceRefreshItem
  customAssets: DividendAssetRef[]
  mode: 'applied' | 'pending'
  checked?: boolean
  onToggle?: () => void
}) {
  const ref = findDividendStock(item.code, customAssets)
  const prevPrice = ref?.referencePrice ?? 0
  const delta = prevPrice > 0 ? item.referencePrice - prevPrice : 0
  const deltaPct = prevPrice > 0 ? (delta / prevPrice) * 100 : 0
  const showDelta = prevPrice > 0
  const deltaColor = delta > 0 ? 'var(--primary-strong)' : delta < 0 ? 'var(--danger)' : 'var(--muted)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 10, marginBottom: 6,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
    }}>
      {mode === 'pending' && (
        <input type="checkbox" checked={!!checked} onChange={onToggle} style={{ width: 16, height: 16, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>
            {item.name ?? ref?.name ?? item.code}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{item.code}</span>
          <ConfidenceBadge confidence={item.confidence} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          <span>
            ¥{prevPrice.toFixed(2)} → <strong style={{ color: 'var(--text-strong)' }}>¥{item.referencePrice.toFixed(2)}</strong>
          </span>
          {showDelta && (
            <span style={{ marginLeft: 6, color: deltaColor, fontWeight: 700 }}>
              {delta > 0 ? '+' : ''}{formatCNY(delta)}（{deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(2)}%）
            </span>
          )}
          <span style={{ marginLeft: 6 }}>· {item.priceAsOf}</span>
        </div>
        {item.sourceNote && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
            {item.sourceNote}
          </div>
        )}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: 'var(--primary-strong)', textDecoration: 'underline' }}
          >
            查看来源 ↗
          </a>
        )}
      </div>
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: DividendPriceRefreshItem['confidence'] }) {
  const map = {
    high: { label: '高', bg: 'var(--primary-soft)', color: 'var(--primary-strong)' },
    medium: { label: '中', bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
    low: { label: '低', bg: 'var(--danger-bg)', color: 'var(--danger)' },
  } as const
  const cfg = map[confidence]
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 999,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end',
}

const sheetStyle: CSSProperties = {
  width: '100%', maxHeight: '90dvh', overflowY: 'auto',
  background: 'var(--surface)', borderRadius: '20px 20px 0 0',
  padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
  boxSizing: 'border-box',
}

const closeBtnStyle: CSSProperties = {
  background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)',
  cursor: 'pointer', lineHeight: 1, padding: '0 2px',
}

const linkBtnStyle: CSSProperties = {
  background: 'none', border: 'none', color: 'var(--primary-strong)',
  fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
}

const btn: CSSProperties = {
  padding: '11px 10px', borderRadius: 10, border: 'none',
  fontSize: 14, fontWeight: 800, cursor: 'pointer',
}

const chipStyle: CSSProperties = {
  fontSize: 11, padding: '4px 9px', borderRadius: 999,
  background: 'var(--surface-muted)', color: 'var(--text)',
}
