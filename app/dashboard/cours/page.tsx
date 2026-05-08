'use client'
import { useState } from 'react'
import { fmt, cardCss, inputCss, btnCss } from '@/lib/utils'

const SUGGESTIONS = ['MSFT', 'AAPL', 'NVDA', 'AMZN', 'GOOGL', 'BTC-USD', 'ETH-USD', 'SP500', 'CAC40', 'EUR=X']
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
  prices: number[]
  timestamps: number[]
  current: number
  high52: number
  low52: number
}

function CoursChart({ data }: { data: ChartData }) {
  const { prices } = data
  if (prices.length < 2) return <div style={{ color: '#636385', textAlign: 'center', padding: 40 }}>Aucune donnée</div>

  const min = Math.min(...prices), max = Math.max(...prices)
  const range = max - min || 1
  const positive = prices[prices.length - 1] >= prices[0]
  const color = positive ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)'
  const W = 600, H = 200, padX = 10, padY = 20

  const px = (i: number) => padX + (i / (prices.length - 1)) * (W - padX * 2)
  const py = (v: number) => padY + ((max - v) / range) * (H - padY * 2)

  const path = prices.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(v)}`).join(' ')
  const area = `${path} L${px(prices.length - 1)},${H} L${px(0)},${H}Z`

  const change = prices[prices.length - 1] - prices[0]
  const changePct = (change / prices[0]) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#e8e8f2' }}>{fmt(data.current)}</div>
          <div style={{ fontSize: 14, color, fontWeight: 600 }}>
            {change >= 0 ? '+' : ''}{fmt(change)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#636385' }}>52S Haut</div>
            <div style={{ color: '#e8e8f2', fontWeight: 600 }}>{fmt(data.high52)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#636385' }}>52S Bas</div>
            <div style={{ color: '#e8e8f2', fontWeight: 600 }}>{fmt(data.low52)}</div>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200 }}>
        <defs>
          <linearGradient id="cours-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#cours-grad)" />
        <path d={path} stroke={color} strokeWidth={2} fill="none" />
      </svg>
    </div>
  )
}

export default function CoursPage() {
  const [ticker, setTicker] = useState('')
  const [range, setRange] = useState(RANGES[1])
  const [data, setData] = useState<ChartData | null>(null)
  const [error, setError] = useState('')
  const [loadingChart, setLoadingChart] = useState(false)
  const [recent, setRecent] = useState<string[]>([])

  async function search(t?: string) {
    const sym = (t ?? ticker).trim().toUpperCase()
    if (!sym) return
    setLoadingChart(true); setError('')
    try {
      const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(sym)}&range=${range.range}&interval=${range.interval}`)
      const d = await r.json()
      if (d.error) { setError(d.error); setData(null) }
      else {
        setData({ ticker: sym, prices: d.prices, timestamps: d.timestamps, current: d.price, high52: d.high52, low52: d.low52 })
        setRecent(prev => [sym, ...prev.filter(x => x !== sym)].slice(0, 8))
        setTicker(sym)
      }
    } catch { setError('Erreur réseau') }
    setLoadingChart(false)
  }

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Cours</h1>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10 }}>
        <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Ex: MSFT, BTC-USD, AAPL…"
          style={{ ...inputCss, flex: 1, fontSize: 15 }} />
        <button onClick={() => search()} disabled={loadingChart} style={{ ...btnCss(), minWidth: 90, opacity: loadingChart ? 0.7 : 1 }}>
          {loadingChart ? '…' : 'Rechercher'}
        </button>
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => search(s)} style={{
            padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
            background: '#1c1c27', border: '1px solid #252535', color: '#636385',
          }}>{s}</button>
        ))}
      </div>

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#636385', marginBottom: 6 }}>Récents</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {recent.map(s => (
              <button key={s} onClick={() => search(s)} style={{
                padding: '5px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
                background: 'oklch(63% 0.19 250 / 0.15)', border: '1px solid oklch(63% 0.19 250 / 0.3)', color: 'oklch(63% 0.19 250)',
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Range selector */}
      {data && (
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map(r => (
            <button key={r.label} onClick={() => { setRange(r); setTimeout(() => search(data.ticker), 0) }}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
                background: range.label === r.label ? 'oklch(63% 0.19 250)' : '#1c1c27',
                border: `1px solid ${range.label === r.label ? 'oklch(63% 0.19 250)' : '#252535'}`,
                color: range.label === r.label ? '#fff' : '#636385' }}>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {error && <div style={{ color: 'oklch(62% 0.20 25)', fontSize: 13, background: 'oklch(62% 0.20 25 / 0.1)', borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

      {data && (
        <div style={{ background: '#13131b', border: '1px solid #252535', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f2', marginBottom: 16 }}>{data.ticker}</div>
          <CoursChart data={data} />
        </div>
      )}

      {!data && !loadingChart && (
        <div style={{ background: '#13131b', border: '1px solid #252535', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ color: '#636385', fontSize: 13 }}>Recherchez un ticker pour afficher son cours</div>
        </div>
      )}
    </div>
  )
}
