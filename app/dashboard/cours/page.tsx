'use client'
import { useState } from 'react'
import { fmt, cardCss, inputCss, btnCss } from '@/lib/utils'

const SUGGESTIONS = [
  { ticker: 'IWDA.AS', label: 'MSCI World' },
  { ticker: 'CW8.PA',  label: 'Amundi MSCI World' },
  { ticker: 'AAPL',    label: 'Apple' },
  { ticker: 'MSFT',    label: 'Microsoft' },
  { ticker: 'NVDA',    label: 'NVIDIA' },
  { ticker: 'BTC-EUR', label: 'Bitcoin' },
  { ticker: 'ETH-EUR', label: 'Ethereum' },
]

const RANGES = [
  { label: '5J',  range: '5d',  interval: '1h'  },
  { label: '1M',  range: '1mo', interval: '1d'  },
  { label: '3M',  range: '3mo', interval: '1d'  },
  { label: '6M',  range: '6mo', interval: '1wk' },
  { label: '1A',  range: '1y',  interval: '1wk' },
  { label: '5A',  range: '5y',  interval: '1mo' },
  { label: 'MAX', range: 'max', interval: '1mo' },
]

interface ChartData {
  ticker: string
  longName?: string
  exchange?: string
  currency?: string
  prices: number[]
  timestamps: number[]
  current: number
  high52: number
  low52: number
}

