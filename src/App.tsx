import { useState, useEffect } from 'react'
import AssetPage from './pages/AssetPage'
import RetirementPage from './pages/RetirementPage'
import ToolsPage from './pages/ToolsPage'
import SettingsPage from './pages/SettingsPage'
import PensionSettingsPage from './components/retirement/PensionSettingsPage'
import AssetClassSettingsPage from './pages/AssetClassSettingsPage'
import MortgagePrepaymentPage from './pages/MortgagePrepaymentPage'
import ExternalToolPage from './pages/ExternalToolPage'
import SnapshotEditor from './components/SnapshotEditor'
import { bootstrapStore } from './store/useAssetStore'
import { useAssetStore } from './store/useAssetStore'
import { StorageService } from './store/storage'
import { formatDateKey, displayDate } from './utils/formatters'
import { usePwaUpdate } from './utils/pwaUpdate'
import type { Snapshot } from './types/models'
import type { ThemePreference } from './types/theme'

type Tab = 'asset' | 'retirement' | 'tools' | 'settings'

const TAB_TITLES: Record<Tab, string> = {
  asset: 'Coinsight',
  retirement: '岁月',
  tools: '养老金工具',
  settings: '设置',
}

export type Subpage =
  | { kind: 'pension-settings' }
  | { kind: 'asset-classes' }
  | { kind: 'mortgage-prepayment' }
  | { kind: 'external-tool'; title: string; url: string }
  | null

function subpageTitle(s: Exclude<Subpage, null>): string {
  switch (s.kind) {
    case 'pension-settings': return '养老金信息'
    case 'asset-classes': return '资产类别管理'
    case 'mortgage-prepayment': return '房贷提前还款'
    case 'external-tool': return s.title
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('asset')
  const [subpage, setSubpage] = useState<Subpage>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [editingSnap, setEditingSnap] = useState<Snapshot | null>(null)
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => StorageService.getThemePreference())
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

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = themePreference === 'system'
        ? (media.matches ? 'dark' : 'light')
        : themePreference
      document.documentElement.dataset.theme = resolved
      window.dispatchEvent(new Event('coinsight-theme-change'))
    }
    applyTheme()
    if (themePreference !== 'system') return
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [themePreference])

  function setThemePreference(next: ThemePreference) {
    StorageService.saveThemePreference(next)
    setThemePreferenceState(next)
  }

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

  const title = subpage ? subpageTitle(subpage) : TAB_TITLES[tab]
  const showPlusAction = tab === 'asset' && !editingSnap && !subpage
  const showBottomTabs = !editingSnap && !subpage
  const isIframeSubpage = subpage?.kind === 'external-tool'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: 'var(--tab-bg)' }}>
      {/* Top nav bar */}
      <div style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {showInstallBanner && (
          <div style={{ background: 'var(--primary)', color: '#fff', padding: '10px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>在 Safari 中点击「分享」→「添加到主屏幕」，以 App 方式使用</span>
            <button onClick={() => { StorageService.dismissInstallBanner(); setShowInstallBanner(false) }}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
        )}
        {needRefresh && (
          <button onClick={apply}
            style={{
              width: '100%', background: 'var(--accent)', color: '#fff',
              padding: '10px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
            }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <span style={{ flex: 1, fontWeight: 600 }}>新版本可用</span>
            <span style={{ fontSize: 12, opacity: 0.9 }}>点击刷新 ›</span>
          </button>
        )}
        <div style={{ padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 4, minHeight: 52 }}>
          <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {subpage && (
              <button onClick={() => setSubpage(null)} aria-label="返回"
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: '6px 10px' }}>
                ‹
              </button>
            )}
          </div>
          <div style={{
            flex: 1, textAlign: 'center',
            fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showPlusAction && (
              <button
                onClick={() => setEditingSnap(store.draftSnapshot(todayKey))}
                aria-label="新增资产快照"
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                  background: 'var(--primary)', color: '#fff', fontSize: 22, lineHeight: '28px',
                  cursor: 'pointer', padding: 0, fontWeight: 400,
                }}
              >+</button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: isIframeSubpage ? 'hidden' : 'auto',
        padding: (editingSnap || isIframeSubpage) ? 0 : '12px 16px 0',
        background: 'var(--bg)',
      }}>
        {editingSnap ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SnapshotEditor
              snapshot={editingSnap}
              onSave={handleSaveSnap}
              onDelete={sorted.some(s => s.dateKey === editingSnap.dateKey) ? handleDeleteSnap : undefined}
              onCancel={() => setEditingSnap(null)}
            />
          </div>
        ) : subpage ? (
          renderSubpage(subpage, () => setSubpage(null))
        ) : (
          <>
            {tab === 'asset' && <AssetPage onOpenEditor={setEditingSnap} />}
            {tab === 'retirement' && <RetirementPage />}
            {tab === 'tools' && <ToolsPage onNavigate={setSubpage} />}
            {tab === 'settings' && (
              <SettingsPage
                themePreference={themePreference}
                onThemePreferenceChange={setThemePreference}
                onNavigate={setSubpage}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom tab bar — hidden when sub-page or snapshot editor is active */}
      {showBottomTabs && (
        <div style={{
          background: 'var(--tab-bg)',
          backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border)',
          display: 'flex', paddingBottom: 0,
          flexShrink: 0,
        }}>
          <TabButton label="资产" icon="💰" active={tab === 'asset'} badge={!recordedToday && sorted.length > 0} onClick={() => setTab('asset')} />
          <TabButton label="岁月" icon="📅" active={tab === 'retirement'} onClick={() => setTab('retirement')} />
          <TabButton label="工具" icon="📊" active={tab === 'tools'} onClick={() => setTab('tools')} />
          <TabButton label="设置" icon="⚙️" active={tab === 'settings'} onClick={() => setTab('settings')} />
        </div>
      )}
    </div>
  )
}

function renderSubpage(subpage: Exclude<Subpage, null>, back: () => void) {
  switch (subpage.kind) {
    case 'pension-settings':
      return <PensionSettingsPage onBack={back} />
    case 'asset-classes':
      return <AssetClassSettingsPage />
    case 'mortgage-prepayment':
      return <MortgagePrepaymentPage />
    case 'external-tool':
      return <ExternalToolPage url={subpage.url} />
  }
}

function TabButton({ label, icon, active, badge, onClick }: {
  label: string; icon: string; active: boolean; badge?: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
      color: active ? 'var(--primary)' : 'var(--chevron)', position: 'relative',
    }}>
      <span style={{ fontSize: 22, position: 'relative' }}>
        {icon}
        {badge && <span style={{ position: 'absolute', top: -2, right: -4, width: 8, height: 8, background: 'var(--badge-warning)', borderRadius: '50%' }} />}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{label}</span>
    </button>
  )
}
