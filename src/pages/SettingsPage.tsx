import { useEffect } from 'react'
import type { ThemePreference } from '../types/theme'
import { THEME_LABELS } from '../types/theme'
import type { Subpage } from '../App'
import { usePushStore } from '../store/usePushStore'

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

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 16, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>每日提醒</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>每天 9 点提醒记录资产快照</div>
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
