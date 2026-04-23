import { useState } from 'react'
import type { Snapshot, SnapshotItem, AssetPlatform, AssetClass } from '../types/models'
import { PLATFORM_LABELS, CLASS_LABELS, PLATFORM_DEFAULT_CURRENCY, effectivePlatformLabel, effectiveClassLabel } from '../types/models'
import { useAssetStore } from '../store/useAssetStore'
import { formatCNY } from '../utils/formatters'
import { v4 as uuidv4 } from '../utils/uuid'

interface Props {
  snapshot: Snapshot
  onSave: (s: Snapshot) => void
  onDelete?: () => void
  onCancel: () => void
}

export default function SnapshotEditor({ snapshot: initial, onSave, onDelete, onCancel }: Props) {
  const [snap, setSnap] = useState<Snapshot>(structuredClone(initial))
  const [activeId, setActiveId] = useState<string | null>(null)
  const { computeItemValueCNY, exchangeRate, customPlatforms, customClasses, hiddenPlatforms, hiddenClasses } = useAssetStore()

  function updateItem(id: string, patch: Partial<SnapshotItem>) {
    setSnap(s => ({
      ...s,
      items: s.items.map(item => item.id === id ? { ...item, ...patch } : item),
    }))
  }

  function addItem() {
    const newItem: SnapshotItem = {
      id: uuidv4(), platform: 'other', customPlatformName: '',
      accountType: '', assetClass: 'other', customAssetClassName: '',
      assetLabel: '', amount: 0, currency: 'CNY', valueCNY: 0, note: '',
    }
    setSnap(s => ({ ...s, items: [...s.items, newItem] }))
    setActiveId(newItem.id)
  }

  /** 一键按平台全部展开：为当前未覆盖的可见内置平台和自定义平台各生成一条空 item */
  function expandByPlatforms() {
    const existing = new Set(snap.items.map(i =>
      i.platform === 'other' && i.customPlatformName
        ? `__custom__${i.customPlatformName}`
        : i.platform
    ))
    const additions: SnapshotItem[] = []
    for (const p of Object.keys(PLATFORM_LABELS) as AssetPlatform[]) {
      if (p === 'other') continue
      if (hiddenPlatforms.includes(p)) continue
      if (existing.has(p)) continue
      additions.push({
        id: uuidv4(), platform: p, customPlatformName: '',
        accountType: '', assetClass: 'other', customAssetClassName: '',
        assetLabel: '', amount: 0, currency: PLATFORM_DEFAULT_CURRENCY[p], valueCNY: 0, note: '',
      })
    }
    for (const name of customPlatforms) {
      if (existing.has(`__custom__${name}`)) continue
      additions.push({
        id: uuidv4(), platform: 'other', customPlatformName: name,
        accountType: '', assetClass: 'other', customAssetClassName: '',
        assetLabel: '', amount: 0, currency: 'CNY', valueCNY: 0, note: '',
      })
    }
    if (additions.length === 0) return
    setSnap(s => ({ ...s, items: [...s.items, ...additions] }))
  }

  const expandableCount = (() => {
    const existing = new Set(snap.items.map(i =>
      i.platform === 'other' && i.customPlatformName
        ? `__custom__${i.customPlatformName}`
        : i.platform
    ))
    let n = 0
    for (const p of Object.keys(PLATFORM_LABELS) as AssetPlatform[]) {
      if (p !== 'other' && !hiddenPlatforms.includes(p) && !existing.has(p)) n++
    }
    for (const name of customPlatforms) {
      if (!existing.has(`__custom__${name}`)) n++
    }
    return n
  })()

  function removeItem(id: string) {
    setSnap(s => ({ ...s, items: s.items.filter(i => i.id !== id) }))
    setActiveId(null)
  }

  const totalCNY = snap.items.reduce((sum, item) => {
    const repriced = { ...item, valueCNY: computeItemValueCNY(item) }
    return sum + repriced.valueCNY
  }, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0' }}>
        <button onClick={onCancel} style={btnStyle('ghost')}>取消</button>
        <div style={{ fontSize: 15, fontWeight: 700 }}>资产录入</div>
        {onDelete ? (
          <button onClick={onDelete} style={{ ...btnStyle('ghost'), color: 'var(--danger)' }}>删除</button>
        ) : <div style={{ width: 40 }} />}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Date */}
        <div style={sectionStyle}>
          <label style={labelStyle}>快照日期</label>
          <input type="date" value={snap.dateKey} onChange={e => setSnap(s => ({ ...s, dateKey: e.target.value, snapshotDate: new Date(e.target.value).toISOString() }))}
            style={inputStyle} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
            <span>USD/CNY</span>
            <span>{exchangeRate ? exchangeRate.rate.toFixed(4) : '未获取'}</span>
          </div>
          <textarea placeholder="备注（转入、转出或估值口径）" value={snap.note}
            onChange={e => setSnap(s => ({ ...s, note: e.target.value }))}
            rows={2} style={{ ...inputStyle, resize: 'none' }} />
        </div>

        {/* Items */}
        <div style={{ ...sectionStyle, marginTop: 12 }}>
          <div style={labelStyle}>资产条目</div>
          {snap.items.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>点下方按钮添加资产条目</div>
          )}
          {snap.items.map(item => (
            <div key={item.id}>
              <button onClick={() => setActiveId(activeId === item.id ? null : item.id)}
                style={{ width: '100%', textAlign: 'left', background: activeId === item.id ? 'var(--surface-active)' : 'var(--surface-muted)', border: `1px solid ${activeId === item.id ? 'var(--primary-strong)' : 'transparent'}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', marginBottom: 4, color: 'var(--text)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{effectivePlatformLabel(item)}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {effectiveClassLabel(item)} · {item.amount > 0 ? `${item.amount} ${item.currency}` : '待录入'}
                </div>
              </button>
              {activeId === item.id && (
                <ItemEditor item={item} onChange={patch => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)} valueCNY={computeItemValueCNY({ ...item, valueCNY: 0 })}
                  customPlatforms={customPlatforms} customClasses={customClasses}
                  hiddenPlatforms={hiddenPlatforms} hiddenClasses={hiddenClasses} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={addItem} style={{ ...btnStyle('secondary'), flex: 1 }}>＋ 新增一条</button>
            <button onClick={expandByPlatforms} disabled={expandableCount === 0}
              style={{
                ...btnStyle('secondary'), flex: 1,
                opacity: expandableCount === 0 ? 0.4 : 1,
                cursor: expandableCount === 0 ? 'default' : 'pointer',
              }}>
              {expandableCount > 0 ? `按平台展开 +${expandableCount}` : '已按平台展开'}
            </button>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>当前合计</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{formatCNY(totalCNY)}</div>
          </div>
          <button onClick={() => onSave({ ...snap, totalValueCNY: totalCNY })}
            disabled={totalCNY <= 0}
            style={{ ...btnStyle('primary'), opacity: totalCNY > 0 ? 1 : 0.4 }}>
            保存快照
          </button>
        </div>
      </div>
    </div>
  )
}

function ItemEditor({ item, onChange, onRemove, valueCNY, customPlatforms, customClasses, hiddenPlatforms, hiddenClasses }: {
  item: SnapshotItem
  onChange: (p: Partial<SnapshotItem>) => void
  onRemove: () => void
  valueCNY: number
  customPlatforms: string[]
  customClasses: string[]
  hiddenPlatforms: string[]
  hiddenClasses: string[]
}) {
  // Virtual select value: '__custom__Name' for custom platforms, else AssetPlatform key
  const platformSelectValue = item.platform === 'other' && item.customPlatformName
    ? `__custom__${item.customPlatformName}`
    : item.platform

  const classSelectValue = item.assetClass === 'other' && item.customAssetClassName
    ? `__custom__${item.customAssetClassName}`
    : item.assetClass

  function onPlatformChange(value: string) {
    if (value.startsWith('__custom__')) {
      onChange({ platform: 'other', customPlatformName: value.slice(10), currency: 'CNY' })
    } else {
      const p = value as AssetPlatform
      onChange({ platform: p, customPlatformName: '', currency: PLATFORM_DEFAULT_CURRENCY[p] })
    }
  }

  function onClassChange(value: string) {
    if (value.startsWith('__custom__')) {
      onChange({ assetClass: 'other', customAssetClassName: value.slice(10) })
    } else {
      onChange({ assetClass: value as AssetClass, customAssetClassName: '' })
    }
  }

  return (
    <div style={{ background: 'var(--surface-muted)', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{effectivePlatformLabel(item)}</span>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}>删除</button>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>平台</span>
        <select value={platformSelectValue} onChange={e => onPlatformChange(e.target.value)} style={selectStyle}>
          {(Object.keys(PLATFORM_LABELS) as AssetPlatform[])
            .filter(p => p !== 'other' && (!hiddenPlatforms.includes(p) || p === item.platform))
            .map(p => (
              <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
            ))}
          {customPlatforms.map(name => (
            <option key={name} value={`__custom__${name}`}>{name}</option>
          ))}
          <option value="other">其他（自定义）</option>
        </select>
      </div>
      {item.platform === 'other' && !customPlatforms.includes(item.customPlatformName) && (
        <input placeholder="自定义平台名称" value={item.customPlatformName}
          onChange={e => onChange({ customPlatformName: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
      )}

      <div style={rowStyle}>
        <span style={labelStyle}>类别</span>
        <select value={classSelectValue} onChange={e => onClassChange(e.target.value)} style={selectStyle}>
          {(Object.keys(CLASS_LABELS) as AssetClass[])
            .filter(c => c !== 'other' && (!hiddenClasses.includes(c) || c === item.assetClass))
            .map(c => (
              <option key={c} value={c}>{CLASS_LABELS[c]}</option>
            ))}
          {customClasses.map(name => (
            <option key={name} value={`__custom__${name}`}>{name}</option>
          ))}
          <option value="other">其他（自定义）</option>
        </select>
      </div>
      {item.assetClass === 'other' && !customClasses.includes(item.customAssetClassName) && (
        <input placeholder="自定义类别名称" value={item.customAssetClassName}
          onChange={e => onChange({ customAssetClassName: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />
      )}

      <input placeholder="资产名称（如 BTC、招商银行存款）" value={item.assetLabel}
        onChange={e => onChange({ assetLabel: e.target.value })} style={{ ...inputStyle, marginBottom: 8 }} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input type="number" placeholder="金额" value={item.amount || ''}
          onChange={e => onChange({ amount: parseFloat(e.target.value) || 0 })}
          style={{ ...inputStyle, flex: 1 }} />
        <select value={item.currency} onChange={e => onChange({ currency: e.target.value as 'CNY' | 'USD' })}
          style={{ ...selectStyle, width: 72 }}>
          <option value="CNY">CNY</option>
          <option value="USD">USD</option>
        </select>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
        折算人民币：<strong>{formatCNY(valueCNY)}</strong>
      </div>
    </div>
  )
}

const sectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)' }
const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }
const selectStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--input-border)', fontSize: 14, background: 'var(--input-bg)', color: 'var(--text)' }

function btnStyle(variant: 'primary' | 'secondary' | 'ghost'): React.CSSProperties {
  const base: React.CSSProperties = { border: 'none', borderRadius: 20, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }
  if (variant === 'primary') return { ...base, background: 'var(--primary)', color: '#fff' }
  if (variant === 'secondary') return { ...base, background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }
  return { ...base, background: 'none', color: 'var(--text-soft)' }
}
