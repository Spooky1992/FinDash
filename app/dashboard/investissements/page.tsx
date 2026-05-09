'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, fmtPct, cardCss } from '@/lib/utils'

const KNOWN_COINS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink',
  XRP: 'ripple', BNB: 'binancecoin', AVAX: 'avalanche-2',
}

const CAT_COLOR_PEA    = 'oklch(63% 0.19 250)'
const CAT_COLOR_CRYPTO = 'oklch(68% 0.17 55)'

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function TickerBadge({ ticker, color }: { ticker: string; color: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${color}22`, borderRadius: 6, padding: '3px 8px' }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {ticker.replace('-EUR', '').replace('.AS', '').replace('.PA', '').slice(0, 2)}
      </div>
      <span style={{ fontWeight: 700, color, fontSize: 12 }}>{ticker}</span>
    </div>
  )
}

export default function InvestissementsPage() {
  const { portfolio, loading } = useAppData()
  const [prices, setPrices]         = useState<Record<string, number>>({})
  const [loadingPrices, setLoading] = useState(false)
  const [paused, setPaused]         = useState(false)
  const [elapsed, setElapsed]       = useState(0)
  const [eurUsd, setEurUsd]         = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setElapsed(0)

    const newPrices: Record<string, number> = {}
    await Promise.all([
      ...portfolio.pea.positions.map(async p => {
        try {
          const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(p.ticker)}`)
          const d = await r.json()
          if (d.price) newPrices[p.ticker] = d.price
        } catch {}
      }),
      ...portfolio.crypto.positions.map(async p => {
        try {
          const id = KNOWN_COINS[p.ticker.replace('-EUR', '').toUpperCase()] ?? p.ticker.toLowerCase()
          const r = await fetch(`/api/prices/crypto?id=${encodeURIComponent(id)}`)
          const d = await r.json()
          if (d.price) newPrices[p.ticker] = d.price
        } catch {}
      }),
      (async () => {
        try {
          const r = await fetch('/api/prices/stock?ticker=EUR%3DX')
          const d = await r.json()
          if (d.price) setEurUsd(1 / d.price)
        } catch {}
      })(),
    ])
    setPrices(newPrices)
    setLoading(false)
  }, [loading, portfolio.pea.positions, portfolio.crypto.positions])

  // Initial fetch
  useEffect(() => { fetchAll() }, [fetchAll])

  // Auto-refresh every 60s
  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => fetchAll(), 60_000)
    return () => clearInterval(interval)
  }, [paused, fetchAll])

  // Elapsed timer
  useEffect(() => {
    if (loadingPrices) return
    const timer = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(timer)
  }, [loadingPrices])

  const peaPositions    = portfolio.pea.positions
  const cryptoPositions = portfolio.crypto.positions

  const peaValue    = peaPositions.reduce((s, p) => s + p.quantity * (prices[p.ticker] ?? p.price ?? p.costPerUnit), 0)
  const peaCost     = peaPositions.reduce((s, p) => s + p.quantity * p.costPerUnit, 0)
  const cryptoValue = cryptoPositions.reduce((s, p) => s + p.quantity * (prices[p.ticker] ?? p.price ?? p.costPerUnit), 0)
  const cryptoCost  = cryptoPositions.reduce((s, p) => s + p.quantity * p.costPerUnit, 0)

  const totalValue   = peaValue + cryptoValue
  const totalCost    = peaCost + cryptoCost
  const totalPnL     = totalValue - totalCost
  const totalPnLPct  = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Investissements</h1>
          <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Portefeuilles en temps réel</p>
        </div>
      </div>

      {/* Live bar */}
      <div style={{ ...cardCss, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: loadingPrices ? 'oklch(68% 0.17 55)' : 'oklch(65% 0.18 148)', boxShadow: loadingPrices ? 'none' : '0 0 6px oklch(65% 0.18 148)', transition: 'background 0.3s' }} />
          <span style={{ fontSize: 12, color: '#e8e8f2', fontWeight: 600 }}>Crypto live (CoinGecko)</span>
        </div>
        {eurUsd && (
          <span style={{ fontSize: 12, color: '#636385' }}>
            EUR/USD : <span style={{ color: '#e8e8f2', fontWeight: 600 }}>{eurUsd.toFixed(4)}</span>
            <span style={{ color: '#636385', fontSize: 11 }}> • défaut → 1 $ = {(1 / eurUsd).toFixed(4)} €</span>
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {!loadingPrices && (
            <span style={{ fontSize: 11, color: '#636385' }}>MàJ : {formatElapsed(elapsed)}</span>
          )}
          {loadingPrices && <span style={{ fontSize: 11, color: '#636385' }}>Mise à jour…</span>}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>📈</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>Actions & ETF</span>
              <span style={{ fontSize: 13, color: '#636385' }}>{fmt(peaValue)}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: peaValue - peaCost >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
              {peaValue - peaCost >= 0 ? '+' : ''}{fmt(peaValue - peaCost)} ({peaCost > 0 ? fmtPct((peaValue - peaCost) / peaCost * 100) : '—'})
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Ticker', 'Qté', 'PRU', 'Prix live', 'Valeur (€)', 'P&L (€)'].map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {peaPositions.map(p => {
                const live  = prices[p.ticker] ?? p.price ?? p.costPerUnit
                const value = p.quantity * live
                const cost  = p.quantity * p.costPerUnit
                const pnl   = value - cost
                const pct   = cost > 0 ? (pnl / cost) * 100 : 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                    <td style={{ padding: '12px 10px' }}>
                      <div>
                        <TickerBadge ticker={p.ticker} color={CAT_COLOR_PEA} />
                        {p.name && <div style={{ fontSize: 10, color: '#636385', marginTop: 3, marginLeft: 2 }}>{p.name}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: 13, color: '#e8e8f2' }}>{p.quantity}</td>
                    <td style={{ padding: '12px 10px', fontSize: 12, color: '#636385', textAlign: 'right' }}>{fmt(p.costPerUnit)}</td>
                    <td style={{ padding: '12px 10px', fontSize: 13, color: prices[p.ticker] ? '#e8e8f2' : '#636385', textAlign: 'right', fontWeight: prices[p.ticker] ? 600 : 400 }}>{fmt(live)}</td>
                    <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(value)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</div>
                      <div style={{ fontSize: 11, color: pct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{fmtPct(pct)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Crypto */}
      {cryptoPositions.length > 0 && (
        <div style={cardCss}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>₿</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>Crypto</span>
              <span style={{ fontSize: 13, color: '#636385' }}>{fmt(cryptoValue)}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: cryptoValue - cryptoCost >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
              {cryptoValue - cryptoCost >= 0 ? '+' : ''}{fmt(cryptoValue - cryptoCost)} ({cryptoCost > 0 ? fmtPct((cryptoValue - cryptoCost) / cryptoCost * 100) : '—'})
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Ticker', 'Qté', 'PRU', 'Prix live', 'Valeur (€)', 'P&L (€)'].map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {cryptoPositions.map(p => {
                const live  = prices[p.ticker] ?? p.price ?? p.costPerUnit
                const value = p.quantity * live
                const cost  = p.quantity * p.costPerUnit
                const pnl   = value - cost
                const pct   = cost > 0 ? (pnl / cost) * 100 : 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                    <td style={{ padding: '12px 10px' }}>
                      <div>
                        <TickerBadge ticker={p.ticker} color={CAT_COLOR_CRYPTO} />
                        {p.name && <div style={{ fontSize: 10, color: '#636385', marginTop: 3, marginLeft: 2 }}>{p.name}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: 13, color: '#e8e8f2' }}>{p.quantity}</td>
                    <td style={{ padding: '12px 10px', fontSize: 12, color: '#636385', textAlign: 'right' }}>{fmt(p.costPerUnit)}</td>
                    <td style={{ padding: '12px 10px', fontSize: 13, color: prices[p.ticker] ? '#e8e8f2' : '#636385', textAlign: 'right', fontWeight: prices[p.ticker] ? 600 : 400 }}>{fmt(live)}</td>
                    <td style={{ padding: '12px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(value)}</td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</div>
                      <div style={{ fontSize: 11, color: pct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{fmtPct(pct)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
