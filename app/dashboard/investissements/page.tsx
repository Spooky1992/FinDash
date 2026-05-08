'use client'
import { useEffect, useState } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, fmtPct, cardCss } from '@/lib/utils'

const KNOWN_COINS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink',
  XRP: 'ripple', BNB: 'binancecoin', AVAX: 'avalanche-2',
}

export default function InvestissementsPage() {
  const { portfolio, loading } = useAppData()
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (loading) return
    const fetchAll = async () => {
      setLoadingPrices(true)
      const newPrices: Record<string, number> = {}
      await Promise.all([
        ...portfolio.pea.positions.map(async p => {
          try { const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(p.ticker)}`); const d = await r.json(); if (d.price) newPrices[p.ticker] = d.price } catch {}
        }),
        ...portfolio.crypto.positions.map(async p => {
          try { const id = KNOWN_COINS[p.ticker.toUpperCase()] ?? p.ticker.toLowerCase(); const r = await fetch(`/api/prices/crypto?id=${encodeURIComponent(id)}`); const d = await r.json(); if (d.price) newPrices[p.ticker] = d.price } catch {}
        }),
      ])
      setPrices(newPrices)
      setLoadingPrices(false)
      setPulse(true)
      setTimeout(() => setPulse(false), 1000)
    }
    fetchAll()
  }, [loading])

  const peaPositions   = portfolio.pea.positions
  const cryptoPositions = portfolio.crypto.positions

  const peaValue   = peaPositions.reduce((s, p) => s + p.quantity * (prices[p.ticker] ?? p.price ?? p.costPerUnit), 0)
  const peaCost    = peaPositions.reduce((s, p) => s + p.quantity * p.costPerUnit, 0)
  const cryptoValue = cryptoPositions.reduce((s, p) => s + p.quantity * (prices[p.ticker] ?? p.price ?? p.costPerUnit), 0)
  const cryptoCost  = cryptoPositions.reduce((s, p) => s + p.quantity * p.costPerUnit, 0)

  const totalValue = peaValue + cryptoValue
  const totalCost  = peaCost + cryptoCost
  const totalPnL   = totalValue - totalCost
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Investissements</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: loadingPrices ? 'oklch(68% 0.17 55)' : 'oklch(65% 0.18 148)', transition: 'background 0.3s', boxShadow: pulse ? '0 0 6px oklch(65% 0.18 148)' : 'none' }} />
          <span style={{ fontSize: 11, color: '#636385' }}>{loadingPrices ? 'Mise à jour…' : 'Cours en direct'}</span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Valeur totale',  val: totalValue, color: '#e8e8f2',    fmt: true  },
          { label: 'Investi',        val: totalCost,  color: '#636385',    fmt: true  },
          { label: 'P&L',            val: totalPnL,   color: totalPnL >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fmt: true },
          { label: 'Rendement',      val: totalPnLPct, color: totalPnLPct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fmt: false },
        ].map(k => (
          <div key={k.label} style={{ ...cardCss, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#636385', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>
              {k.fmt ? (k.val >= 0 ? '' : '') + fmt(k.val) : fmtPct(k.val)}
            </div>
          </div>
        ))}
      </div>

      {/* PEA */}
      {peaPositions.length > 0 && (
        <div style={cardCss}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>PEA — Actions / ETF</span>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: '#636385' }}>Valeur: <span style={{ color: '#e8e8f2', fontWeight: 600 }}>{fmt(peaValue)}</span></span>
              <span style={{ color: '#636385' }}>P&L: <span style={{ fontWeight: 600, color: peaValue - peaCost >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{peaValue - peaCost >= 0 ? '+' : ''}{fmt(peaValue - peaCost)}</span></span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Ticker', 'Quantité', 'PRU', 'Prix actuel', 'Valeur', 'P&L', '%'].map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {peaPositions.map(p => {
                const live = prices[p.ticker] ?? p.price ?? p.costPerUnit
                const value = p.quantity * live
                const cost  = p.quantity * p.costPerUnit
                const pnl   = value - cost
                const pct   = cost > 0 ? (pnl / cost) * 100 : 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                    <td style={{ padding: '10px 10px', fontWeight: 700, color: 'oklch(63% 0.19 250)', fontSize: 13 }}>{p.ticker}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#e8e8f2' }}>{p.quantity}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#636385', textAlign: 'right' }}>{fmt(p.costPerUnit)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: prices[p.ticker] ? '#e8e8f2' : '#636385', textAlign: 'right' }}>{fmt(live)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(value)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', color: pct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{fmtPct(pct)}</td>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Crypto</span>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: '#636385' }}>Valeur: <span style={{ color: '#e8e8f2', fontWeight: 600 }}>{fmt(cryptoValue)}</span></span>
              <span style={{ color: '#636385' }}>P&L: <span style={{ fontWeight: 600, color: cryptoValue - cryptoCost >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{cryptoValue - cryptoCost >= 0 ? '+' : ''}{fmt(cryptoValue - cryptoCost)}</span></span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Ticker', 'Quantité', 'PRU', 'Prix actuel', 'Valeur', 'P&L', '%'].map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {cryptoPositions.map(p => {
                const live = prices[p.ticker] ?? p.price ?? p.costPerUnit
                const value = p.quantity * live
                const cost  = p.quantity * p.costPerUnit
                const pnl   = value - cost
                const pct   = cost > 0 ? (pnl / cost) * 100 : 0
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                    <td style={{ padding: '10px 10px', fontWeight: 700, color: 'oklch(68% 0.17 55)', fontSize: 13 }}>{p.ticker}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#e8e8f2' }}>{p.quantity}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#636385', textAlign: 'right' }}>{fmt(p.costPerUnit)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: prices[p.ticker] ? '#e8e8f2' : '#636385', textAlign: 'right' }}>{fmt(live)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(value)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', color: pct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{fmtPct(pct)}</td>
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
