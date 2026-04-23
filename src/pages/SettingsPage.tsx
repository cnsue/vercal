import { useState } from 'react'
import { useAssetStore } from '../store/useAssetStore'
import { PLATFORM_LABELS, CLASS_LABELS } from '../types/models'
import PensionConfigCard from '../components/retirement/PensionConfigCard'

export default function SettingsPage() {
  const store = useAssetStore()
  const [newPlatform, setNewPlatform] = useState('')
  const [newClass, setNewClass] = useState('')

  function addPlatform() {
    const name = newPlatform.trim()
    if (name) { store.addCustomPlatform(name); setNewPlatform('') }
  }

  function addClass() {
    const name = newClass.trim()
    if (name) { store.addCustomClass(name); setNewClass('') }
  }

  return (
    <div style={{ paddingTop: 12, paddingBottom: 80 }}>
      <div style={{ marginBottom: 12 }}>
        <PensionConfigCard />
      </div>
      <Card title="平台管理">
        <SectionLabel>内置平台</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {(Object.keys(PLATFORM_LABELS) as (keyof typeof PLATFORM_LABELS)[])
            .filter(k => k !== 'other' && !store.hiddenPlatforms.includes(k))
            .map(k => (
              <TagPill key={k} label={PLATFORM_LABELS[k]} onDelete={() => store.hideBuiltinPlatform(k)} />
            ))}
        </div>
        {store.hiddenPlatforms.length > 0 && (
          <>
            <SectionLabel>已隐藏内置平台</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {store.hiddenPlatforms.map(k => (
                <button key={k} onClick={() => store.restoreBuiltinPlatform(k)} style={hiddenTagStyle}>
                  {PLATFORM_LABELS[k as keyof typeof PLATFORM_LABELS] ?? k}
                  <span style={restoreHint}>恢复</span>
                </button>
              ))}
            </div>
          </>
        )}
        {store.customPlatforms.length > 0 && (
          <>
            <SectionLabel>自定义平台</SectionLabel>
            {store.customPlatforms.map(name => (
              <div key={name} style={customRowStyle}>
                <span style={{ fontSize: 14 }}>{name}</span>
                <button onClick={() => store.removeCustomPlatform(name)} style={deleteBtn}>删除</button>
              </div>
            ))}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            placeholder="新增平台名称"
            value={newPlatform}
            onChange={e => setNewPlatform(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPlatform()}
            style={inputStyle}
          />
          <button onClick={addPlatform} style={addBtnStyle}>添加</button>
        </div>
      </Card>

      <Card title="类别管理" style={{ marginTop: 12 }}>
        <SectionLabel>内置类别</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {(Object.keys(CLASS_LABELS) as (keyof typeof CLASS_LABELS)[])
            .filter(k => k !== 'other' && !store.hiddenClasses.includes(k))
            .map(k => (
              <TagPill key={k} label={CLASS_LABELS[k]} onDelete={() => store.hideBuiltinClass(k)} />
            ))}
        </div>
        {store.hiddenClasses.length > 0 && (
          <>
            <SectionLabel>已隐藏内置类别</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {store.hiddenClasses.map(k => (
                <button key={k} onClick={() => store.restoreBuiltinClass(k)} style={hiddenTagStyle}>
                  {CLASS_LABELS[k as keyof typeof CLASS_LABELS] ?? k}
                  <span style={restoreHint}>恢复</span>
                </button>
              ))}
            </div>
          </>
        )}
        {store.customClasses.length > 0 && (
          <>
            <SectionLabel>自定义类别</SectionLabel>
            {store.customClasses.map(name => (
              <div key={name} style={customRowStyle}>
                <span style={{ fontSize: 14 }}>{name}</span>
                <button onClick={() => store.removeCustomClass(name)} style={deleteBtn}>删除</button>
              </div>
            ))}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            placeholder="新增类别名称"
            value={newClass}
            onChange={e => setNewClass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addClass()}
            style={inputStyle}
          />
          <button onClick={addClass} style={addBtnStyle}>添加</button>
        </div>
      </Card>

      <div style={{
        marginTop: 16, textAlign: 'center',
        fontSize: 11, color: 'var(--muted)', lineHeight: 1.6,
      }}>
        Coinsight v{__APP_VERSION__} · 构建 {__BUILD_TIME__} · {__BUILD_COMMIT__}
      </div>
    </div>
  )
}

function Card({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, border: '1px solid #eee', ...style }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{children}</div>
}

function TagPill({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <span style={builtinTagStyle}>
      {label}
      <button onClick={onDelete} aria-label={`删除 ${label}`} style={tagDeleteBtn}>×</button>
    </span>
  )
}

const builtinTagStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: '#f0f0f0', borderRadius: 6, padding: '4px 4px 4px 10px', fontSize: 13, color: '#555',
}
const tagDeleteBtn: React.CSSProperties = {
  width: 18, height: 18, borderRadius: '50%', border: 'none',
  background: 'transparent', color: '#999', cursor: 'pointer',
  fontSize: 14, lineHeight: 1, padding: 0,
}
const hiddenTagStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'transparent', border: '1px dashed #ccc', borderRadius: 6,
  padding: '3px 10px', fontSize: 13, color: '#aaa', cursor: 'pointer',
  textDecoration: 'line-through',
}
const restoreHint: React.CSSProperties = {
  fontSize: 11, color: '#1e6845', fontWeight: 600, textDecoration: 'none',
}
const customRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  background: '#f5f5f5', borderRadius: 8, padding: '8px 12px', marginBottom: 6,
}
const deleteBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: 13, padding: '0 4px',
}
const inputStyle: React.CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14,
}
const addBtnStyle: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 8, border: 'none', background: '#1a3a2a', color: '#fff',
  cursor: 'pointer', fontWeight: 600, fontSize: 14,
}
