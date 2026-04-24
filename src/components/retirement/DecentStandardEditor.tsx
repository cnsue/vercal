import { useState, useEffect, useMemo } from 'react'
import { useRetirementStore } from '../../store/useRetirementStore'
import {
  defaultDecentBreakdown, sumBreakdown, findDimensionMeta,
  buildPresetBreakdown, COVERAGE_LEVELS, FAMILY_SIZE_LABELS, CITY_TIER_LABELS,
  type DecentBreakdownItem, type FamilySize, type CityTier,
} from '../../types/retirement'
import { formatCNY } from '../../utils/formatters'
import { v4 as uuidv4 } from '../../utils/uuid'

interface Props {
  open: boolean
  onClose: () => void
}

const STEP = 100

function cloneBreakdown(items: DecentBreakdownItem[]): DecentBreakdownItem[] {
  return items.map(i => ({ ...i }))
}

export default function DecentStandardEditor({ open, onClose }: Props) {
  const decent = useRetirementStore(s => s.plan.decentStandard)
  const setDecentStandard = useRetirementStore(s => s.setDecentStandard)
  const [items, setItems] = useState<DecentBreakdownItem[]>(defaultDecentBreakdown())
  const [presetFamily, setPresetFamily] = useState<FamilySize>('family3')
  const [presetCity, setPresetCity] = useState<CityTier>('tier1')
  const [presetLevel, setPresetLevel] = useState<string>('decent')

  useEffect(() => {
    if (open) {
      setItems(decent.breakdown.length > 0
        ? cloneBreakdown(decent.breakdown)
        : defaultDecentBreakdown())
    }
  }, [open, decent.breakdown])

  const total = useMemo(() => sumBreakdown(items), [items])

  if (!open) return null

  function updateAmount(id: string, nextAmount: number) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, monthlyAmount: Math.max(0, Math.round(nextAmount)) } : i)))
  }

  function updateCustomField(id: string, patch: Partial<Pick<DecentBreakdownItem, 'name' | 'icon'>>) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)))
  }

  function addCustom() {
    setItems(prev => [...prev, {
      id: uuidv4(), name: '自定义项目', icon: '⭐', monthlyAmount: 500,
    }])
  }

  function removeCustom(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function applyPreset() {
    setItems(buildPresetBreakdown(presetLevel, presetFamily, presetCity))
  }

  function resetDefaults() {
    setItems(defaultDecentBreakdown())
  }

  function save() {
    const cleaned = items
      .map(i => ({ ...i, monthlyAmount: Math.max(0, Math.round(i.monthlyAmount)) }))
      .filter(i => i.builtinKey || i.monthlyAmount > 0 || i.name.trim().length > 0)
    setDecentStandard({
      monthlyAmount: sumBreakdown(cleaned),
      breakdown: cleaned,
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      zIndex: 100, display: 'flex', alignItems: 'flex-end',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
        width: '100%', maxWidth: 480, margin: '0 auto',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
            设定你的体面退休标准
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, marginBottom: 14, lineHeight: 1.5 }}>
            我们帮你拆解为 7 个生活方面，也可以添加自定义项目。<br />
            衣食住行为「必需」，收入不足时优先覆盖；医乐爱及自定义为「弹性」。
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* Preset selector */}
          <div style={{
            background: 'var(--surface-muted)', borderRadius: 12, padding: '12px 12px 10px',
            marginBottom: 14, border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
              从推荐套餐开始
            </div>
            <PresetRow
              label="家庭"
              options={(Object.entries(FAMILY_SIZE_LABELS) as [FamilySize, string][]).map(([k, v]) => ({ key: k, label: v }))}
              value={presetFamily}
              onChange={v => setPresetFamily(v as FamilySize)}
            />
            <PresetRow
              label="城市"
              options={(Object.entries(CITY_TIER_LABELS) as [CityTier, string][]).map(([k, v]) => ({ key: k, label: v }))}
              value={presetCity}
              onChange={v => setPresetCity(v as CityTier)}
            />
            <PresetRow
              label="层级"
              options={COVERAGE_LEVELS.map(l => ({ key: l.key, label: `${l.emoji}${l.label}` }))}
              value={presetLevel}
              onChange={setPresetLevel}
            />
            <button onClick={applyPreset} style={{
              width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 8,
              border: 'none', background: 'var(--primary)', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              应用套餐
            </button>
          </div>

          {items.map(item => (
            <DimensionRow
              key={item.id}
              item={item}
              onAmountChange={v => updateAmount(item.id, v)}
              onFieldChange={patch => updateCustomField(item.id, patch)}
              onRemove={() => removeCustom(item.id)}
            />
          ))}
          <button onClick={addCustom}
            style={{
              width: '100%', marginTop: 8, padding: 12, borderRadius: 10,
              border: '1px dashed var(--border-dashed)', background: 'var(--surface-subtle)',
              color: 'var(--text-soft)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
            ＋ 添加自定义项目
          </button>
        </div>

        <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 12 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 12, fontSize: 13, color: 'var(--muted)',
          }}>
            <span>总计月开支</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-strong)', letterSpacing: '-0.02em' }}>
              {formatCNY(total)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', cursor: 'pointer', fontWeight: 600 }}>
              取消
            </button>
            <button onClick={resetDefaults}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', cursor: 'pointer', fontWeight: 600 }}>
              重置默认
            </button>
            <button onClick={save}
              style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
              确认体面标准
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DimensionRow({ item, onAmountChange, onFieldChange, onRemove }: {
  item: DecentBreakdownItem
  onAmountChange: (v: number) => void
  onFieldChange: (patch: Partial<Pick<DecentBreakdownItem, 'name' | 'icon'>>) => void
  onRemove: () => void
}) {
  const meta = findDimensionMeta(item.builtinKey)
  const isCustom = !item.builtinKey
  const description = meta?.description ?? '自定义项目 · 按自己的计划填写'

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isCustom ? (
          <input
            value={item.icon}
            onChange={e => onFieldChange({ icon: e.target.value.slice(0, 4) || '⭐' })}
            aria-label="图标"
            style={{
              width: 44, height: 44, borderRadius: 8, textAlign: 'center',
              fontSize: 22, padding: 0,
              border: '1px solid var(--input-border)', background: 'var(--input-bg)',
              color: 'var(--text)', boxSizing: 'border-box',
            }} />
        ) : (
          <div style={{ fontSize: 26, width: 44, textAlign: 'center' }}>{item.icon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isCustom ? (
            <input
              value={item.name}
              onChange={e => onFieldChange({ name: e.target.value })}
              placeholder="项目名称"
              style={{
                width: '100%', padding: '4px 0', border: 'none',
                background: 'transparent', color: 'var(--text)',
                fontSize: 15, fontWeight: 700, outline: 'none',
              }} />
          ) : (
            <div style={{ fontSize: 15, fontWeight: 700 }}>{item.name}</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
            {description}
          </div>
        </div>
        {isCustom && (
          <button onClick={onRemove} aria-label="删除"
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'var(--danger-bg)', color: 'var(--danger)',
              fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 0, fontWeight: 700,
            }}>−</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 54 }}>
        <button onClick={() => onAmountChange(item.monthlyAmount - STEP)} aria-label="减少"
          style={stepperStyle}>−</button>
        <input type="number" inputMode="numeric"
          value={item.monthlyAmount === 0 ? '' : item.monthlyAmount}
          placeholder="0"
          onChange={e => {
            const raw = e.target.value
            if (raw === '') {
              onAmountChange(0)
              return
            }
            const n = parseFloat(raw)
            if (!Number.isNaN(n)) onAmountChange(Math.max(0, n))
          }}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--input-border)', background: 'var(--input-bg)',
            color: 'var(--text)', fontSize: 15, textAlign: 'right', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }} />
        <span style={{ fontSize: 11, color: 'var(--muted)', width: 36, textAlign: 'left' }}>元/月</span>
        <button onClick={() => onAmountChange(item.monthlyAmount + STEP)} aria-label="增加"
          style={stepperStyle}>+</button>
      </div>
    </div>
  )
}

const stepperStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: 'none',
  background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
  fontSize: 18, lineHeight: 1, cursor: 'pointer', padding: 0, fontWeight: 700,
}

function PresetRow<K extends string>({ label, options, value, onChange }: {
  label: string
  options: { key: K; label: string }[]
  value: K
  onChange: (k: K) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', width: 26, flexShrink: 0 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {options.map(o => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              padding: '4px 9px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: value === o.key ? 'var(--primary)' : 'var(--button-secondary-bg)',
              color: value === o.key ? '#fff' : 'var(--button-secondary-text)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
