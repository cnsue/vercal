import { useEffect, useState } from 'react'
import type { ThemePreference } from '../types/theme'
import { THEME_LABELS } from '../types/theme'
import type { Subpage } from '../App'
import { usePushStore } from '../store/usePushStore'
import {
  getPairCode, getLastSyncAt, isPaired,
  enableSyncOnThisDevice, pairWithCode, clearPairing, manualSync,
} from '../store/sync'

interface Props {
  themePreference: ThemePreference
  onThemePreferenceChange: (v: ThemePreference) => void
  onNavigate: (subpage: Subpage) => void
}

export default function SettingsPage({ themePreference, onThemePreferenceChange, onNavigate }: Props) {
  const push = usePushStore()
  useEffect(() => { push.load() }, [])

  return (
    <div style={{ paddingTop: 12, paddingBottom: 16 }}>
      <EntryRow
        icon="🏛️"
        title="养老金信息"
        subtitle="性别、出生年月、缴费情况、弹性退休"
        onClick={() => onNavigate({ kind: 'pension-settings' })}
      />
      <EntryRow
        icon="🗂️"
        title="资产类别管理"
        subtitle="管理平台和资产类别（可隐藏内置项 / 增删自定义）"
        onClick={() => onNavigate({ kind: 'asset-classes' })}
      />
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 16, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🌓</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>外观模式</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>默认跟随系统，也可手动固定浅色或深色</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(Object.keys(THEME_LABELS) as ThemePreference[]).map(key => (
            <button key={key} type="button" onClick={() => onThemePreferenceChange(key)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: themePreference === key ? 'var(--primary)' : 'var(--button-secondary-bg)',
                color: themePreference === key ? '#fff' : 'var(--button-secondary-text)',
              }}>
              {THEME_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <SyncSection />

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 16, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>每日提醒</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>每晚 9 点提醒记录资产快照</div>
          </div>
        </div>

        {push.permissionState === 'unsupported' && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>当前浏览器不支持推送通知</div>
        )}
        {push.permissionState === 'denied' && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>通知权限已被拒绝，请在浏览器设置中手动开启</div>
        )}
        {(push.permissionState === 'default' || push.permissionState === 'granted') && (
          <>
            {push.subscribed && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {(['daily', 'weekly', 'off'] as const).map(f => (
                  <button key={f} type="button" disabled={push.isLoading}
                    onClick={() => push.setFrequency(f)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 10, border: 'none',
                      cursor: push.isLoading ? 'not-allowed' : 'pointer',
                      fontWeight: 700, fontSize: 12,
                      background: push.frequency === f ? 'var(--primary)' : 'var(--button-secondary-bg)',
                      color: push.frequency === f ? '#fff' : 'var(--button-secondary-text)',
                    }}>
                    {{ daily: '每天', weekly: '每周', off: '关闭' }[f]}
                  </button>
                ))}
              </div>
            )}
            <button type="button" disabled={push.isLoading}
              onClick={() => push.subscribed ? push.unsubscribe() : push.subscribe(push.frequency)}
              style={{
                width: '100%', padding: '9px 0', borderRadius: 10, border: 'none',
                cursor: push.isLoading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 13,
                background: push.subscribed ? 'var(--button-secondary-bg)' : 'var(--primary)',
                color: push.subscribed ? 'var(--button-secondary-text)' : '#fff',
              }}>
              {push.isLoading ? '处理中…' : push.subscribed ? '取消提醒' : '开启提醒'}
            </button>
            {push.error && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>{push.error}</div>
            )}
          </>
        )}
      </div>

      <div style={{
        marginTop: 16, textAlign: 'center',
        fontSize: 11, color: 'var(--muted)', lineHeight: 1.6,
      }}>
        Coinsight v{__APP_VERSION__} · 构建 {__BUILD_TIME__} · {__BUILD_COMMIT__}
      </div>
    </div>
  )
}

