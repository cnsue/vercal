import { useState } from 'react'
import PensionSettingsPage from '../components/retirement/PensionSettingsPage'
import AssetClassSettingsPage from './AssetClassSettingsPage'

type Subpage = 'pension' | 'assetClasses' | null

export default function SettingsPage() {
  const [subpage, setSubpage] = useState<Subpage>(null)

  if (subpage === 'pension') {
    return <PensionSettingsPage onBack={() => setSubpage(null)} />
  }
  if (subpage === 'assetClasses') {
    return <AssetClassSettingsPage onBack={() => setSubpage(null)} />
  }

  return (
    <div style={{ paddingTop: 12, paddingBottom: 16 }}>
      <EntryRow
        icon="🏛️"
        title="养老金信息"
        subtitle="性别、出生年月、缴费情况、弹性退休"
        onClick={() => setSubpage('pension')}
      />
      <EntryRow
        icon="🗂️"
        title="资产类别管理"
        subtitle="管理平台和资产类别（可隐藏内置项 / 增删自定义）"
        onClick={() => setSubpage('assetClasses')}
      />

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
        background: '#fff', border: '1px solid #eee', borderRadius: 16,
        padding: 16, marginBottom: 12, cursor: 'pointer', textAlign: 'left',
      }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      <span style={{ color: '#aaa', fontSize: 20 }}>›</span>
    </button>
  )
}