function CoursChart({ data }: { data: ChartData }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const { prices, timestamps } = data
  if (prices.length < 2) return <div style={{ color: '#636385', textAlign: 'center', padding: 40 }}>Aucune donnée</div>

  const displayIdx = hoveredIdx ?? prices.length - 1
  const displayPrice = prices[displayIdx]
  const displayTs = timestamps[displayIdx]

  const min = Math.min(...prices), max = Math.max(...prices)
  const range = max - min || 1
  const positive = prices[prices.length - 1] >= prices[0]
  const color = positive ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)'
  const W = 700, H = 200, padX = 8, padY = 16

  const px = (i: number) => padX + (i / (prices.length - 1)) * (W - padX * 2)
  const py = (v: number) => padY + ((max - v) / range) * (H - padY * 2)

  const path = prices.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const area = `${path} L${px(prices.length - 1).toFixed(1)},${H} L${px(0).toFixed(1)},${H}Z`

  const change    = prices[prices.length - 1] - prices[0]
  const changePct = (change / prices[0]) * 100

  const dateLabel = displayTs
    ? new Date(displayTs * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Price header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#e8e8f2', lineHeight: 1 }}>
            {displayPrice.toFixed(2)} <span style={{ fontSize: 14, color: '#636385', fontWeight: 400 }}>{data.currency ?? 'EUR'}</span>
          </div>
          <div style={{ fontSize: 14, color, fontWeight: 600, marginTop: 4 }}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%) <span style={{ fontSize: 12, color: '#636385', fontWeight: 400 }}>sur la période</span>
          </div>
          {dateLabel && hoveredIdx !== null && (
            <div style={{ fontSize: 11, color: '#636385', marginTop: 2 }}>{dateLabel}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#636385' }}>52S Haut</div>
            <div style={{ color: '#e8e8f2', fontWeight: 600 }}>{data.high52.toFixed(2)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#636385' }}>52S Bas</div>
            <div style={{ color: '#e8e8f2', fontWeight: 600 }}>{data.low52.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* SVG chart with hover */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}
          onMouseLeave={() => setHoveredIdx(null)}
          onMouseMove={e => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const svgX = ((e.clientX - rect.left) / rect.width) * W
            const idx = Math.round((svgX - padX) / (W - padX * 2) * (prices.length - 1))
            setHoveredIdx(Math.max(0, Math.min(prices.length - 1, idx)))
          }}>
          <defs>
            <linearGradient id="cours-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#cours-grad)" />
          <path d={path} stroke={color} strokeWidth={2} fill="none" />
          {hoveredIdx !== null && (
            <>
              <line x1={px(hoveredIdx)} y1={padY} x2={px(hoveredIdx)} y2={H}
                stroke="#636385" strokeWidth={1} strokeDasharray="4 3" />
              <circle cx={px(hoveredIdx)} cy={py(prices[hoveredIdx])} r={4}
                fill={color} stroke="#13131b" strokeWidth={2} />
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

export default function CoursPage() {
  const [ticker, setTicker]         = useState('')
  const [range, setRange]           = useState(RANGES[4])
  const [data, setData]             = useState<ChartData | null>(null)
  const [error, setError]           = useState('')
  const [loadingChart, setLoading]  = useState(false)
  const [recent, setRecent]         = useState<string[]>([])

  async function search(t?: string) {
    const sym = (t ?? ticker).trim().toUpperCase()
    if (!sym) return
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(sym)}&range=${range.range}&interval=${range.interval}`)
      const d = await r.json()
      if (d.error) { setError(d.error); setData(null) }
      else {
        setData({
          ticker: sym,
          longName: d.longName,
          exchange: d.exchange,
          currency: d.currency,
          prices: d.prices,
          timestamps: d.timestamps,
          current: d.price,
          high52: d.high52,
          low52:  d.low52,
        })
        setRecent(prev => [sym, ...prev.filter(x => x !== sym)].slice(0, 8))
        setTicker(sym)
      }
    } catch { setError('Erreur réseau') }
    setLoading(false)
  }

  async function changeRange(r: typeof RANGES[0]) {
    setRange(r)
    if (!data) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(data.ticker)}&range=${r.range}&interval=${r.interval}`)
      const d = await res.json()
      if (!d.error) setData(prev => prev ? { ...prev, prices: d.prices, timestamps: d.timestamps, current: d.price } : prev)
    } catch {}
    setLoading(false)
  }

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Cours & Charts</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Suivez n&apos;importe quelle action, ETF ou crypto</p>
      </div>

      {/* Search */}
      <div style={cardCss}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Ex: IWDA.AS, BTC-EUR, AAPL…"
            style={{ ...inputCss, flex: 1, fontSize: 15 }} />
          <button onClick={() => search()} disabled={loadingChart} style={{ ...btnCss(), minWidth: 90, opacity: loadingChart ? 0.7 : 1 }}>
            {loadingChart ? '…' : 'Afficher'}
          </button>
        </div>

        {/* Help */}
        <div style={{ fontSize: 11, color: '#636385', background: '#1c1c27', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
          <span style={{ fontWeight: 600, color: '#e8e8f2' }}>Comment trouver le ticker ?</span>{' '}
          Cherche sur finance.yahoo.com — le code s&apos;affiche en haut de la page. ETF européens : suffixe <span style={{ color: 'oklch(63% 0.19 250)' }}>.PA</span> (Paris), <span style={{ color: 'oklch(63% 0.19 250)' }}>.AS</span> (Amsterdam), <span style={{ color: 'oklch(63% 0.19 250)' }}>.L</span> (Londres). Exemple : iShares MSCI World = <span style={{ color: 'oklch(65% 0.18 148)', fontWeight: 600 }}>IWDA.AS</span>, Amundi MSCI World = <span style={{ color: 'oklch(65% 0.18 148)', fontWeight: 600 }}>CW8.PA</span>.
        </div>

        {/* Suggestions */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: recent.length > 0 ? 10 : 0 }}>
          {SUGGESTIONS.map(s => (
            <button key={s.ticker} onClick={() => search(s.ticker)} style={{
              padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
              background: '#1c1c27', border: '1px solid #252535', color: '#e8e8f2',
            }}>
              <span style={{ fontWeight: 600 }}>{s.ticker}</span>
              <span style={{ color: '#636385', marginLeft: 4 }}>{s.label}</span>
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 6 }}>Récents :</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {recent.map(s => (
                <button key={s} onClick={() => search(s)} style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
                  background: 'oklch(63% 0.19 250 / 0.15)', border: '1px solid oklch(63% 0.19 250 / 0.3)', color: 'oklch(63% 0.19 250)', fontWeight: 600,
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ color: 'oklch(62% 0.20 25)', fontSize: 13, background: 'oklch(62% 0.20 25 / 0.1)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

      {data && (
        <div style={cardCss}>
          {/* Instrument header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>{data.ticker}</span>
              {data.exchange && <span style={{ fontSize: 12, color: '#636385' }}>· {data.exchange}</span>}
            </div>
            {data.longName && <div style={{ fontSize: 13, color: '#636385', marginTop: 2 }}>{data.longName}</div>}
          </div>

          <CoursChart data={data} />

          {/* Range selector */}
          <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
            {RANGES.map(r => (
              <button key={r.label} onClick={() => changeRange(r)}
                style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
                  background: range.label === r.label ? 'oklch(63% 0.19 250)' : '#1c1c27',
                  border: `1px solid ${range.label === r.label ? 'oklch(63% 0.19 250)' : '#252535'}`,
                  color: range.label === r.label ? '#fff' : '#636385', fontWeight: range.label === r.label ? 600 : 400 }}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!data && !loadingChart && (
        <div style={{ ...cardCss, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ color: '#636385', fontSize: 13 }}>Recherchez un ticker pour afficher son cours</div>
        </div>
      )}
    </div>
  )
}
