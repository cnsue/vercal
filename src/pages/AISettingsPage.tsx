import { useState } from 'react'
import type { Subpage } from '../App'
import { StorageService } from '../store/storage'
import {
  AI_PROVIDER_PRESETS,
  findAIProviderPreset,
  type AIProviderKey,
  type AIProtocol,
  type AISettings,
} from '../types/ai'

export default function AISettingsPage({ onNavigate }: { onNavigate?: (s: Subpage) => void }) {
  const [settings, setSettings] = useState<AISettings>(() => StorageService.getAISettings())
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  function patch(patchValue: Partial<AISettings>) {
    setSettings(prev => ({ ...prev, ...patchValue }))
    setSaved(false)
  }

  function selectProvider(provider: AIProviderKey) {
    // Auto-save current provider before switching
    StorageService.saveAIProviderSettings(settings.provider, {
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
    })
    const preset = findAIProviderPreset(provider)
    const saved = StorageService.getAIProviderSettings(provider)
    patch({
      provider,
      protocol: preset.protocol,
      baseUrl: saved.baseUrl ?? preset.baseUrl,
      model: saved.model ?? preset.model,
      apiKey: saved.apiKey ?? '',
    })
  }

  function save() {
    StorageService.saveAISettings(settings)
    StorageService.saveAIProviderSettings(settings.provider, {
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
    })
    setSaved(true)
  }

  function restoreProviderDefault() {
    const preset = findAIProviderPreset(settings.provider)
    patch({
      protocol: preset.protocol,
      baseUrl: preset.baseUrl,
      model: preset.model,
    })
  }

  function clearKey() {
    patch({ apiKey: '' })
  }

  const preset = findAIProviderPreset(settings.provider)

  return (
    <div style={{ paddingBottom: 20 }}>
      <section style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>
          本机保存 · 不参与多设备同步
        </div>
        <div style={{ fontSize: 22, fontWeight: 850, color: 'var(--text-strong)', marginBottom: 8 }}>
          AI 设置
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          API Key 只存当前浏览器。分析时会临时发给 Vercel Function 代理调用，服务端不保存、不记录密钥。
        </div>
      </section>

      <section style={cardStyle}>
        <Label>Provider</Label>
        <select value={settings.provider} onChange={e => selectProvider(e.target.value as AIProviderKey)} style={inputStyle}>
          {AI_PROVIDER_PRESETS.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
          {preset.note}
        </div>

        <div style={{ height: 12 }} />
        <Label>API Key</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={e => patch({ apiKey: e.target.value })}
            placeholder="粘贴你自己的 API Key"
            autoComplete="off"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" onClick={() => setShowKey(v => !v)} style={smallBtn}>
            {showKey ? '隐藏' : '显示'}
          </button>
        </div>

        <div style={{ height: 12 }} />
        <Label>Model</Label>
        <input value={settings.model} onChange={e => patch({ model: e.target.value })} placeholder="例如 gemini-2.5-flash" style={inputStyle} />

        <div style={{ height: 12 }} />
        <Label>Base URL</Label>
        <input value={settings.baseUrl} onChange={e => patch({ baseUrl: e.target.value })} placeholder="https://..." style={inputStyle} />

        <div style={{ height: 12 }} />
        <Label>Protocol</Label>
        <select value={settings.protocol} onChange={e => patch({ protocol: e.target.value as AIProtocol })} style={inputStyle}>
          <option value="openai-compatible">OpenAI-compatible</option>
          <option value="gemini">Gemini</option>
        </select>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={save} style={{ ...btnStyle, flex: 2, background: 'var(--primary)', color: '#fff' }}>
            保存配置
          </button>
          <button type="button" onClick={restoreProviderDefault} style={{ ...btnStyle, flex: 1, background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)' }}>
            恢复默认
          </button>
        </div>
        <button type="button" onClick={clearKey} style={{
          marginTop: 8, width: '100%', border: 'none', background: 'transparent',
          color: 'var(--danger)', fontSize: 12, fontWeight: 700, padding: 8, cursor: 'pointer',
        }}>
          清空 API Key
        </button>
        {saved && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--primary-strong)' }}>已保存到本机</div>}
      </section>

      {onNavigate && (
        <section style={cardStyle}>
          <Label>排查与日志</Label>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
            查看最近 30 次 AI 联网请求的原始返回，便于排查「未返回有效价格」等问题。
          </div>
          <button type="button"
            onClick={() => onNavigate({ kind: 'ai-logs' })}
            style={{ ...btnStyle, width: '100%', background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--border)' }}
          >
            查看 AI 请求日志
          </button>
        </section>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>{children}</div>
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 16, padding: 16, marginBottom: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 10,
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
}

const btnStyle: React.CSSProperties = {
  padding: '11px 10px', borderRadius: 10, border: 'none',
  fontSize: 14, fontWeight: 800, cursor: 'pointer',
}

const smallBtn: React.CSSProperties = {
  width: 64, borderRadius: 10, border: 'none',
  background: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
}
