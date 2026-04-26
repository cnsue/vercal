import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { ChartSlot } from '../../types/models'
import { COLORS } from './DonutChart'
import { formatCNY } from '../../utils/formatters'

export interface TrendSeries {
  name: string
  values: number[]
  color?: string
}

interface Props {
  slots: ChartSlot[]
  period: 'day' | 'week' | 'month' | 'year'
  series?: TrendSeries[]
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

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
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

export default function TrendChart({ slots, period, series = [] }: Props) {
  const axisCanvasRef = useRef<HTMLCanvasElement>(null)
  const plotCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [themeTick, setThemeTick] = useState(0)
  const [containerW, setContainerW] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const naturalPlotW = Math.max(0, slots.length * (BAR_W + BAR_GAP) - BAR_GAP)
  const naturalTotalW = naturalPlotW + RIGHT_PAD
  const shouldStretch = slots.length > 0 && containerW > 0 && naturalTotalW < containerW

  const step = shouldStretch ? containerW / slots.length : BAR_W + BAR_GAP
  const barW = shouldStretch ? Math.min(Math.round(step * 0.6), BAR_W * 2) : BAR_W
  const rightPad = shouldStretch ? 0 : RIGHT_PAD
  const plotW = shouldStretch ? slots.length * step : naturalPlotW
  const totalW = plotW + rightPad
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

    const seriesTotals = slots.map((slot, i) => (
      series.length > 0
        ? series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0)
        : slot.totalValueCNY
    ))
    const maxVal = Math.max(...seriesTotals, 1)
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
    for (let gridStep = 0; gridStep <= GRID_STEPS; gridStep += 1) {
      const ratio = gridStep / GRID_STEPS
      const y = plotBottom - ratio * PLOT_H
      plotCtx.beginPath()
      plotCtx.setLineDash(gridStep === 0 ? [] : [3, 3])
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
      const x = i * step + (step - barW) / 2
      const slotTotal = seriesTotals[i] ?? 0
      if (slot.snapshot && slotTotal > 0) {
        const h = Math.max(8, PLOT_H * (slotTotal / axisMax))
        if (series.length > 0) {
          plotCtx.save()
          plotCtx.beginPath()
          plotCtx.roundRect(x, plotBottom - h, barW, h, 4)
          plotCtx.clip()
          let y = plotBottom
          series.forEach((s, seriesIdx) => {
            const value = Math.max(0, s.values[i] ?? 0)
            if (value <= 0) return
            const segmentH = Math.max(1, h * (value / slotTotal))
            y -= segmentH
            plotCtx.fillStyle = s.color ?? COLORS[seriesIdx % COLORS.length]
            plotCtx.beginPath()
            plotCtx.rect(x, y, barW, segmentH)
            plotCtx.fill()
          })
          plotCtx.restore()
        } else {
          plotCtx.fillStyle = green
          plotCtx.beginPath()
          plotCtx.roundRect(x, plotBottom - h, barW, h, 4)
          plotCtx.fill()
        }
      } else {
        plotCtx.fillStyle = empty
        plotCtx.beginPath()
        plotCtx.roundRect(x, plotBottom - 4, barW, 4, 2)
        plotCtx.fill()
      }
      if (i === selectedIndex) {
        plotCtx.strokeStyle = dot
        plotCtx.lineWidth = 2
        plotCtx.beginPath()
        plotCtx.roundRect(x - 2, plotTop + 2, barW + 4, PLOT_H - 4, 6)
        plotCtx.stroke()
      }
    })

    // Trend line + dots
    const points = slots
      .map((slot, i) => {
        const slotTotal = seriesTotals[i] ?? 0
        if (!slot.snapshot || slotTotal <= 0) return null
        const x = i * step + step / 2
        const h = Math.max(8, PLOT_H * (slotTotal / axisMax))
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
      const x = i * step + step / 2
      plotCtx.fillText(slot.label, x, plotBottom + 10)
    })
  }, [slots, series, plotW, totalH, totalW, period, themeTick, barW, step, selectedIndex])

  // Scroll to end on mount / period change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [slots])

  const slotValue = (slot: ChartSlot, index: number) => (
    series.length > 0
      ? series.reduce((sum, s) => sum + Math.max(0, s.values[index] ?? 0), 0)
      : slot.totalValueCNY
  )
  const dataSlots = slots
    .map((slot, index) => ({ slot, index, value: slotValue(slot, index) }))
    .filter(s => s.slot.snapshot && s.value > 0)

  useEffect(() => {
    const latestDataSlot = [...slots]
      .map((slot, index) => ({ slot, index, value: slotValue(slot, index) }))
      .filter(s => s.slot.snapshot && s.value > 0)
      .at(-1)
    setSelectedIndex(latestDataSlot?.index ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, series])

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
  const change = last.value - first.value
  const selected = dataSlots.find(s => s.index === selectedIndex) ?? last
  const previous = [...dataSlots].reverse().find(s => s.index < selected.index)
  const selectedChange = previous ? selected.value - previous.value : 0
  const selectedChangePct = previous && previous.value > 0 ? (selectedChange / previous.value) * 100 : 0
  const selectedSeries = series
    .map((s, i) => ({
      name: s.name,
      color: s.color ?? COLORS[i % COLORS.length],
      value: Math.max(0, s.values[selected.index] ?? 0),
    }))
    .filter(s => s.value > 0)

  function handlePlotClick(e: MouseEvent<HTMLCanvasElement>) {
    if (slots.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const index = Math.min(slots.length - 1, Math.max(0, Math.floor(x / step)))
    if (slots[index]?.snapshot && slotValue(slots[index], index) > 0) {
      setSelectedIndex(index)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', minWidth: 0 }}>
        <canvas ref={axisCanvasRef} style={{ display: 'block', flex: '0 0 auto', background: 'var(--surface)' }} />
        <div ref={scrollRef} style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          flex: '1 1 0',
          minWidth: 0,
          maxWidth: '100%',
          touchAction: 'pan-x',
        }}>
          <canvas
            ref={plotCanvasRef}
            onClick={handlePlotClick}
            style={{ display: 'block', cursor: 'pointer' }}
          />
        </div>
      </div>
      <div style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'var(--surface-muted)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{selected.slot.label}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>{formatCNY(selected.value)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>{previous ? '较上一记录' : '暂无上一记录'}</span>
          <span style={{ color: selectedChange >= 0 ? 'var(--primary-strong)' : 'var(--danger)', fontWeight: 700 }}>
            {previous
              ? `${selectedChange >= 0 ? '+' : ''}${formatCNY(selectedChange)} · ${selectedChangePct >= 0 ? '+' : ''}${selectedChangePct.toFixed(2)}%`
              : '--'}
          </span>
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
      {series.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px' }}>
            {series.map((s, i) => (
            <div key={s.name} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: 'var(--muted)',
              minWidth: 0,
              maxWidth: '45%',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color ?? COLORS[i % COLORS.length], flex: '0 0 auto' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            </div>
            ))}
          </div>
          {selectedSeries.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {selectedSeries.slice(0, 4).map(s => (
                <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11, marginTop: 5 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flex: '0 0 auto' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </span>
                  <span style={{ color: 'var(--muted)', flex: '0 0 auto' }}>{formatCNY(s.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
