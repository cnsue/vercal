import { useEffect, useRef } from 'react'
import type { ChartSlot } from '../../types/models'

interface Props {
  slots: ChartSlot[]
  period: 'day' | 'week' | 'month' | 'year'
}

const BAR_W = 28
const BAR_GAP = 4
const CHART_H = 140
const LABEL_H = 34
const DOT_R = 3
const GREEN = '#1e6845'

function showLabel(i: number, total: number, period: string): boolean {
  if (period === 'day') return i % 5 === 0 || i === total - 1
  return true
}

export default function TrendChart({ slots, period }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const totalW = slots.length * (BAR_W + BAR_GAP) - BAR_GAP

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = totalW * dpr
    canvas.height = (CHART_H + LABEL_H) * dpr
    canvas.style.width = `${totalW}px`
    canvas.style.height = `${CHART_H + LABEL_H}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, totalW, CHART_H + LABEL_H)

    const maxVal = Math.max(...slots.map(s => s.totalValueCNY), 1)

    // Bars
    slots.forEach((slot, i) => {
      const x = i * (BAR_W + BAR_GAP)
      if (slot.snapshot && slot.totalValueCNY > 0) {
        const h = Math.max(8, CHART_H * (slot.totalValueCNY / maxVal))
        ctx.fillStyle = GREEN
        ctx.beginPath()
        ctx.roundRect(x, CHART_H - h, BAR_W, h, 4)
        ctx.fill()
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.08)'
        ctx.beginPath()
        ctx.roundRect(x, CHART_H - 4, BAR_W, 4, 2)
        ctx.fill()
      }
    })

    // Trend line + dots
    const points = slots
      .map((slot, i) => {
        if (!slot.snapshot || slot.totalValueCNY <= 0) return null
        const x = i * (BAR_W + BAR_GAP) + BAR_W / 2
        const h = Math.max(8, CHART_H * (slot.totalValueCNY / maxVal))
        return { x, y: CHART_H - h }
      })
      .filter(Boolean) as { x: number; y: number }[]

    if (points.length > 1) {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 1.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      points.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, DOT_R, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'
        ctx.fill()
      })
    }

    // Date labels
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = `${10 * dpr / dpr}px -apple-system, sans-serif`
    ctx.textAlign = 'center'
    slots.forEach((slot, i) => {
      if (!showLabel(i, slots.length, period)) return
      const x = i * (BAR_W + BAR_GAP) + BAR_W / 2
      ctx.fillText(slot.label, x, CHART_H + 14)
    })
  }, [slots, totalW, period])

  // Scroll to end on mount / period change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [slots])

  const dataSlots = slots.filter(s => s.snapshot && s.totalValueCNY > 0)
  if (dataSlots.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
        <div style={{ fontSize: 14 }}>暂无趋势数据</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>保存两次以上快照后会显示</div>
      </div>
    )
  }

  const first = dataSlots[0]
  const last = dataSlots[dataSlots.length - 1]
  const change = last.totalValueCNY - first.totalValueCNY

  return (
    <div>
      <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
      {dataSlots.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
          <span>区间变化</span>
          <span style={{ color: change >= 0 ? '#1e6845' : '#c0392b', fontWeight: 600 }}>
            {change >= 0 ? '+' : ''}{change.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  )
}
