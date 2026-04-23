import { useEffect, useRef, useState } from 'react'
import { formatCNY } from '../../utils/formatters'

export interface BreakdownItem {
  name: string
  value: number
  weight: number
}

const COLORS = [
  '#1e6845', '#2d9b6a', '#e67e22', '#2980b9', '#8e44ad',
  '#c0392b', '#16a085', '#d35400', '#2c3e50', '#f39c12',
]

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

interface Props {
  items: BreakdownItem[]
  title: string
}

export default function DonutChart({ items, title }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [themeTick, setThemeTick] = useState(0)
  const SIZE = 160
  const STROKE = 26

  useEffect(() => {
    const onThemeChange = () => setThemeTick(v => v + 1)
    window.addEventListener('coinsight-theme-change', onThemeChange)
    return () => window.removeEventListener('coinsight-theme-change', onThemeChange)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || items.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    canvas.style.width = `${SIZE}px`
    canvas.style.height = `${SIZE}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, SIZE, SIZE)

    const cx = SIZE / 2, cy = SIZE / 2
    const r = SIZE / 2 - STROKE / 2 - 4
    const total = items.reduce((s, i) => s + Math.max(i.value, 0), 0) || 1
    let angle = -Math.PI / 2

    items.forEach((item, idx) => {
      const sweep = (Math.max(item.value, 0) / total) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(cx, cy, r, angle, angle + sweep)
      ctx.strokeStyle = COLORS[idx % COLORS.length]
      ctx.lineWidth = STROKE
      ctx.lineCap = 'butt'
      ctx.stroke()
      angle += sweep
    })

    // Center text
    ctx.fillStyle = cssVar('--muted', '#888')
    ctx.font = `11px -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('合计', cx, cy - 6)
    ctx.fillStyle = cssVar('--text-strong', '#222')
    ctx.font = `bold 12px -apple-system, sans-serif`
    ctx.fillText(formatCNY(total), cx, cy + 10)
  }, [items, themeTick])

  if (items.length === 0) return null

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <canvas ref={canvasRef} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{title}</div>
          {items.slice(0, 5).map((item, i) => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              <div style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <span style={{ color: 'var(--muted)', marginLeft: 4 }}>{item.weight.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {items.map((item, i) => (
          <div key={item.name} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span>{item.name}</span>
              <span style={{ color: 'var(--muted)' }}>{formatCNY(item.value)} · {item.weight.toFixed(1)}%</span>
            </div>
            <div style={{ height: 4, background: 'var(--progress-bg)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${item.weight}%`, background: COLORS[i % COLORS.length], borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { COLORS }
