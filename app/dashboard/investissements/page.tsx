'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, fmtPct, cardCss } from '@/lib/utils'

const KNOWN_COINS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink',
  XRP: 'ripple', BNB: 'binancecoin', AVAX: 'avalanche-2',
}

const CAT_COLOR_PEA    = 'oklch(63% 0.19 250)'
const CAT_COLOR_CRYPTO = 'oklch(68% 0.17 55)'

const RANGES = [
  { label: '5J',  range: '5d',  interval: '1h'  },
  { label: '1M',  range: '1mo', interval: '1d'  },
  { label: '3M',  range: '3mo', interval: '1d'  },
  { label: '6M',  range: '6mo', interval: '1wk' },
  { label: '1A',  range: '1y',  interval: '1wk' },
  { label: '5A',  range: '5y',  interval: '1mo' },
]

function formatElapsed(sec: number) {
  return `${Math.floor(sec / 60).toString().padStart(2,'0')}:${(sec % 60).toString().padStart(2,'0')}`
}

function TickerBadge({ ticker, color }: { ticker: string; color: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}22`, borderRadius: 6, padding: '3px 8px' }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {ticker.replace('-EUR','').replace('.AS','').replace('.PA','').slice(0,2)}
      </div>
      <span style={{ fontWeight: 700, color, fontSize: 12 }}>{ticker}</span>
    </div>
  )
}

// ── Mini chart inline ─────────────────────────────────────────────────────────
interface ChartData { prices: number[]; timestamps: number[]; current: number; high52: number; low52: number; longName?: string; exchange?: string; currency?: string }

function MiniChart({ ticker, color, costPerUnit }: { ticker: string; color: string; costPerUnit: number }) {
  const [data, setData]       = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [range, setRange]     = useState(RANGES[4])
  const [hovIdx, setHovIdx]   = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const fetchChart = useCallback(async (r: typeof RANGES[0]) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(ticker)}&range=${r.range}&interval=${r.interval}`)
      const d = await res.json()
      if (!d.error) setData({ prices: d.prices, timestamps: d.timestamps, current: d.price, high52: d.high52, low52: d.low52, longName: d.longName, exchange: d.exchange, currency: d.currency })
    } catch {}
    setLoading(false)
  }, [ticker])

  useEffect(() => { fetchChart(range) }, [fetchChart, range])

  function changeRange(r: typeof RANGES[0]) { setRange(r); fetchChart(r) }

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

  // PRU line position
  const pruY = costPerUnit >= min && costPerUnit <= max ? py(costPerUnit) : null

  const displayPrice = hovIdx !== null ? prices[hovIdx] : data?.current ?? 0
  const displayTs    = hovIdx !== null && data?.timestamps ? data.timestamps[hovIdx] : null

  return (
    <div style={{ ...cardCss, marginTop: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TickerBadge ticker={ticker} color={color} />
            {data?.exchange && <span style={{ fontSize: 11, color: '#636385' }}>· {data.exchange}</span>}
          </div>
          {data?.longName && <div style={{ fontSize: 11, color: '#636385', marginTop: 4 }}>{data.longName}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e8e8f2' }}>
            {displayPrice.toFixed(2)} <span style={{ fontSize: 12, color: '#636385', fontWeight: 400 }}>{data?.currency ?? 'EUR'}</span>
          </div>
          <div style={{ fontSize: 13, color: lineColor, fontWeight: 600 }}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            <span style={{ fontSize: 11, color: '#636385', fontWeight: 400 }}> sur la période</span>
          </div>
          {displayTs && hovIdx !== null && (
            <div style={{ fontSize: 10, color: '#636385', marginTop: 2 }}>
              {new Date(displayTs * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#636385' }}>52S Haut</div>
            <div style={{ color: '#e8e8f2', fontWeight: 600 }}>{data ? data.high52.toFixed(2) : '—'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#636385' }}>52S Bas</div>
            <div style={{ color: '#e8e8f2', fontWeight: 600 }}>{data ? data.low52.toFixed(2) : '—'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#636385' }}>PRU</div>
            <div style={{ color: color, fontWeight: 600 }}>{costPerUnit.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {loading && <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#636385', fontSize: 12 }}>Chargement…</div>}
      {!loading && prices.length >= 2 && (
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
          onMouseLeave={() => setHovIdx(null)}
          onMouseMove={e => {
            const rect = svgRef.current?.getBoundingClientRect()
            if (!rect) return
            const svgX = ((e.clientX - rect.left) / rect.width) * W
            const idx = Math.round((svgX - padX) / (W - padX * 2) * (prices.length - 1))
            setHovIdx(Math.max(0, Math.min(prices.length - 1, idx)))
          }}>
          <defs>
            <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#grad-${ticker})`} />
          <path d={path} stroke={lineColor} strokeWidth={2} fill="none" />
          {/* PRU dashed line */}
          {pruY !== null && (
            <>
              <line x1={padX} y1={pruY} x2={W - padX} y2={pruY} stroke={color} strokeWidth={1} strokeDasharray="5 4" opacity={0.6} />
              <text x={W - padX - 2} y={pruY - 4} textAnchor="end" fontSize={9} fill={color} fontFamily="Inter, sans-serif" opacity={0.8}>PRU {costPerUnit.toFixed(2)}</text>
            </>
          )}
          {/* Hover crosshair */}
          {hovIdx !== null && (
            <>
              <line x1={px(hovIdx)} y1={padY} x2={px(hovIdx)} y2={H} stroke="#636385" strokeWidth={1} strokeDasharray="4 3" />
              <circle cx={px(hovIdx)} cy={py(prices[hovIdx])} r={4} fill={lineColor} stroke="#13131b" strokeWidth={2} />
            </>
          )}
        </svg>
      )}

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {RANGES.map(r => (
          <button key={r.label} onClick={() => changeRange(r)} style={{
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

// ── Position row ──────────────────────────────────────────────────────────────
function PositionRow({ p, liveRaw, liveCurrency, usdToEur, color, selected, onSelect }: {
  p: { id: string; ticker: string; quantity: number; costPerUnit: number; name?: string; currency?: 'EUR' | 'USD'; purchaseEurUsd?: number }
  liveRaw: number; liveCurrency: string; usdToEur: number; color: string; selected: boolean; onSelect: () => void
}) {
  // Conversion prix live selon la devise retournée par Yahoo (usdToEur = EUR=X = EUR pour 1 USD)
  const liveEur = liveCurrency === 'EUR' ? liveRaw
    : liveCurrency === 'GBp' || liveCurrency === 'GBX' ? liveRaw * usdToEur / 100 * 1.17
    : liveRaw * usdToEur // USD × (EUR/USD) = EUR
  // PRU : taux historique si disponible, sinon taux actuel
  const purchaseRate = p.currency === 'USD' ? (p.purchaseEurUsd ?? usdToEur) : 1
  const cpuEur = p.currency === 'USD' ? p.costPerUnit * purchaseRate : p.costPerUnit

  const value = p.quantity * liveEur
  const cost  = p.quantity * cpuEur
  const pnl   = value - cost
  const pct   = cost > 0 ? (pnl / cost) * 100 : 0
  return (
    <tr
      onClick={onSelect}
      style={{ borderBottom: '1px solid #1c1c27', cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#1c1c27' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <td style={{ padding: '12px 10px' }}>
        <div>
          <TickerBadge ticker={p.ticker} color={color} />
          {p.name && <div style={{ fontSize: 10, color: '#636385', marginTop: 3, marginLeft: 2 }}>{p.name}</div>}
        </div>
      </td>
      <td style={{ padding: '12px 10px', fontSize: 13, color: '#e8e8f2' }}>{p.quantity}</td>
      <td style={{ padding: '12px 10px', fontSize: 12, color: '#636385', textAlign: 'right' }}>
        {p.currency === 'USD'
          ? <><span style={{ color: '#e8e8f2' }}>{p.costPerUnit.toFixed(2)}</span><span style={{ fontSize: 9, color: 'oklch(68% 0.17 55)', marginLeft: 3 }}>USD</span><br /><span style={{ fontSize: 10, color: '#3a3a50' }}>≈ {fmt(cpuEur)}</span></>
          : fmt(cpuEur)
        }
      </td>
      <td style={{ padding: '12px 10px', fontSize: 13, color: '#e8e8f2', textAlign: 'right', fontWeight: 600 }}>{fmt(liveEur)}</td>
      <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(value)}</td>
      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</div>
        <div style={{ fontSize: 11, color: pct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{fmtPct(pct)}</div>
      </td>
      <td style={{ padding: '12px 10px', textAlign: 'right', fontSize: 14, color: '#636385' }}>{selected ? '▲' : '▼'}</td>
    </tr>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvestissementsPage() {
  const { portfolio, loading } = useAppData()
  const [prices, setPrices]         = useState<Record<string, number>>({})
  const [liveCurrencies, setLiveCurrencies] = useState<Record<string, string>>({})
  const [loadingPrices, setLoading] = useState(false)
  const [paused, setPaused]         = useState(false)
  const [elapsed, setElapsed]       = useState(0)
  const [usdToEur, setUsdToEur]     = useState<number>(0.88) // EUR=X Yahoo = combien d'EUR pour 1 USD
  const [selected, setSelected]     = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    if (loading) return
    setLoading(true); setElapsed(0)
    const newPrices: Record<string, number> = {}
    const newCurrencies: Record<string, string> = {}
    await Promise.all([
      ...portfolio.pea.positions.map(async p => {
        try { const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(p.ticker)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = d.currency ?? 'USD' } } catch {}
      }),
      ...portfolio.crypto.positions.map(async p => {
        try { const id = KNOWN_COINS[p.ticker.replace('-EUR','').toUpperCase()] ?? p.ticker.toLowerCase(); const r = await fetch(`/api/prices/crypto?id=${encodeURIComponent(id)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = 'EUR' } } catch {}
      }),
      (async () => {
        try { const r = await fetch('/api/prices/stock?ticker=EUR%3DX'); const d = await r.json(); if (d.price) setUsdToEur(d.price) } catch {}
      })(),
    ])
    setPrices(newPrices); setLiveCurrencies(newCurrencies); setLoading(false)
  }, [loading, portfolio.pea.positions, portfolio.crypto.positions])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { if (paused) return; const t = setInterval(() => fetchAll(), 60_000); return () => clearInterval(t) }, [paused, fetchAll])
  useEffect(() => { if (loadingPrices) return; const t = setInterval(() => setElapsed(e => e + 1), 1000); return () => clearInterval(t) }, [loadingPrices])

  const peaPositions    = portfolio.pea.positions
  const cryptoPositions = portfolio.crypto.positions
  function liveEur(p: typeof peaPositions[0]) {
    const raw = prices[p.ticker] ?? (p as { price?: number }).price ?? p.costPerUnit
    const cur = liveCurrencies[p.ticker] ?? 'USD'
    if (cur === 'EUR') return raw
    if (cur === 'GBp' || cur === 'GBX') return raw * usdToEur / 100 * 1.17
    return raw * usdToEur // USD × (EUR/USD) = EUR
  }
  function cpuEur(p: typeof peaPositions[0]) {
    if ((p as { currency?: string }).currency !== 'USD') return p.costPerUnit
    const purchaseRate = (p as { purchaseEurUsd?: number }).purchaseEurUsd ?? usdToEur
    return p.costPerUnit * purchaseRate // USD × (EUR/USD) = EUR
  }

  const peaValue    = peaPositions.reduce((s, p) => s + p.quantity * liveEur(p), 0)
  const peaCost     = peaPositions.reduce((s, p) => s + p.quantity * cpuEur(p), 0)
  const cryptoValue = cryptoPositions.reduce((s, p) => s + p.quantity * liveEur(p), 0)
  const cryptoCost  = cryptoPositions.reduce((s, p) => s + p.quantity * cpuEur(p), 0)
  const totalValue  = peaValue + cryptoValue
  const totalCost   = peaCost + cryptoCost
  const totalPnL    = totalValue - totalCost
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  const headers = ['Ticker', 'Qté', 'PRU', 'Prix live', 'Valeur (€)', 'P&L (€)', '']

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Investissements</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Portefeuilles en temps réel</p>
      </div>

      {/* Live bar */}
      <div style={{ ...cardCss, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: loadingPrices ? 'oklch(68% 0.17 55)' : 'oklch(65% 0.18 148)', boxShadow: loadingPrices ? 'none' : '0 0 6px oklch(65% 0.18 148)', transition: 'background 0.3s' }} />
          <span style={{ fontSize: 12, color: '#e8e8f2', fontWeight: 600 }}>Crypto live (CoinGecko)</span>
        </div>
        <span style={{ fontSize: 12, color: '#636385' }}>
          1 $ = <span style={{ color: '#e8e8f2', fontWeight: 600 }}>{usdToEur.toFixed(4)} €</span>
          <span style={{ fontSize: 11 }}> • 1 € = {(1 / usdToEur).toFixed(4)} $</span>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {loadingPrices
            ? <span style={{ fontSize: 11, color: '#636385' }}>Mise à jour…</span>
            : <span style={{ fontSize: 11, color: '#636385' }}>MàJ : {formatElapsed(elapsed)}</span>
          }
          <button onClick={() => setPaused(p => !p)} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600,
            background: paused ? '#1c1c27' : 'oklch(65% 0.18 148 / 0.15)', border: `1px solid ${paused ? '#252535' : 'oklch(65% 0.18 148 / 0.4)'}`, color: paused ? '#636385' : 'oklch(65% 0.18 148)' }}>
            {paused ? '▶ Reprendre' : '⏸ Pause'}
          </button>
          <button onClick={fetchAll} disabled={loadingPrices} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600,
            background: '#1c1c27', border: '1px solid #252535', color: '#636385', opacity: loadingPrices ? 0.5 : 1 }}>
            ↻ Actualiser
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-3" style={{ gap: 12 }}>
        {[
          { label: 'Valeur totale (€)', val: fmt(totalValue), color: '#e8e8f2', sub: null },
          { label: 'Total investi (€)',  val: fmt(totalCost),  color: '#636385', sub: null },
          { label: 'Plus-value totale',  val: fmt(totalPnL),   color: totalPnL >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', sub: (totalPnLPct >= 0 ? '+' : '') + totalPnLPct.toFixed(2) + '%' },
        ].map(k => (
          <div key={k.label} style={{ ...cardCss, padding: '18px 22px' }}>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.val}</div>
            {k.sub && <div style={{ fontSize: 13, color: k.color, marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Actions & ETF */}
      {peaPositions.length > 0 && (
        <div style={cardCss}>
          <div className="invest-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>📈</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>Actions & ETF</span>
              <span style={{ fontSize: 13, color: '#636385' }}>{fmt(peaValue)}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: peaValue - peaCost >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
              {peaValue - peaCost >= 0 ? '+' : ''}{fmt(peaValue - peaCost)} ({peaCost > 0 ? fmtPct((peaValue - peaCost) / peaCost * 100) : '—'}) en €
            </span>
          </div>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead><tr>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {peaPositions.map(p => (
                <PositionRow
                  key={p.id} p={p}
                  liveRaw={prices[p.ticker] ?? (p as { price?: number }).price ?? p.costPerUnit}
                  liveCurrency={liveCurrencies[p.ticker] ?? 'USD'}
                  usdToEur={usdToEur}
                  color={CAT_COLOR_PEA}
                  selected={selected === p.id}
                  onSelect={() => setSelected(s => s === p.id ? null : p.id)}
                />
              ))}
            </tbody>
          </table>
          </div>
          {(() => {
            const sel = peaPositions.find(p => p.id === selected)
            return sel ? (
              <div style={{ marginTop: 8, borderTop: '1px solid #252535', paddingTop: 12 }}>
                <MiniChart ticker={sel.ticker} color={CAT_COLOR_PEA} costPerUnit={sel.costPerUnit} />
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* Crypto */}
      {cryptoPositions.length > 0 && (
        <div style={cardCss}>
          <div className="invest-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>₿</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>Crypto</span>
              <span style={{ fontSize: 13, color: '#636385' }}>{fmt(cryptoValue)}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: cryptoValue - cryptoCost >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
              {cryptoValue - cryptoCost >= 0 ? '+' : ''}{fmt(cryptoValue - cryptoCost)} ({cryptoCost > 0 ? fmtPct((cryptoValue - cryptoCost) / cryptoCost * 100) : '—'})
            </span>
          </div>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead><tr>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {cryptoPositions.map(p => (
                <PositionRow
                  key={p.id} p={p}
                  liveRaw={prices[p.ticker] ?? (p as { price?: number }).price ?? p.costPerUnit}
                  liveCurrency={liveCurrencies[p.ticker] ?? 'EUR'}
                  usdToEur={usdToEur}
                  color={CAT_COLOR_CRYPTO}
                  selected={selected === p.id}
                  onSelect={() => setSelected(s => s === p.id ? null : p.id)}
                />
              ))}
            </tbody>
          </table>
          </div>
          {(() => {
            const sel = cryptoPositions.find(p => p.id === selected)
            return sel ? (
              <div style={{ marginTop: 8, borderTop: '1px solid #252535', paddingTop: 12 }}>
                <MiniChart ticker={sel.ticker} color={CAT_COLOR_CRYPTO} costPerUnit={sel.costPerUnit} />
              </div>
            ) : null
          })()}
        </div>
      )}

      {peaPositions.length === 0 && cryptoPositions.length === 0 && (
        <div style={{ ...cardCss, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
          <div style={{ color: '#e8e8f2', fontWeight: 600, marginBottom: 8 }}>Aucun investissement</div>
          <div style={{ color: '#636385', fontSize: 13 }}>Ajoutez vos positions dans la page Patrimoine.</div>
        </div>
      )}
    </div>
  )
}