function SyncSection() {
  const [paired, setPaired] = useState(isPaired())
  const [code, setCode] = useState(getPairCode() ?? '')
  const [lastSyncAt, setLastSyncAt] = useState(getLastSyncAt())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pairInput, setPairInput] = useState('')
  const [showPairInput, setShowPairInput] = useState(false)

  function refreshState() {
    setPaired(isPaired())
    setCode(getPairCode() ?? '')
    setLastSyncAt(getLastSyncAt())
  }

  async function handleEnable() {
    setBusy(true); setMsg(null)
    try {
      const c = await enableSyncOnThisDevice()
      refreshState()
      setMsg({ kind: 'ok', text: `已启用 · 把配对码发给其他设备：${c}` })
    } catch (err) {
      setMsg({ kind: 'err', text: String(err instanceof Error ? err.message : err) })
    } finally {
      setBusy(false)
    }
  }

  async function handlePair() {
    setBusy(true); setMsg(null)
    try {
      await pairWithCode(pairInput)
      setMsg({ kind: 'ok', text: '配对成功，正在加载远端数据…' })
      // pairWithCode 已写入本地，reload 让 store 重新读取
      setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      setMsg({ kind: 'err', text: String(err instanceof Error ? err.message : err) })
    } finally {
      setBusy(false)
    }
  }

  async function handleManual() {
    setBusy(true); setMsg(null)
    try {
      const r = await manualSync()
      refreshState()
      setMsg({ kind: 'ok', text: `已推送 · 远端时间 ${r.remoteAt ? new Date(r.remoteAt).toLocaleString() : '未知'}` })
    } catch (err) {
      setMsg({ kind: 'err', text: String(err instanceof Error ? err.message : err) })
    } finally {
      setBusy(false)
    }
  }

  function handleUnpair() {
    if (!confirm('解除同步后，本机不再自动同步（数据仍保留）。确认？')) return
    clearPairing()
    refreshState()
    setMsg({ kind: 'ok', text: '已解除本机配对' })
  }

  async function copyCode() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setMsg({ kind: 'ok', text: '配对码已复制到剪贴板' })
    } catch {
      setMsg({ kind: 'err', text: '复制失败，请长按选中后手动复制' })
    }
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      padding: 16, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>☁️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>多设备同步</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            手机和电脑共享同一份数据，编辑后自动双向同步
          </div>
        </div>
      </div>

      {paired ? (
        <>
          <div style={{
            background: 'var(--surface-muted)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 10, marginBottom: 10,
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>本机配对码</div>
            <div style={{
              fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              wordBreak: 'break-all', lineHeight: 1.4,
            }}>
              {code}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              上次同步：{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : '—'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={copyCode} disabled={busy}
              style={subBtnStyle}>复制码</button>
            <button type="button" onClick={handleManual} disabled={busy}
              style={subBtnStyle}>{busy ? '同步中…' : '立即同步'}</button>
            <button type="button" onClick={handleUnpair} disabled={busy}
              style={{ ...subBtnStyle, color: 'var(--danger, #c44)' }}>解除</button>
          </div>
        </>
      ) : (
        <>
          {!showPairInput && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={handleEnable} disabled={busy}
                style={primaryBtnStyle}>
                {busy ? '处理中…' : '启用同步（生成配对码）'}
              </button>
              <button type="button" onClick={() => setShowPairInput(true)} disabled={busy}
                style={secondaryBtnStyle}>
                我有配对码
              </button>
            </div>
          )}
          {showPairInput && (
            <>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="none"
                value={pairInput}
                onChange={e => setPairInput(e.target.value.replace(/\s/g, ''))}
                placeholder="粘贴另一台设备的配对码"
                disabled={busy}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: 13,
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  marginBottom: 8,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={handlePair} disabled={busy || !pairInput}
                  style={primaryBtnStyle}>
                  {busy ? '配对中…' : '确认配对'}
                </button>
                <button type="button" onClick={() => { setShowPairInput(false); setPairInput('') }} disabled={busy}
                  style={secondaryBtnStyle}>
                  取消
                </button>
              </div>
            </>
          )}
        </>
      )}

      {msg && (
        <div style={{
          marginTop: 10, fontSize: 11, lineHeight: 1.5,
          color: msg.kind === 'err' ? 'var(--danger, #c44)' : 'var(--muted)',
          wordBreak: 'break-all',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
  background: 'var(--primary)', color: '#fff',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
  background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
  fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

const subBtnStyle: React.CSSProperties = {
  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
  background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
}

function EntryRow({ icon, title, subtitle, onClick }: {
  icon: string; title: string; subtitle: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 16, marginBottom: 12, cursor: 'pointer', textAlign: 'left',
        color: 'var(--text)',
      }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <span style={{ color: 'var(--chevron)', fontSize: 20 }}>›</span>
    </button>
  )
}
