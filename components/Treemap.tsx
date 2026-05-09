'use client'
import { useState, useMemo } from 'react'

export interface TreemapItem { label: string; value: number; color: string; sub?: string }
interface Rect { x: number; y: number; w: number; h: number; item: TreemapItem }

function squarify(items: TreemapItem[], x: number, y: number, w: number, h: number): Rect[] {
  if (items.length === 0) return []
  const total = items.reduce((s, i) => s + i.value, 0)
  if (total === 0) return []

  const sorted = [...items].sort((a, b) => b.value - a.value)
  const rects: Rect[] = []
  let rx = x, ry = y, rw = w, rh = h

  const remaining = [...sorted]
  while (remaining.length > 0) {
    const totalRemaining = remaining.reduce((s, i) => s + i.value, 0)
    const isWide = rw >= rh

    let row: TreemapItem[] = []
    let bestRatio = Infinity

    for (let k = 1; k <= remaining.length; k++) {
      const candidate = remaining.slice(0, k)
      const rowTotal = candidate.reduce((s, i) => s + i.value, 0)
      const rowFrac = rowTotal / totalRemaining
      const rowLen = isWide ? rw * rowFrac : rh * rowFrac
      const rowSize = isWide ? rh : rw

      let worst = 0
      for (const item of candidate) {
        const tileLen = (item.value / rowTotal) * rowSize
        const ratio = Math.max(rowLen / tileLen, tileLen / rowLen)
        if (ratio > worst) worst = ratio
      }
      if (worst < bestRatio) { bestRatio = worst; row = candidate }
      else break
    }

    const rowTotal = row.reduce((s, i) => s + i.value, 0)
    const rowFrac = rowTotal / totalRemaining
    const rowLen = isWide ? rw * rowFrac : rh * rowFrac
    const rowSize = isWide ? rh : rw

    let off = 0
    for (const item of row) {
      const tileSize = (item.value / rowTotal) * rowSize
      if (isWide) rects.push({ x: rx, y: ry + off, w: rowLen, h: tileSize, item })
      else         rects.push({ x: rx + off, y: ry, w: tileSize, h: rowLen, item })
      off += tileSize
    }

    remaining.splice(0, row.length)
    if (isWide) { rx += rowLen; rw -= rowLen }
    else         { ry += rowLen; rh -= rowLen }
  }

  return rects
}

export function Treemap({ items, height = 300 }: { items: TreemapItem[]; height?: number }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const visible = items.filter(i => i.value > 0)
  const PAD = 4

  // Use a fixed logical width and let SVG scale
  const W = 700

  const rects = useMemo(() => squarify(visible, 0, 0, W, height), [visible, height, W])

  if (rects.length === 0) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#636385', fontSize: 13 }}>
      Aucune donnée
    </div>
  )

  const total = visible.reduce((s, i) => s + i.value, 0)

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height, display: 'block' }}>
      {rects.map((r, i) => {
        const isHov = hovered === r.item.label
        const iw = Math.max(r.w - PAD * 2, 0)
        const ih = Math.max(r.h - PAD * 2, 0)
        const cx = r.x + r.w / 2
        const cy = r.y + r.h / 2
        const pct = total > 0 ? ((r.item.value / total) * 100).toFixed(1) : '0'
        const showValue = iw > 70 && ih > 40
        const showSub   = iw > 80 && ih > 65

        return (
          <g key={i}
            onMouseEnter={() => setHovered(r.item.label)}
            onMouseLeave={() => setHovered(null)}>
            <rect
              x={r.x + PAD} y={r.y + PAD} width={iw} height={ih}
              rx={12}
              fill={r.item.color}
              fillOpacity={isHov ? 1 : 0.88}
              style={{ transition: 'fill-opacity 0.15s' }}
            />
            {showValue && (
              <>
                <text x={cx} y={cy - (showSub ? 10 : 0)}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(20, iw / 5)}
                  fontWeight={700} fill="#fff" fontFamily="Inter, sans-serif">
                  {r.item.value.toLocaleString('fr-FR')} €
                </text>
                {showSub && (
                  <text x={cx} y={cy + 16}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={Math.min(13, iw / 8)}
                    fill="rgba(255,255,255,0.75)" fontFamily="Inter, sans-serif">
                    {r.item.sub ?? r.item.label} • {pct}%
                  </text>
                )}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function TreemapLegend({ items }: { items: TreemapItem[] }) {
  const total = items.filter(i => i.value > 0).reduce((s, i) => s + i.value, 0)
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {items.filter(i => i.value > 0).map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#636385' }}>
            {item.label} <span style={{ color: '#e8e8f2', fontWeight: 700 }}>{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}
