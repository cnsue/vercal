import { useState, useEffect } from 'react'
import { useCashFlowStore } from '../store/useCashFlowStore'
import { useAssetStore } from '../store/useAssetStore'
import {
  BUILTIN_INCOME_CATEGORIES, BUILTIN_EXPENSE_CATEGORIES,
  type CashFlowEvent, type CashFlowType, type PaymentMethod,
} from '../types/cashFlow'
import { PLATFORM_LABELS, type AssetPlatform } from '../types/models'
import { formatDateKey } from '../utils/formatters'

interface Props {
  open: boolean
  initial?: CashFlowEvent | null
  onClose: () => void
}

const ALL_PLATFORMS: AssetPlatform[] = [
  'cmb', 'alipay', 'binance', 'okx', 'futu', 'tiger',
  'gfSecurities', 'citicSecurities', 'bybit', 'kraken', 'other',
]

export default function CashFlowEditor({ open, initial, onClose }: Props) {
  const addEvent = useCashFlowStore(s => s.addEvent)
  const updateEvent = useCashFlowStore(s => s.updateEvent)
  const removeEvent = useCashFlowStore(s => s.removeEvent)
  const customPlatforms = useAssetStore(s => s.customPlatforms)
  const hiddenPlatforms = useAssetStore(s => s.hiddenPlatforms)

  const [type, setType] = useState<CashFlowType>('expense')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('asset')
  const [date, setDate] = useState<string>(formatDateKey(new Date()))
  const [category, setCategory] = useState<string>('daily')
  const [customCategory, setCustomCategory] = useState<string>('')
  const [platform, setPlatform] = useState<AssetPlatform | ''>('')
  const [customPlatformName, setCustomPlatformName] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState<string>('')

  useEffect(() => {
    if (!open) return
    if (initial) {
      setType(initial.type)
      setPaymentMethod(initial.paymentMethod)
      setDate(initial.date)
      setCategory(initial.category)
      setCustomCategory(isBuiltin(initial.type, initial.category) ? '' : initial.category)
      setPlatform(initial.platform ?? '')
      setCustomPlatformName(initial.customPlatformName ?? '')
      setAmount(initial.amount > 0 ? String(initial.amount) : '')
      setNote(initial.note)
    } else {
      setType('expense')
      setPaymentMethod('asset')
      setDate(formatDateKey(new Date()))
      setCategory('daily')
      setCustomCategory('')
      setPlatform('')
      setCustomPlatformName('')
      setAmount('')
      setNote('')
    }
  }, [open, initial])

  if (!open) return null

  const builtinList = type === 'income' ? BUILTIN_INCOME_CATEGORIES : BUILTIN_EXPENSE_CATEGORIES
  const isCustomCategory = !builtinList.some(c => c.key === category)
  const finalCategoryKey = isCustomCategory ? customCategory.trim() : category

  function isBuiltin(t: CashFlowType, key: string): boolean {
    const list = t === 'income' ? BUILTIN_INCOME_CATEGORIES : BUILTIN_EXPENSE_CATEGORIES
    return list.some(c => c.key === key)
  }

  function switchType(next: CashFlowType) {
    setType(next)
    // reset to first builtin category
    const list = next === 'income' ? BUILTIN_INCOME_CATEGORIES : BUILTIN_EXPENSE_CATEGORIES
    setCategory(list[0].key)
    setCustomCategory('')
    if (next === 'income') setPaymentMethod('asset')
  }

  function handleSave() {
    const amt = parseFloat(amount)
    if (!isFinite(amt) || amt <= 0) {
      alert('请输入正确金额')
      return
    }
    if (isCustomCategory && !finalCategoryKey) {
      alert('请输入自定义分类名称')
      return
    }
    const payload = {
      date,
      type,
      paymentMethod: type === 'income' ? 'asset' as PaymentMethod : paymentMethod,
      amount: Math.round(amt * 100) / 100,
      category: finalCategoryKey,
      platform: platform || undefined,
      customPlatformName: platform === 'other' && customPlatformName.trim()
        ? customPlatformName.trim() : undefined,
      note: note.trim(),
    }
    if (initial) updateEvent(initial.id, payload)
    else addEvent(payload)
    onClose()
  }

  function handleDelete() {
    if (!initial) return
    if (!confirm('删除这条现金流？')) return
    removeEvent(initial.id)
    onClose()
  }

  const visiblePlatforms = ALL_PLATFORMS.filter(p => !hiddenPlatforms.includes(p))

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
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', marginBottom: 14 }}>
            {initial ? '编辑现金流' : '新增现金流'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <FieldRow label="类型">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['income', 'expense'] as const).map(t => (
                <button key={t} type="button" onClick={() => switchType(t)}
                  style={pillStyle(type === t)}>
                  {t === 'income' ? '📥 收入' : '📤 支出'}
                </button>
              ))}
            </div>
          </FieldRow>

          {type === 'expense' && (
            <FieldRow label="方式">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['asset', 'credit'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setPaymentMethod(m)}
                    style={pillStyle(paymentMethod === m)}>
                    {m === 'asset' ? '💵 资产直付' : '💳 信用卡'}
                  </button>
                ))}
              </div>
              {paymentMethod === 'credit' && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                  信用卡消费不影响当下资产。还款时另记一笔「资产直付 · 信用卡还款」。
                </div>
              )}
            </FieldRow>
          )}

          <FieldRow label="日期">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={inputStyle} />
          </FieldRow>

          <FieldRow label="分类">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {builtinList.map(c => (
                <button key={c.key} type="button" onClick={() => { setCategory(c.key); setCustomCategory('') }}
                  style={pillStyle(category === c.key, true)}>
                  {c.icon} {c.label}
                </button>
              ))}
              <button type="button"
                onClick={() => { setCategory('__custom'); setCustomCategory(customCategory || '') }}
                style={pillStyle(isCustomCategory, true)}>
                ＋ 自定义
              </button>
            </div>
            {isCustomCategory && (
              <input type="text" value={customCategory}
                onChange={e => setCustomCategory(e.target.value.slice(0, 20))}
                placeholder="自定义分类名" style={{ ...inputStyle, marginTop: 6 }} />
            )}
          </FieldRow>

          <FieldRow label="账户（选填）">
            <select value={platform} onChange={e => setPlatform(e.target.value as AssetPlatform | '')}
              style={inputStyle}>
              <option value="">不指定</option>
              {visiblePlatforms.map(p => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
            {platform === 'other' && (
              <input type="text" value={customPlatformName}
                onChange={e => setCustomPlatformName(e.target.value.slice(0, 20))}
                placeholder="自定义账户名"
                list="custom-platforms"
                style={{ ...inputStyle, marginTop: 6 }} />
            )}
            {platform === 'other' && customPlatforms.length > 0 && (
              <datalist id="custom-platforms">
                {customPlatforms.map(n => <option key={n} value={n} />)}
              </datalist>
            )}
          </FieldRow>

          <FieldRow label="金额">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>¥</span>
              <input type="number" inputMode="decimal" value={amount}
                onChange={e => setAmount(e.target.value)} placeholder="0.00"
                style={{ ...inputStyle, flex: 1, textAlign: 'right' }} />
            </div>
          </FieldRow>

          <FieldRow label="备注（可选）">
            <input type="text" value={note}
              onChange={e => setNote(e.target.value.slice(0, 60))}
              placeholder="一两个字描述这笔" style={inputStyle} />
          </FieldRow>
        </div>

        <div style={{ flex: '0 0 auto', borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} type="button"
              style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', cursor: 'pointer', fontWeight: 600 }}>
              取消
            </button>
            {initial && (
              <button onClick={handleDelete} type="button"
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', fontWeight: 700 }}>
                删除
              </button>
            )}
            <button onClick={handleSave} type="button"
              style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
              {initial ? '保存' : '添加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)', color: 'var(--text)',
  fontSize: 14, fontFamily: 'inherit',
  outline: 'none',
}

function pillStyle(active: boolean, small = false): React.CSSProperties {
  return {
    padding: small ? '5px 9px' : '8px 14px',
    borderRadius: small ? 6 : 8,
    border: 'none', cursor: 'pointer',
    background: active ? 'var(--primary)' : 'var(--button-secondary-bg)',
    color: active ? '#fff' : 'var(--button-secondary-text)',
    fontSize: small ? 12 : 13,
    fontWeight: 600,
  }
}
