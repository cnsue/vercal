import { useState, useEffect } from 'react'
import AssetPage from './pages/AssetPage'
import ToolsPage from './pages/ToolsPage'
import SettingsPage from './pages/SettingsPage'
import { bootstrapStore } from './store/useAssetStore'
import { useAssetStore } from './store/useAssetStore'
import { StorageService } from './store/storage'
import { formatDateKey } from './utils/formatters'

type Tab = 'asset' | 'tools' | 'settings'

const TAB_TITLES: Record<Tab, string> = {
  asset: 'Coinsight',
  tools: '养老金工具',
  settings: '设置',
}

export default function App() {
  const [tab, setTab] = useState<Tab>('asset')
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const store = useAssetStore()

  useEffect(() => {
    bootstrapStore()
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isIOS && !isStandalone && !StorageService.isInstallBannerDismissed()) {
      setShowInstallBanner(true)
    }
  }, [])

  const sorted = store.snapshots
  const todayKey = formatDateKey(new Date())
  const recordedToday = sorted.some(s => s.dateKey === todayKey)

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Top nav bar — provides safe-area-inset-top buffer + title */}
      <div style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: '#fff',
        borderBottom: '1px solid #eee',
        flexShrink: 0,
      }}>
        {showInstallBanner && (
          <div style={{ background: '#1a3a2a', color: '#fff', padding: '10px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>在 Safari 中点击「分享」→「添加到主屏幕」，以 App 方式使用</span>
            <button onClick={() => { StorageService.dismissInstallBanner(); setShowInstallBanner(false) }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
        )}
        <div style={{ padding: '12px 16px', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
          {TAB_TITLES[tab]}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 0' }}>
        {tab === 'asset' && <AssetPage />}
        {tab === 'tools' && <ToolsPage />}
        {tab === 'settings' && <SettingsPage />}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)', borderTop: '1px solid #eee',
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0,
      }}>
        <TabButton label="资产" icon="💰" active={tab === 'asset'} badge={!recordedToday && sorted.length > 0} onClick={() => setTab('asset')} />
        <TabButton label="工具" icon="📊" active={tab === 'tools'} onClick={() => setTab('tools')} />
        <TabButton label="设置" icon="⚙️" active={tab === 'settings'} onClick={() => setTab('settings')} />
      </div>
    </div>
  )
}

function TabButton({ label, icon, active, badge, onClick }: {
  label: string; icon: string; active: boolean; badge?: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
      color: active ? '#1a3a2a' : '#aaa', position: 'relative',
    }}>
      <span style={{ fontSize: 22, position: 'relative' }}>
        {icon}
        {badge && <span style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, background: '#e67e22', borderRadius: '50%' }} />}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{label}</span>
    </button>
  )
}
