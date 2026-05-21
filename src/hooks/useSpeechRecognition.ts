import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Web Speech API 类型在不同浏览器里命名不一致（Chrome 是 webkitSpeechRecognition、
 * 标准是 SpeechRecognition），且 lib.dom.d.ts 默认不带这些类型——这里做最小化声明。
 */
type RecognitionAlternative = { transcript: string; confidence?: number }
type RecognitionResult = {
  isFinal: boolean
  0: RecognitionAlternative
  length: number
}
type RecognitionResultList = { length: number; [index: number]: RecognitionResult }
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: RecognitionResultList
}
interface SpeechRecognitionErrorEventLike {
  error: string
  message?: string
}
interface RecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => RecognitionInstance

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const SPEECH_RECOGNITION_SUPPORTED = getRecognitionCtor() !== null

export interface UseSpeechRecognitionOptions {
  /** 每次拿到一段「最终」识别结果时回调，传调用方往输入框追加 */
  onFinal: (text: string) => void
  /** 录制过程中拿到中间识别结果时回调，可在 UI 显示"正在听" */
  onInterim?: (text: string) => void
  /** 默认 zh-CN；多语言场景可传 'en-US' 等 */
  lang?: string
}

export interface UseSpeechRecognitionResult {
  supported: boolean
  recording: boolean
  interim: string
  error: string
  start: () => void
  stop: () => void
}

export function useSpeechRecognition(opts: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const { onFinal, onInterim, lang = 'zh-CN' } = opts
  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  // 用 ref 持有最新的回调，避免回调更新导致 recognition 重建
  const onFinalRef = useRef(onFinal)
  const onInterimRef = useRef(onInterim)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])
  useEffect(() => { onInterimRef.current = onInterim }, [onInterim])

  const supported = SPEECH_RECOGNITION_SUPPORTED

  const start = useCallback(() => {
    if (!supported) {
      setError('当前浏览器不支持语音识别。可换 Chrome / Edge / iOS Safari 试试')
      return
    }
    if (recognitionRef.current) return // already running
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = lang
    r.continuous = true
    r.interimResults = true
    r.onstart = () => {
      setRecording(true)
      setError('')
    }
    r.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i]
        const txt = res[0]?.transcript ?? ''
        if (res.isFinal) finalTranscript += txt
        else interimTranscript += txt
      }
      if (finalTranscript) {
        onFinalRef.current(finalTranscript)
      }
      setInterim(interimTranscript)
      if (onInterimRef.current) onInterimRef.current(interimTranscript)
    }
    r.onerror = (event) => {
      // 常见错误：no-speech / aborted / not-allowed / audio-capture / network
      if (event.error === 'aborted') {
        // 用户主动停止，不显示错误
        return
      }
      const map: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝。请在浏览器设置里允许本站使用麦克风',
        'service-not-allowed': '浏览器禁用了语音服务',
        'no-speech': '没听到声音，请确认麦克风工作正常',
        'audio-capture': '无法访问麦克风（可能被其他程序占用）',
        'network': '网络异常，语音识别需要联网',
      }
      setError(map[event.error] ?? `识别错误：${event.error}`)
    }
    r.onend = () => {
      setRecording(false)
      setInterim('')
      recognitionRef.current = null
    }
    try {
      r.start()
      recognitionRef.current = r
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      recognitionRef.current = null
    }
  }, [supported, lang])

  const stop = useCallback(() => {
    const r = recognitionRef.current
    if (!r) return
    try {
      r.stop()
    } catch {
      // ignore
    }
  }, [])

  // 卸载时清理
  useEffect(() => () => {
    const r = recognitionRef.current
    if (r) {
      try { r.abort() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  return { supported, recording, interim, error, start, stop }
}
