import { useState, useEffect } from 'react'
import AssetPage from './pages/AssetPage'
import RetirementPage from './pages/RetirementPage'
import ToolsPage from './pages/ToolsPage'
import SettingsPage from './pages/SettingsPage'
import SnapshotEditor from './components/SnapshotEditor'
import { bootstrapStore } from './store/useAssetStore'
import { useAssetStore } from './store/useAssetStore'
import { StorageService } from './store/storage'
import { formatDateKey, displayDate } from './utils/formatters'
import { usePwaUpdate } from './utils/pwaUpdate'
import type { Snapshot } from './types/models'

type Tab = 'asset' | 'retirement' | 'tools' | 'settings'

const TAB_TITLES: Record<Tab, string> = {
  asset: 'Coinsight',
  retirement: '岁月',
  tools: '养老金工具',
  settings: '设置',
}

export default function App() {
  const [tab, setTab] = useState<Tab>('asset')
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [editingSnap, setEditingSnap] = useState<Snapshot | null>(null)
  const store = useAssetStore()
  const { needRefresh, apply } = usePwaUpdate()

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

  function handleSaveSnap(snap: Snapshot) {
    store.saveSnapshot(snap)
    setEditingSnap(null)
  }

  function handleDeleteSnap() {
    if (!editingSnap) return
    if (confirm(`删除 ${displayDate(editingSnap.dateKey)} 的资产记录？`)) {
      store.deleteSnapshot(editingSnap.dateKey)
      setEditingSnap(null)
    }
  }

  const showPlusAction = tab === 'asset' && !editingSnap

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', height: '100svh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
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
        {needRefresh && (
          <button onClick={apply}
            style={{
              width: '100%', background: '#d28c3b', color: '#fff',
              padding: '10px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
            }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <span style={{ flex: 1, fontWeight: 600 }}>新版本可用</span>
            <span style={{ fontSize: 12, opacity: 0.9 }}>点击刷新 ›</span>
          </button>
        )}
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>{TAB_TITLES[tab]}</div>
          {showPlusAction && (
            <button
              onClick={() => setEditingSnap(store.draftSnapshot(todayKey))}
              aria-label="新增资产快照"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: '#1a3a2a', color: '#fff', fontSize: 22, lineHeight: '28px',
                cursor: 'pointer', padding: 0, fontWeight: 400,
              }}
            >+</button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: editingSnap ? 0 : '12px 16px 0' }}>
        {editingSnap ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SnapshotEditor
              snapshot={editingSnap}
              onSave={handleSaveSnap}
              onDelete={sorted.some(s => s.dateKey === editingSnap.dateKey) ? handleDeleteSnap : undefined}
              onCancel={() => setEditingSnap(null)}
            />
          </div>
        ) : (
          <>
            {tab === 'asset' && <AssetPage onOpenEditor={setEditingSnap} />}
            {tab === 'retirement' && <RetirementPage />}
            {tab === 'tools' && <ToolsPage />}
            {tab === 'settings' && <SettingsPage />}
          </>
        )}
      </div>

      {/* Bottom tab bar (flex column 末位自然吸底，不需要 sticky) */}
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)', borderTop: '1px solid #eee',
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0,
      }}>
        <TabButton label="资产" icon="💰" active={tab === 'asset'} badge={!recordedToday && sorted.length > 0} onClick={() => setTab('asset')} />
        <TabButton label="岁月" icon="📅" active={tab === 'retirement'} onClick={() => setTab('retirement')} />
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
