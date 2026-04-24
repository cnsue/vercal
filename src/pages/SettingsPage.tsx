import type { ThemePreference } from '../types/theme'
import { THEME_LABELS } from '../types/theme'
import type { Subpage } from '../App'

interface Props {
  themePreference: ThemePreference
  onThemePreferenceChange: (v: ThemePreference) => void
  onNavigate: (subpage: Subpage) => void
}

export default function SettingsPage({ themePreference, onThemePreferenceChange, onNavigate }: Props) {
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
