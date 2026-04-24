import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChartSlot } from '../../types/models'

interface Props {
  slots: ChartSlot[]
  period: 'day' | 'week' | 'month' | 'year'
}

const BAR_W = 28
const BAR_GAP = 4
const AXIS_W = 44
const TOP_PAD = 10
const PLOT_H = 140
const LABEL_H = 34
const RIGHT_PAD = BAR_W * 2 + BAR_GAP * 4
const DOT_R = 3
const GRID_STEPS = 4
const MIN_ZOOM = 0.55
const MAX_ZOOM = 2.4

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function touchDistance(touches: TouchList): number {
  const a = touches[0]
  const b = touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function touchCenterX(touches: TouchList, element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  return (touches[0].clientX + touches[1].clientX) / 2 - rect.left
}

function showLabel(i: number, total: number, period: string): boolean {
  if (period === 'day') return i % 5 === 0 || i >= total - 4
  return true
}

function formatAxisValue(value: number): string {
  if (value >= 100_000) return `${Math.round(value / 10_000)}万`
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`
  return Math.round(value).toLocaleString('zh-CN')
}

function computeAxisMax(maxValue: number): number {
  if (maxValue <= 0) return 1
  const padded = maxValue * 1.08
  const magnitude = 10 ** Math.floor(Math.log10(padded))
  const normalized = padded / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

export default function TrendChart({ slots, period }: Props) {
  const axisCanvasRef = useRef<HTMLCanvasElement>(null)
  const plotCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<{ distance: number; zoom: number; focusX: number; centerX: number } | null>(null)
  const pendingFocusRef = useRef<{ zoom: number; focusX: number; centerX: number } | null>(null)
  const zoomRef = useRef(1)
  const [themeTick, setThemeTick] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [containerW, setContainerW] = useState(0)
  zoomRef.current = zoom

  const barW = Math.round(BAR_W * zoom)
  const barGap = Math.max(2, Math.round(BAR_GAP * zoom))
  const rightPad = Math.round(RIGHT_PAD * zoom)
  const plotW = Math.max(0, slots.length * (barW + barGap) - barGap)
  const naturalW = plotW + rightPad
  const totalW = Math.max(naturalW, containerW)
  const totalH = TOP_PAD + PLOT_H + LABEL_H

  useEffect(() => {
    const onThemeChange = () => setThemeTick(v => v + 1)
    window.addEventListener('coinsight-theme-change', onThemeChange)
    return () => window.removeEventListener('coinsight-theme-change', onThemeChange)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setContainerW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const beginPinch = (touches: TouchList) => {
      const centerX = touchCenterX(touches, el)
      pinchRef.current = {
        distance: touchDistance(touches),
        zoom: zoomRef.current,
        focusX: el.scrollLeft + centerX,
        centerX,
      }
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) beginPinch(event.touches)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinchRef.current) return
      event.preventDefault()
      const nextZoom = clamp(
        pinchRef.current.zoom * (touchDistance(event.touches) / pinchRef.current.distance),
        MIN_ZOOM,
        MAX_ZOOM,
      )
      pendingFocusRef.current = {
        zoom: pinchRef.current.zoom,
        focusX: pinchRef.current.focusX,
        centerX: touchCenterX(event.touches, el),
      }
      setZoom(nextZoom)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const centerX = event.clientX - rect.left
      pendingFocusRef.current = {
        zoom: zoomRef.current,
        focusX: el.scrollLeft + centerX,
        centerX,
      }
      setZoom(current => clamp(current * Math.exp(-event.deltaY * 0.01), MIN_ZOOM, MAX_ZOOM))
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    const pending = pendingFocusRef.current
    if (!el || !pending) return
    const scaledFocusX = pending.focusX * (zoom / pending.zoom)
    el.scrollLeft = Math.max(0, scaledFocusX - pending.centerX)
    pendingFocusRef.current = null
  }, [zoom, totalW])

  useEffect(() => {
    const axisCanvas = axisCanvasRef.current
    const plotCanvas = plotCanvasRef.current
    if (!axisCanvas || !plotCanvas) return
    const axisCtx = axisCanvas.getContext('2d')
    const plotCtx = plotCanvas.getContext('2d')
    if (!axisCtx || !plotCtx) return

    const dpr = window.devicePixelRatio || 1
    axisCanvas.width = AXIS_W * dpr
    axisCanvas.height = totalH * dpr
    axisCanvas.style.width = `${AXIS_W}px`
    axisCanvas.style.height = `${totalH}px`
    plotCanvas.width = totalW * dpr
    plotCanvas.height = totalH * dpr
    plotCanvas.style.width = `${totalW}px`
    plotCanvas.style.height = `${totalH}px`

    axisCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    plotCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    axisCtx.clearRect(0, 0, AXIS_W, totalH)
    plotCtx.clearRect(0, 0, totalW, totalH)

    const maxVal = Math.max(...slots.map(s => s.totalValueCNY), 1)
    const axisMax = computeAxisMax(maxVal)
    const green = cssVar('--primary-strong', '#1e6845')
    const empty = cssVar('--chart-empty', 'rgba(0,0,0,0.08)')
    const line = cssVar('--chart-line', 'rgba(255,255,255,0.85)')
    const dot = cssVar('--chart-dot', '#fff')
    const label = cssVar('--chart-label', 'rgba(0,0,0,0.45)')
    const grid = cssVar('--border-strong', '#ddd')
    const plotTop = TOP_PAD
    const plotBottom = plotTop + PLOT_H

    // Grid + Y axis
    axisCtx.font = '10px -apple-system, sans-serif'
    axisCtx.textAlign = 'right'
    axisCtx.textBaseline = 'middle'
    for (let step = 0; step <= GRID_STEPS; step += 1) {
      const ratio = step / GRID_STEPS
      const y = plotBottom - ratio * PLOT_H
      plotCtx.beginPath()
      plotCtx.setLineDash(step === 0 ? [] : [3, 3])
      plotCtx.moveTo(0, y)
      plotCtx.lineTo(totalW, y)
      plotCtx.strokeStyle = grid
      plotCtx.lineWidth = 1
      plotCtx.stroke()
      axisCtx.fillStyle = label
      axisCtx.fillText(formatAxisValue(axisMax * ratio), AXIS_W - 8, y)
    }
    plotCtx.setLineDash([])
    axisCtx.beginPath()
    axisCtx.moveTo(AXIS_W - 1, plotTop)
    axisCtx.lineTo(AXIS_W - 1, plotBottom)
    axisCtx.strokeStyle = grid
    axisCtx.stroke()

    // Bars
    slots.forEach((slot, i) => {
      const x = i * (barW + barGap)
      if (slot.snapshot && slot.totalValueCNY > 0) {
        const h = Math.max(8, PLOT_H * (slot.totalValueCNY / axisMax))
        plotCtx.fillStyle = green
        plotCtx.beginPath()
        plotCtx.roundRect(x, plotBottom - h, barW, h, 4)
        plotCtx.fill()
      } else {
        plotCtx.fillStyle = empty
        plotCtx.beginPath()
        plotCtx.roundRect(x, plotBottom - 4, barW, 4, 2)
        plotCtx.fill()
      }
    })

    // Trend line + dots
    const points = slots
      .map((slot, i) => {
        if (!slot.snapshot || slot.totalValueCNY <= 0) return null
        const x = i * (barW + barGap) + barW / 2
        const h = Math.max(8, PLOT_H * (slot.totalValueCNY / axisMax))
        const barTop = plotBottom - h
        const y = Math.min(plotBottom - DOT_R - 1, Math.max(plotTop + DOT_R + 1, barTop + h / 2))
        return { x, y }
      })
      .filter(Boolean) as { x: number; y: number }[]

    if (points.length > 1) {
      plotCtx.beginPath()
      plotCtx.moveTo(points[0].x, points[0].y)
      points.slice(1).forEach(p => plotCtx.lineTo(p.x, p.y))
      plotCtx.strokeStyle = line
      plotCtx.lineWidth = 1.5
      plotCtx.lineJoin = 'round'
      plotCtx.lineCap = 'round'
      plotCtx.stroke()
    }
    points.forEach(p => {
      plotCtx.beginPath()
      plotCtx.arc(p.x, p.y, DOT_R, 0, Math.PI * 2)
      plotCtx.fillStyle = dot
      plotCtx.fill()
    })

    // Date labels
    plotCtx.fillStyle = label
    plotCtx.font = '10px -apple-system, sans-serif'
    plotCtx.textAlign = 'center'
    plotCtx.textBaseline = 'top'
    slots.forEach((slot, i) => {
      if (!showLabel(i, slots.length, period)) return
      const x = i * (barW + barGap) + barW / 2
      plotCtx.fillText(slot.label, x, plotBottom + 10)
    })
  }, [slots, plotW, totalH, totalW, period, themeTick, barW, barGap])

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
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <canvas ref={axisCanvasRef} style={{ display: 'block', flex: '0 0 auto', background: 'var(--surface)' }} />
        <div ref={scrollRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', flex: 1, touchAction: 'pan-x' }}>
          <canvas ref={plotCanvasRef} style={{ display: 'block' }} />
        </div>
      </div>
      {dataSlots.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
          <span>区间变化</span>
          <span style={{ color: change >= 0 ? 'var(--primary-strong)' : 'var(--danger)', fontWeight: 600 }}>
            {change >= 0 ? '+' : ''}{change.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  )
}
