import { useState } from 'react'
import { useAssetStore } from '../store/useAssetStore'
import { PLATFORM_LABELS, CLASS_LABELS } from '../types/models'

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
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px 0 16px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>
        设置
      </div>

      <Card title="平台管理">
        <SectionLabel>内置平台</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {(Object.keys(PLATFORM_LABELS) as (keyof typeof PLATFORM_LABELS)[])
            .filter(k => k !== 'other')
            .map(k => (
              <span key={k} style={builtinTagStyle}>{PLATFORM_LABELS[k]}</span>
            ))}
        </div>
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
            .filter(k => k !== 'other')
            .map(k => (
              <span key={k} style={builtinTagStyle}>{CLASS_LABELS[k]}</span>
            ))}
        </div>
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

const builtinTagStyle: React.CSSProperties = {
  background: '#f0f0f0', borderRadius: 6, padding: '4px 10px', fontSize: 13, color: '#555',
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
