'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { fmt, fmtPct, cardCss, inputCss, btnCss } from '@/lib/utils'

const KNOWN_COINS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink',
  XRP: 'ripple', BNB: 'binancecoin', AVAX: 'avalanche-2',
}

const RANGES = [
  { label: '5J',  range: '5d',  interval: '1h'  },
  { label: '1M',  range: '1mo', interval: '1d'  },
  { label: '3M',  range: '3mo', interval: '1d'  },
  { label: '6M',  range: '6mo', interval: '1wk' },
  { label: '1A',  range: '1y',  interval: '1wk' },
  { label: '5A',  range: '5y',  interval: '1mo' },
]

const CAT_PEA    = 'oklch(63% 0.19 250)'
const CAT_CRYPTO = 'oklch(68% 0.17 55)'

interface SimPosition {
  id: string
  type: 'pea' | 'crypto'
  ticker: string
  name?: string
  quantity: number
  costPerUnit: number
  currency: 'EUR' | 'USD'
  purchaseDate?: string
  purchaseEurUsd?: number
}

// ── Chart ─────────────────────────────────────────────────────────────────────
interface ChartData { prices: number[]; timestamps: number[]; current: number; high52: number; low52: number; longName?: string; exchange?: string; currency?: string }

function MiniChart({ ticker, color, costPerUnit }: { ticker: string; color: string; costPerUnit: number }) {
  const [data, setData]       = useState<ChartData | null>(null)
  const [loadingChart, setLoadingChart] = useState(false)
  const [range, setRange]     = useState(RANGES[4])
  const [hovIdx, setHovIdx]   = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const fetchChart = useCallback(async (r: typeof RANGES[0]) => {
    setLoadingChart(true)
    try {
      const res = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(ticker)}&range=${r.range}&interval=${r.interval}`)
      const d = await res.json()
      if (!d.error) setData({ prices: d.prices, timestamps: d.timestamps, current: d.price, high52: d.high52, low52: d.low52, longName: d.longName, exchange: d.exchange, currency: d.currency })
    } catch {}
    setLoadingChart(false)
  }, [ticker])

  useEffect(() => { fetchChart(range) }, [fetchChart, range])

  const W = 700, H = 180, padX = 8, padY = 12
  const prices = data?.prices ?? []
  const min = prices.length ? Math.min(...prices) : 0
  const max = prices.length ? Math.max(...prices) : 1
  const rng = max - min || 1
  const positive = prices.length >= 2 ? prices[prices.length - 1] >= prices[0] : true
  const lineColor = positive ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)'
  const px = (i: number) => padX + (i / Math.max(prices.length - 1, 1)) * (W - padX * 2)
  const py = (v: number) => padY + ((max - v) / rng) * (H - padY * 2)
  const path = prices.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const area = prices.length >= 2 ? `${path} L${px(prices.length-1).toFixed(1)},${H} L${px(0).toFixed(1)},${H}Z` : ''
  const change    = prices.length >= 2 ? prices[prices.length-1] - prices[0] : 0
  const changePct = prices.length >= 2 && prices[0] ? (change / prices[0]) * 100 : 0
  const pruY = costPerUnit >= min && costPerUnit <= max ? py(costPerUnit) : null
  const displayPrice = hovIdx !== null ? prices[hovIdx] : data?.current ?? 0
  const displayTs    = hovIdx !== null && data?.timestamps ? data.timestamps[hovIdx] : null

  return (
    <div style={{ ...cardCss, marginTop: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}22`, borderRadius: 6, padding: '3px 8px' }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                {ticker.replace('-EUR','').replace('.AS','').replace('.PA','').slice(0,2)}
              </div>
              <span style={{ fontWeight: 700, color, fontSize: 12 }}>{ticker}</span>
            </div>
            {data?.exchange && <span style={{ fontSize: 11, color: '#636385' }}>· {data.exchange}</span>}
          </div>
          {data?.longName && <div style={{ fontSize: 11, color: '#636385', marginTop: 4 }}>{data.longName}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2' }}>{displayPrice.toFixed(2)} <span style={{ fontSize: 11, color: '#636385' }}>{data?.currency ?? 'EUR'}</span></div>
          <div style={{ fontSize: 12, color: lineColor, fontWeight: 600 }}>{change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)</div>
          {displayTs && <div style={{ fontSize: 10, color: '#636385', marginTop: 2 }}>{new Date(displayTs * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#636385' }}>52S Haut</div><div style={{ color: '#e8e8f2', fontWeight: 600 }}>{data ? data.high52.toFixed(2) : '—'}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#636385' }}>52S Bas</div><div style={{ color: '#e8e8f2', fontWeight: 600 }}>{data ? data.low52.toFixed(2) : '—'}</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: '#636385' }}>PRU sim.</div><div style={{ color, fontWeight: 600 }}>{costPerUnit.toFixed(2)}</div></div>
        </div>
      </div>
      {loadingChart && <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#636385', fontSize: 12 }}>Chargement…</div>}
      {!loadingChart && prices.length >= 2 && (
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
          onMouseLeave={() => setHovIdx(null)}
          onMouseMove={e => {
            const rect = svgRef.current?.getBoundingClientRect()
            if (!rect) return
            const svgX = ((e.clientX - rect.left) / rect.width) * W
            setHovIdx(Math.max(0, Math.min(prices.length - 1, Math.round((svgX - padX) / (W - padX * 2) * (prices.length - 1)))))
          }}>
          <defs>
            <linearGradient id={`sim-grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#sim-grad-${ticker})`} />
          <path d={path} stroke={lineColor} strokeWidth={2} fill="none" />
          {pruY !== null && (
            <>
              <line x1={padX} y1={pruY} x2={W - padX} y2={pruY} stroke={color} strokeWidth={1} strokeDasharray="5 4" opacity={0.6} />
              <text x={W - padX - 2} y={pruY - 4} textAnchor="end" fontSize={9} fill={color} fontFamily="Inter, sans-serif" opacity={0.8}>PRU sim. {costPerUnit.toFixed(2)}</text>
            </>
          )}
          {hovIdx !== null && (
            <>
              <line x1={px(hovIdx)} y1={padY} x2={px(hovIdx)} y2={H} stroke="#636385" strokeWidth={1} strokeDasharray="4 3" />
              <circle cx={px(hovIdx)} cy={py(prices[hovIdx])} r={4} fill={lineColor} stroke="#13131b" strokeWidth={2} />
            </>
          )}
        </svg>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {RANGES.map(r => (
          <button key={r.label} onClick={() => { setRange(r); fetchChart(r) }} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600,
            background: range.label === r.label ? color : '#1c1c27',
            border: `1px solid ${range.label === r.label ? color : '#252535'}`,
            color: range.label === r.label ? '#fff' : '#636385',
          }}>{r.label}</button>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SimulationPage() {
  const [positions, setPositions] = useState<SimPosition[]>([])
  const [loading, setLoading]     = useState(true)
  const [prices, setPrices]       = useState<Record<string, number>>({})
  const [liveCurrencies, setLiveCurrencies] = useState<Record<string, string>>({})
  const [usdToEur, setUsdToEur]   = useState(0.88)
  const [gbpToEur, setGbpToEur]   = useState(1.163)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [selected, setSelected]   = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState<Partial<SimPosition>>({})
  const [fetchingRate, setFetchingRate] = useState(false)

  // Charger depuis l'API
  useEffect(() => {
    fetch('/api/simulation')
      .then(r => r.json())
      .then(data => { setPositions(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const fetchPrices = useCallback(async (ps: SimPosition[]) => {
    if (!ps.length) return
    setLoadingPrices(true)
    const newPrices: Record<string, number> = {}
    const newCurrencies: Record<string, string> = {}
    await Promise.all([
      ...ps.filter(p => p.type === 'pea').map(async p => {
        try { const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(p.ticker)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = d.currency ?? 'EUR' } } catch {}
      }),
      ...ps.filter(p => p.type === 'crypto').map(async p => {
        const id = KNOWN_COINS[p.ticker.replace('-EUR','').toUpperCase()] ?? p.ticker.toLowerCase()
        try { const r = await fetch(`/api/prices/crypto?id=${encodeURIComponent(id)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = 'EUR' } } catch {}
      }),
      (async () => {
        try { const r = await fetch('/api/prices/stock?ticker=EUR%3DX'); const d = await r.json(); if (d.price) setUsdToEur(d.price) } catch {}
      })(),
      (async () => {
        try { const r = await fetch('/api/prices/stock?ticker=GBPEUR%3DX'); const d = await r.json(); if (d.price) setGbpToEur(d.price) } catch {}
      })(),
    ])
    setPrices(newPrices); setLiveCurrencies(newCurrencies); setLoadingPrices(false)
  }, [])

  useEffect(() => { fetchPrices(positions) }, [positions, fetchPrices])

  async function fetchHistoricalRate(date: string) {
    if (!date) return
    setFetchingRate(true)
    try {
      const r = await fetch(`/api/prices/fxrate?date=${date}`)
      const d = await r.json()
      if (d.eurUsd) setEditItem(x => ({ ...x, purchaseEurUsd: d.eurUsd }))
    } catch {}
    setFetchingRate(false)
  }

  function openAdd(type: 'pea' | 'crypto') { setEditItem({ type, currency: 'EUR' }); setShowForm(true) }
  function openEdit(pos: SimPosition) { setEditItem({ ...pos }); setShowForm(true) }

  async function saveItem() {
    const body = {
      type: editItem.type ?? 'pea',
      ticker: editItem.ticker || '',
      name: editItem.name || null,
      quantity: Number(editItem.quantity) || 0,
      costPerUnit: Number(editItem.costPerUnit) || 0,
      currency: editItem.currency ?? 'EUR',
      purchaseDate: editItem.purchaseDate || null,
      purchaseEurUsd: editItem.purchaseEurUsd || null,
    }
    const simPos: SimPosition = {
      id: editItem.id ?? '',
      type: body.type,
      ticker: body.ticker,
      name: body.name ?? undefined,
      quantity: body.quantity,
      costPerUnit: body.costPerUnit,
      currency: body.currency,
      purchaseDate: body.purchaseDate ?? undefined,
      purchaseEurUsd: body.purchaseEurUsd ?? undefined,
    }
    if (editItem.id) {
      await fetch('/api/simulation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editItem.id, ...body }) })
      setPositions(ps => ps.map(p => p.id === editItem.id ? { ...simPos, id: editItem.id! } : p))
    } else {
      const r = await fetch('/api/simulation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const { id } = await r.json()
      setPositions(ps => [...ps, { ...simPos, id }])
    }
    setShowForm(false); setEditItem({})
  }

  async function deleteItem(id: string) {
    await fetch('/api/simulation', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setPositions(ps => ps.filter(p => p.id !== id)); setSelected(null)
  }

  function liveEur(p: SimPosition) {
    const raw = prices[p.ticker] ?? p.costPerUnit
    const cur = liveCurrencies[p.ticker]
    if (!cur || cur === 'EUR') return raw
    if (cur === 'GBp' || cur === 'GBX') return (raw / 100) * gbpToEur
    return raw * usdToEur
  }
  function cpuEur(p: SimPosition) {
    if (p.currency !== 'USD') return p.costPerUnit
    return p.costPerUnit * (p.purchaseEurUsd ?? usdToEur)
  }

  const peaPositions    = positions.filter(p => p.type === 'pea')
  const cryptoPositions = positions.filter(p => p.type === 'crypto')

  const totalValue = positions.reduce((s, p) => s + p.quantity * liveEur(p), 0)
  const totalCost  = positions.reduce((s, p) => s + p.quantity * cpuEur(p), 0)
  const totalPnL   = totalValue - totalCost
  const totalPct   = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  const headers = ['Ticker', 'Qté', 'PRU simulé', 'Prix live', 'Valeur (€)', 'P&L simulé (€)', '']

  function SectionTable({ ps, color, type }: { ps: SimPosition[]; color: string; type: 'pea' | 'crypto' }) {
    const val  = ps.reduce((s, p) => s + p.quantity * liveEur(p), 0)
    const cost = ps.reduce((s, p) => s + p.quantity * cpuEur(p), 0)
    const pnl  = val - cost
    return (
      <div style={cardCss}>
        <div className="invest-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>{type === 'pea' ? '📈' : '₿'}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>{type === 'pea' ? 'Actions & ETF' : 'Crypto'}</span>
            {ps.length > 0 && <span style={{ fontSize: 13, color: '#636385' }}>{fmt(val)}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {ps.length > 0 && (
              <span style={{ fontSize: 13, fontWeight: 600, color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                {pnl >= 0 ? '+' : ''}{fmt(pnl)} ({cost > 0 ? fmtPct(pnl / cost * 100) : '—'})
              </span>
            )}
            <button onClick={() => openAdd(type)} style={btnCss()}>+ Simuler</button>
          </div>
        </div>
        {ps.length > 0 ? (
          <>
            <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr>
                {headers.map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ps.map(p => {
                  const live  = liveEur(p)
                  const cpu   = cpuEur(p)
                  const val   = p.quantity * live
                  const cost  = p.quantity * cpu
                  const pnl   = val - cost
                  const pct   = cost > 0 ? (pnl / cost) * 100 : 0
                  const isSel = selected === p.id
                  return (
                    <>
                      <tr key={p.id} onClick={() => setSelected(s => s === p.id ? null : p.id)}
                        style={{ borderBottom: '1px solid #1c1c27', cursor: 'pointer' }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#1c1c27' }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}22`, borderRadius: 6, padding: '3px 8px' }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                              {p.ticker.replace('-EUR','').replace('.AS','').replace('.PA','').slice(0,2)}
                            </div>
                            <span style={{ fontWeight: 700, color, fontSize: 12 }}>{p.ticker}</span>
                          </div>
                          {p.name && <div style={{ fontSize: 10, color: '#636385', marginTop: 3, marginLeft: 2 }}>{p.name}</div>}
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: 13, color: '#e8e8f2' }}>{p.quantity}</td>
                        <td style={{ padding: '12px 10px', fontSize: 12, color: '#636385', textAlign: 'right' }}>
                          {p.currency === 'USD'
                            ? <><span style={{ color: '#e8e8f2' }}>{p.costPerUnit.toFixed(2)}</span><span style={{ fontSize: 9, color: 'oklch(68% 0.17 55)', marginLeft: 3 }}>USD</span><br /><span style={{ fontSize: 10, color: '#3a3a50' }}>≈ {fmt(cpu)}</span></>
                            : fmt(cpu)
                          }
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: 13, color: '#e8e8f2', textAlign: 'right', fontWeight: 600 }}>{fmt(live)}</td>
                        <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(val)}</td>
                        <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</div>
                          <div style={{ fontSize: 11, color: pct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{fmtPct(pct)}</div>
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={e => { e.stopPropagation(); openEdit(p) }} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px' }}>✏</button>
                            <button onClick={e => { e.stopPropagation(); deleteItem(p.id) }} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px' }}>🗑</button>
                            <span style={{ fontSize: 14, color: '#636385', width: 16 }}>{isSel ? '▲' : '▼'}</span>
                          </div>
                        </td>
                      </tr>
                      {isSel && (
                        <tr key={`${p.id}-chart`}>
                          <td colSpan={7} style={{ padding: '8px 0 8px', borderBottom: '1px solid #252535' }}>
                            <MiniChart ticker={p.ticker} color={color} costPerUnit={p.costPerUnit} />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div style={{ color: '#636385', fontSize: 13, padding: '12px 0' }}>Aucune position simulée — cliquez sur + Simuler</div>
        )}
      </div>
    )
  }

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Simulation</h1>
          <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Portefeuille fictif — aucun impact sur votre patrimoine réel</p>
        </div>
        {positions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {loadingPrices && <span style={{ fontSize: 11, color: '#636385' }}>⟳ Cours…</span>}
            <button onClick={() => fetchPrices(positions)} disabled={loadingPrices} style={{ ...btnCss(), fontSize: 11, opacity: loadingPrices ? 0.5 : 1 }}>↻ Actualiser</button>
            <span style={{ fontSize: 11, color: '#636385' }}>1 $ = {usdToEur.toFixed(4)} €</span>
          </div>
        )}
      </div>

      {/* Badge "simulation" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'oklch(68% 0.17 55 / 0.1)', border: '1px solid oklch(68% 0.17 55 / 0.3)', borderRadius: 10, alignSelf: 'flex-start' }}>
        <span style={{ fontSize: 13 }}>🧪</span>
        <span style={{ fontSize: 12, color: 'oklch(68% 0.17 55)', fontWeight: 600 }}>Mode simulation — données sauvegardées localement</span>
      </div>

      {/* KPIs */}
      {positions.length > 0 && (
        <div className="grid-3">
          {[
            { label: 'Valeur simulée',     val: fmt(totalValue), color: '#e8e8f2',                                                                         sub: null },
            { label: 'Capital simulé',     val: fmt(totalCost),  color: '#636385',                                                                         sub: null },
            { label: 'P&L simulé total',   val: fmt(totalPnL),   color: totalPnL >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', sub: (totalPct >= 0 ? '+' : '') + totalPct.toFixed(2) + '%' },
          ].map(k => (
            <div key={k.label} style={{ ...cardCss, padding: '18px 22px' }}>
              <div style={{ fontSize: 11, color: '#636385', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.val}</div>
              {k.sub && <div style={{ fontSize: 13, color: k.color, marginTop: 2 }}>{k.sub}</div>}
            </div>
          ))}
        </div>
      )}

      <SectionTable ps={peaPositions}    color={CAT_PEA}    type="pea"    />
      <SectionTable ps={cryptoPositions} color={CAT_CRYPTO} type="crypto" />

      {/* Modal */}
      {showForm && (
        <div className="modal-sheet-wrap">
          <div className="modal-sheet" style={{ ...cardCss, width: 420, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ width: 36, height: 4, background: '#252535', borderRadius: 2, margin: '0 auto 4px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f2' }}>
              {editItem.id ? 'Modifier' : 'Simuler'} — {editItem.type === 'pea' ? 'Actions & ETF' : 'Crypto'}
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Ticker</label>
              <input value={editItem.ticker ?? ''} onChange={e => setEditItem(x => ({ ...x, ticker: e.target.value.toUpperCase() }))} style={inputCss} placeholder="Ex: NVDA, BTC" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Nom (optionnel)</label>
              <input value={editItem.name ?? ''} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} style={inputCss} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Quantité simulée</label>
              <input type="number" step="any" value={editItem.quantity ?? ''} onChange={e => setEditItem(x => ({ ...x, quantity: parseFloat(e.target.value) }))} style={inputCss} />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: '#636385', fontWeight: 600 }}>PRU simulé ({editItem.currency === 'USD' ? 'USD' : '€'})</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['EUR', 'USD'] as const).map(cur => (
                    <button key={cur} type="button" onClick={() => setEditItem(x => ({ ...x, currency: cur }))}
                      style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                        background: (editItem.currency ?? 'EUR') === cur ? 'oklch(63% 0.19 250)' : '#1c1c27',
                        border: `1px solid ${(editItem.currency ?? 'EUR') === cur ? 'oklch(63% 0.19 250)' : '#252535'}`,
                        color: (editItem.currency ?? 'EUR') === cur ? '#fff' : '#636385' }}>
                      {cur}
                    </button>
                  ))}
                </div>
              </div>
              <input type="number" step="any" value={editItem.costPerUnit ?? ''} onChange={e => setEditItem(x => ({ ...x, costPerUnit: parseFloat(e.target.value) }))} style={inputCss} />
              {editItem.currency === 'USD' && (editItem.costPerUnit ?? 0) > 0 && (() => {
                const rate = editItem.purchaseEurUsd ?? usdToEur
                return <div style={{ fontSize: 11, color: '#636385', marginTop: 5 }}>≈ {fmt((editItem.costPerUnit ?? 0) * rate)} au taux 1 USD = {rate.toFixed(4)} €{editItem.purchaseEurUsd ? <span style={{ color: 'oklch(65% 0.18 148)', marginLeft: 6 }}>taux historique</span> : null}</div>
              })()}
            </div>
            {editItem.currency === 'USD' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: '#636385', fontWeight: 600 }}>Date d&apos;achat simulée</label>
                  {editItem.purchaseEurUsd && <span style={{ fontSize: 11, color: 'oklch(65% 0.18 148)' }}>1 USD = {editItem.purchaseEurUsd.toFixed(4)} €</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" value={editItem.purchaseDate ?? ''} onChange={e => setEditItem(x => ({ ...x, purchaseDate: e.target.value, purchaseEurUsd: undefined }))} style={{ ...inputCss, flex: 1 }} />
                  <button type="button" disabled={!editItem.purchaseDate || fetchingRate} onClick={() => fetchHistoricalRate(editItem.purchaseDate!)}
                    style={{ padding: '0 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                      background: 'oklch(63% 0.19 250 / 0.15)', border: '1px solid oklch(63% 0.19 250 / 0.4)', color: 'oklch(63% 0.19 250)',
                      opacity: !editItem.purchaseDate || fetchingRate ? 0.5 : 1 }}>
                    {fetchingRate ? '…' : 'Taux historique'}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => { setShowForm(false); setEditItem({}) }} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', border: '1px solid #252535', color: '#636385', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, fontWeight: 600 }}>Annuler</button>
              <button onClick={saveItem} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'oklch(63% 0.19 250)', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, fontWeight: 700 }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
