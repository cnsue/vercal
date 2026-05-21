import { type CSSProperties } from 'react'
import { useSpeechRecognition, SPEECH_RECOGNITION_SUPPORTED } from '../hooks/useSpeechRecognition'

interface Props {
  /** 拿到一段最终识别结果时调用，调用方决定如何追加到输入框 */
  onAppend: (text: string) => void
  /** 麦克风按钮被禁用的额外条件（如父组件 loading） */
  disabled?: boolean
  /** 可选自定义样式覆盖 */
  size?: 'small' | 'normal'
}

export default function VoiceInputButton({ onAppend, disabled, size = 'normal' }: Props) {
  const { supported, recording, interim, error, start, stop } = useSpeechRecognition({
    onFinal: (text) => {
      const cleaned = text.trim()
      if (cleaned) onAppend(cleaned)
    },
    lang: 'zh-CN',
  })

  // 不支持就完全不渲染，避免占用空间
  if (!SPEECH_RECOGNITION_SUPPORTED || !supported) return null

  const handleClick = () => {
    if (recording) stop()
    else start()
  }

  const dim = size === 'small' ? 28 : 32

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={recording ? '停止录音' : '语音输入（中文）'}
        aria-label={recording ? '停止录音' : '开始语音输入'}
        style={{
          width: dim, height: dim,
          borderRadius: '50%', border: 'none',
          background: recording ? 'var(--danger)' : 'var(--button-secondary-bg)',
          color: recording ? '#fff' : 'var(--text)',
          fontSize: size === 'small' ? 13 : 15, lineHeight: 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          animation: recording ? 'voice-pulse 1.2s ease-in-out infinite' : undefined,
          flexShrink: 0,
          padding: 0, fontFamily: 'inherit',
        }}
      >
        {recording ? '⏹' : '🎤'}
      </button>
      {recording && interim && (
        <div style={interimStyle}>{interim}…</div>
      )}
      {error && (
        <div style={errorStyle}>{error}</div>
      )}
      <style>{`
        @keyframes voice-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.45); }
          50% { box-shadow: 0 0 0 6px rgba(220, 53, 69, 0); }
        }
      `}</style>
    </div>
  )
}

const interimStyle: CSSProperties = {
  fontSize: 11, lineHeight: 1.4,
  padding: '4px 8px', borderRadius: 6,
  background: 'var(--surface)', color: 'var(--muted)',
  border: '1px solid var(--border)',
  maxWidth: 240,
  textAlign: 'right',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
}

const errorStyle: CSSProperties = {
  fontSize: 10, lineHeight: 1.4,
  padding: '3px 7px', borderRadius: 6,
  background: 'var(--danger-bg)', color: 'var(--danger)',
  maxWidth: 240,
  textAlign: 'right',
}
