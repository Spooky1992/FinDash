'use client'
import { useState, useEffect } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, fmtPct, cardCss, inputCss, btnCss, COLOR_LIST } from '@/lib/utils'
import type { Position, Livret, Immo, Portfolio } from '@/lib/types'
import { Treemap, TreemapLegend, type TreemapItem } from '@/components/Treemap'

async function fetchStockPrice(ticker: string): Promise<number | null> {
  try { const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(ticker)}`); const d = await r.json(); return d.price ?? null } catch { return null }
}
async function fetchCryptoPrice(coinId: string): Promise<number | null> {
  try { const r = await fetch(`/api/prices/crypto?id=${encodeURIComponent(coinId)}`); const d = await r.json(); return d.price ?? null } catch { return null }
}

const KNOWN_COINS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  DOT: 'polkadot', MATIC: 'matic-network', LINK: 'chainlink',
  XRP: 'ripple', BNB: 'binancecoin', AVAX: 'avalanche-2',
}

const CAT_COLORS: Record<string, string> = {
  pea:     'oklch(63% 0.19 250)',
  crypto:  'oklch(68% 0.17 55)',
  livrets: 'oklch(65% 0.16 185)',
  immo:    'oklch(65% 0.18 148)',
}

function uid() { return `p-${Date.now()}-${Math.random().toString(36).slice(2,6)}` }
type Tab = 'pea' | 'crypto' | 'livrets' | 'immo'

// ── Bar chart vertical dépenses ───────────────────────────────────────────────
function VerticalBarChart({ budget }: { budget: ReturnType<typeof useAppData>['budget'] }) {
  const cats = budget.expenses
    .map(cat => ({ label: cat.label, val: cat.items.reduce((s, i) => s + i.amount, 0), color: cat.items[0]?.color ?? '#636385' }))
    .filter(c => c.val > 0)
    .sort((a, b) => b.val - a.val)

  if (cats.length === 0) return null

  const H = 220
  const barW = 54
  const gap = 16
  const padT = 20
  const padB = 30
  const max = cats[0].val
  const W = cats.length * (barW + gap) + gap

  return (
    <div style={{ ...cardCss, minWidth: 240 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f2', marginBottom: 14 }}>Dépenses par catégorie</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }}>
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = padT + (1 - f) * (H - padT - padB)
          return (
            <g key={f}>
              <line x1={0} y1={y} x2={W} y2={y} stroke="#1c1c27" strokeWidth={1} />
              <text x={0} y={y - 3} fontSize={8} fill="#636385" fontFamily="Inter, sans-serif">
                {Math.round(f * max)} €
              </text>
            </g>
          )
        })}
        {cats.map((c, i) => {
          const bh = ((c.val / max) * (H - padT - padB))
          const bx = gap + i * (barW + gap)
          const by = padT + (H - padT - padB) - bh
          return (
            <g key={c.label}>
              <rect x={bx} y={by} width={barW} height={bh} rx={6} fill={c.color} fillOpacity={0.85} />
              <text x={bx + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#636385" fontFamily="Inter, sans-serif">
                {c.label.length > 8 ? c.label.slice(0, 7) + '…' : c.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PatrimoinePage() {
  const { portfolio, budget, savePortfolio, loading } = useAppData()
  const [tab, setTab] = useState<Tab>('pea')
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [liveCurrencies, setLiveCurrencies] = useState<Record<string, string>>({})
  const [usdToEur, setUsdToEur] = useState<number>(0.88) // EUR=X sur Yahoo = combien d'EUR pour 1 USD
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Position & Livret & Immo> & { _type?: Tab; currency?: 'EUR' | 'USD' }>({})
  const [fetchingRate, setFetchingRate] = useState(false)

  useEffect(() => {
    if (loading) return
    const fetchAll = async () => {
      setLoadingPrices(true)
      const newPrices: Record<string, number> = {}
      const newCurrencies: Record<string, string> = {}
      try {
        const r = await fetch('/api/prices/stock?ticker=EUR%3DX')
        const d = await r.json()
        if (d.price) setUsdToEur(d.price) // EUR=X = combien d'EUR pour 1 USD
      } catch {}
      await Promise.all([
        ...portfolio.pea.positions.map(async p => {
          try { const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(p.ticker)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = d.currency ?? 'USD' } } catch {}
        }),
        ...portfolio.crypto.positions.map(async p => {
          const id = KNOWN_COINS[p.ticker.toUpperCase()] ?? p.ticker.toLowerCase()
          try { const r = await fetch(`/api/prices/crypto?id=${encodeURIComponent(id)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = 'EUR' } } catch {}
        }),
      ])
      setPrices(newPrices); setLiveCurrencies(newCurrencies)
      setLoadingPrices(false)
    }
    fetchAll()
  }, [loading, portfolio.pea.positions, portfolio.crypto.positions])

  function openAdd() { setEditItem({ _type: tab }); setShowForm(true) }
  function openEdit(item: Position | Livret | Immo, t: Tab) { setEditItem({ ...item, _type: t }); setShowForm(true) }

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

  async function saveItem() {
    const p: Portfolio = JSON.parse(JSON.stringify(portfolio))
    const t = editItem._type ?? tab
    if (t === 'pea' || t === 'crypto') {
      const pos: Position = {
        id: (editItem as Position).id || uid(),
        ticker: editItem.ticker || '',
        quantity: Number(editItem.quantity) || 0,
        costPerUnit: Number(editItem.costPerUnit) || 0,
        name: editItem.name,
        currency: editItem.currency ?? 'EUR',
        purchaseDate: (editItem as Position).purchaseDate,
        purchaseEurUsd: (editItem as Position).purchaseEurUsd,
      }
      const arr = t === 'pea' ? p.pea.positions : p.crypto.positions
      const idx = arr.findIndex(x => x.id === pos.id)
      if (idx >= 0) arr[idx] = pos; else arr.push(pos)
      if (t === 'pea') p.pea.positions = arr; else p.crypto.positions = arr
    } else if (t === 'livrets') {
      const liv: Livret = { id: (editItem as Livret).id || uid(), name: editItem.name || '', rate: Number(editItem.rate) || 0, solde: Number((editItem as Livret).solde) || 0 }
      const idx = p.livrets.accounts.findIndex(x => x.id === liv.id)
      if (idx >= 0) p.livrets.accounts[idx] = liv; else p.livrets.accounts.push(liv)
    } else if (t === 'immo') {
      const immo: Immo = { id: (editItem as Immo).id || uid(), name: editItem.name || '', value: Number((editItem as Immo).value) || 0 }
      const idx = p.immo.properties.findIndex(x => x.id === immo.id)
      if (idx >= 0) p.immo.properties[idx] = immo; else p.immo.properties.push(immo)
    }
    await savePortfolio(p)
    setShowForm(false); setEditItem({})
  }

  async function deleteItem(id: string, t: Tab) {
    const p: Portfolio = JSON.parse(JSON.stringify(portfolio))
    if (t === 'pea') p.pea.positions = p.pea.positions.filter(x => x.id !== id)
    else if (t === 'crypto') p.crypto.positions = p.crypto.positions.filter(x => x.id !== id)
    else if (t === 'livrets') p.livrets.accounts = p.livrets.accounts.filter(x => x.id !== id)
    else if (t === 'immo') p.immo.properties = p.immo.properties.filter(x => x.id !== id)
    await savePortfolio(p)
  }

  // Les prix live (Yahoo/CoinGecko) sont déjà en EUR quand le ticker contient .PA/.AS ou -EUR
  // Pour les tickers USD natifs, on convertit via eurUsd
  function liveEur(p: Position) {
    const raw = prices[p.ticker] ?? p.price ?? p.costPerUnit
    const cur = liveCurrencies[p.ticker]
    if (!cur || cur === 'EUR') return raw
    if (cur === 'GBp' || cur === 'GBX') return raw * usdToEur / 100 * 1.17 // pence → GBP → EUR
    return raw * usdToEur // USD → EUR
  }
  function costEur(p: Position) {
    if (p.currency !== 'USD') return p.costPerUnit
    // purchaseEurUsd stocké = valeur de EUR=X au jour d'achat = combien d'EUR pour 1 USD
    const rate = p.purchaseEurUsd ?? usdToEur
    return p.costPerUnit * rate // USD × (EUR/USD) = EUR
  }

  const peaTotal     = portfolio.pea.positions.reduce((s, p) => s + p.quantity * liveEur(p), 0)
  const cryptoTotal  = portfolio.crypto.positions.reduce((s, p) => s + p.quantity * liveEur(p), 0)
  const livretsTotal = portfolio.livrets.accounts.reduce((s, l) => s + l.solde, 0)
  const immoTotal    = portfolio.immo.properties.reduce((s, i) => s + i.value, 0)
  const grandTotal   = peaTotal + cryptoTotal + livretsTotal + immoTotal

  const TABS: { key: Tab; label: string; total: number }[] = ([
    { key: 'pea'     as Tab, label: 'Actions & Fonds', total: peaTotal },
    { key: 'livrets' as Tab, label: 'Livrets',          total: livretsTotal },
    { key: 'crypto'  as Tab, label: 'Crypto',           total: cryptoTotal },
    { key: 'immo'    as Tab, label: 'Immobilier',       total: immoTotal },
  ] as { key: Tab; label: string; total: number }[]).sort((a, b) => b.total - a.total)

  // Treemap : une tuile par catégorie (pas par actif individuel)
  const treemapItems: TreemapItem[] = TABS
    .filter(t => t.total > 0)
    .map(t => ({ label: t.label, value: t.total, color: CAT_COLORS[t.key], sub: `${grandTotal > 0 ? ((t.total / grandTotal) * 100).toFixed(1) : 0}%` }))

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Patrimoine</h1>
          <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Vue consolidée de vos actifs</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {loadingPrices && <span style={{ fontSize: 11, color: '#636385' }}>⟳ Cours en direct…</span>}
          <div style={{ fontSize: 24, fontWeight: 700, color: 'oklch(65% 0.18 148)' }}>{fmt(grandTotal)}</div>
        </div>
      </div>

      {/* Treemap + bar chart */}
      {grandTotal > 0 && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div style={cardCss}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f2', marginBottom: 12 }}>Allocation</div>
            <Treemap items={treemapItems} height={280} />
            <div style={{ marginTop: 14 }}>
              <TreemapLegend items={treemapItems} />
            </div>
          </div>
          <VerticalBarChart budget={budget} />
        </div>
      )}

      {/* KPI cards (cliquables pour changer l'onglet) */}
      <div className="grid-4">
        {TABS.map(t => (
          <div key={t.key} onClick={() => setTab(t.key)} style={{ ...cardCss, padding: '14px 16px', cursor: 'pointer',
            border: `1px solid ${tab === t.key ? `${CAT_COLORS[t.key]}80` : '#252535'}`, transition: 'border-color 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[t.key] }} />
              <span style={{ fontSize: 11, color: '#636385' }}>{t.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f2' }}>{fmt(t.total)}</div>
            {grandTotal > 0 && <div style={{ fontSize: 10, color: '#636385', marginTop: 2 }}>{((t.total / grandTotal) * 100).toFixed(1)}%</div>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter',
            background: tab === t.key ? CAT_COLORS[t.key] : '#1c1c27',
            border: `1px solid ${tab === t.key ? CAT_COLORS[t.key] : '#252535'}`,
            color: tab === t.key ? '#fff' : '#636385', fontWeight: tab === t.key ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Table + cards */}
      <div style={cardCss}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>{TABS.find(t => t.key === tab)?.label}</span>
          <button onClick={openAdd} style={btnCss()}>+ Ajouter</button>
        </div>

        {/* ── Desktop tables ── */}
        {(tab === 'pea' || tab === 'crypto') && (
          <div className="pos-table">
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead><tr>
                  {['Ticker', 'Nom', 'Qté', 'PRU', 'Prix live', 'Valeur', 'P&L', ''].map((h, i) => (
                    <th key={i} style={{ padding: '6px 10px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(tab === 'pea' ? portfolio.pea.positions : portfolio.crypto.positions).map(pos => {
                    const live  = liveEur(pos)
                    const cpu   = costEur(pos)
                    const value = pos.quantity * live
                    const cost  = pos.quantity * cpu
                    const pnl   = value - cost
                    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
                    const col   = tab === 'pea' ? CAT_COLORS.pea : CAT_COLORS.crypto
                    const isUsd = pos.currency === 'USD'
                    return (
                      <tr key={pos.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                        <td style={{ padding: '10px 10px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${col}22`, borderRadius: 6, padding: '3px 8px' }}>
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                              {pos.ticker.replace('-EUR','').replace('.AS','').replace('.PA','').slice(0,2)}
                            </div>
                            <span style={{ fontWeight: 700, color: col, fontSize: 12 }}>{pos.ticker}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: '#636385' }}>{pos.name ?? '—'}</td>
                        <td style={{ padding: '10px 10px', fontSize: 13, color: '#e8e8f2' }}>{pos.quantity}</td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: '#636385' }}>
                          {isUsd
                            ? <><span style={{ color: '#e8e8f2' }}>{pos.costPerUnit.toFixed(2)}</span><span style={{ fontSize: 9, color: 'oklch(68% 0.17 55)', marginLeft: 3 }}>USD</span> <span style={{ color: '#3a3a50' }}>≈ {fmt(cpu)}</span></>
                            : fmt(pos.costPerUnit)
                          }
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 12, color: prices[pos.ticker] ? '#e8e8f2' : '#636385', textAlign: 'right' }}>{fmt(live)}</td>
                        <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(value)}</td>
                        <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>
                          {pnl >= 0 ? '+' : ''}{fmt(pnl)} ({fmtPct(pnlPct)})
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <button onClick={() => openEdit(pos, tab)} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px', marginRight: 4 }}>✏</button>
                          <button onClick={() => deleteItem(pos.id, tab)} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px' }}>🗑</button>
                        </td>
                      </tr>
                    )
                  })}
                  {(tab === 'pea' ? portfolio.pea.positions : portfolio.crypto.positions).length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#636385', fontSize: 13 }}>Aucune position</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'livrets' && (
          <div className="pos-table">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Compte', 'Taux', 'Solde', ''].map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {portfolio.livrets.accounts.map(liv => (
                  <tr key={liv.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#e8e8f2' }}>{liv.name}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#636385' }}>{liv.rate}%</td>
                    <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(liv.solde)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      <button onClick={() => openEdit(liv, 'livrets')} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px', marginRight: 4 }}>✏</button>
                      <button onClick={() => deleteItem(liv.id, 'livrets')} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px' }}>🗑</button>
                    </td>
                  </tr>
                ))}
                {portfolio.livrets.accounts.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: '#636385' }}>Aucun livret</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'immo' && (
          <div className="pos-table">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Bien', 'Valeur estimée', ''].map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: i >= 1 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {portfolio.immo.properties.map(immo => (
                  <tr key={immo.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#e8e8f2' }}>{immo.name}</td>
                    <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(immo.value)}</td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      <button onClick={() => openEdit(immo, 'immo')} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px', marginRight: 4 }}>✏</button>
                      <button onClick={() => deleteItem(immo.id, 'immo')} style={{ background: 'none', border: '1px solid #252535', borderRadius: 6, color: '#636385', cursor: 'pointer', padding: '4px 8px' }}>🗑</button>
                    </td>
                  </tr>
                ))}
                {portfolio.immo.properties.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: '#636385' }}>Aucun bien immobilier</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Mobile cards ── */}
        <div className="pos-cards">
          {(tab === 'pea' || tab === 'crypto') && (() => {
            const positions = tab === 'pea' ? portfolio.pea.positions : portfolio.crypto.positions
            const col = tab === 'pea' ? CAT_COLORS.pea : CAT_COLORS.crypto
            if (positions.length === 0) return <div style={{ color: '#636385', fontSize: 13, padding: '12px 0' }}>Aucune position</div>
            return positions.map(pos => {
              const live   = liveEur(pos)
              const cpu    = costEur(pos)
              const value  = pos.quantity * live
              const cost   = pos.quantity * cpu
              const pnl    = value - cost
              const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
              const pruLabel = pos.currency === 'USD'
                ? `${pos.costPerUnit.toFixed(2)} USD ≈ ${fmt(cpu)}`
                : fmt(pos.costPerUnit)
              return (
                <div key={pos.id} style={{ background: '#1c1c27', borderRadius: 12, padding: '14px 16px', border: '1px solid #252535' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {pos.ticker.replace('-EUR','').replace('.AS','').replace('.PA','').slice(0,2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: col, fontSize: 14 }}>{pos.ticker}</div>
                        {pos.name && <div style={{ fontSize: 11, color: '#636385' }}>{pos.name}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(pos, tab)} style={{ background: 'transparent', border: '1px solid #252535', borderRadius: 8, color: '#636385', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>✏ Éditer</button>
                      <button onClick={() => deleteItem(pos.id, tab)} style={{ background: 'transparent', border: '1px solid oklch(62% 0.20 25 / 0.4)', borderRadius: 8, color: 'oklch(62% 0.20 25)', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>🗑</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Quantité',  val: String(pos.quantity) },
                      { label: pos.currency === 'USD' ? 'PRU (USD→€)' : 'PRU', val: pruLabel },
                      { label: 'Prix live', val: fmt(live) },
                      { label: 'Valeur',    val: fmt(value) },
                      { label: 'P&L',       val: `${pnl >= 0 ? '+' : ''}${fmt(pnl)}`, color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' },
                      { label: 'Perf.',     val: fmtPct(pnlPct), color: pnlPct >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' },
                    ].map(r => (
                      <div key={r.label} style={{ background: '#13131b', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: r.color ?? '#e8e8f2' }}>{r.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          })()}

          {tab === 'livrets' && (() => {
            if (portfolio.livrets.accounts.length === 0) return <div style={{ color: '#636385', fontSize: 13, padding: '12px 0' }}>Aucun livret</div>
            return portfolio.livrets.accounts.map(liv => (
              <div key={liv.id} style={{ background: '#1c1c27', borderRadius: 12, padding: '14px 16px', border: '1px solid #252535' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f2' }}>{liv.name}</div>
                    <div style={{ fontSize: 12, color: '#636385', marginTop: 2 }}>Taux : {liv.rate}%</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(65% 0.16 185)' }}>{fmt(liv.solde)}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => openEdit(liv, 'livrets')} style={{ background: 'transparent', border: '1px solid #252535', borderRadius: 8, color: '#636385', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>✏ Éditer</button>
                      <button onClick={() => deleteItem(liv.id, 'livrets')} style={{ background: 'transparent', border: '1px solid oklch(62% 0.20 25 / 0.4)', borderRadius: 8, color: 'oklch(62% 0.20 25)', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          })()}

          {tab === 'immo' && (() => {
            if (portfolio.immo.properties.length === 0) return <div style={{ color: '#636385', fontSize: 13, padding: '12px 0' }}>Aucun bien</div>
            return portfolio.immo.properties.map(immo => (
              <div key={immo.id} style={{ background: '#1c1c27', borderRadius: 12, padding: '14px 16px', border: '1px solid #252535' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f2' }}>{immo.name}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(65% 0.18 148)' }}>{fmt(immo.value)}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => openEdit(immo, 'immo')} style={{ background: 'transparent', border: '1px solid #252535', borderRadius: 8, color: '#636385', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>✏ Éditer</button>
                      <button onClick={() => deleteItem(immo.id, 'immo')} style={{ background: 'transparent', border: '1px solid oklch(62% 0.20 25 / 0.4)', borderRadius: 8, color: 'oklch(62% 0.20 25)', cursor: 'pointer', padding: '6px 12px', fontSize: 13 }}>🗑</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          })()}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-sheet-wrap">
          <div className="modal-sheet" style={{ ...cardCss, width: 420, borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90dvh', overflowY: 'auto', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <div style={{ width: 36, height: 4, background: '#252535', borderRadius: 2, margin: '0 auto 4px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e8e8f2' }}>
              {(editItem as Position).ticker || (editItem as Livret).name || (editItem as Immo).name ? 'Modifier' : 'Ajouter'} — {TABS.find(t => t.key === editItem._type)?.label}
            </div>
            {(editItem._type === 'pea' || editItem._type === 'crypto') && (<>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Ticker</label>
                <input value={editItem.ticker ?? ''} onChange={e => setEditItem(x => ({ ...x, ticker: e.target.value.toUpperCase() }))} style={inputCss} placeholder="Ex: IWDA.AS, BTC" /></div>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Nom (optionnel)</label>
                <input value={editItem.name ?? ''} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} style={inputCss} /></div>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Quantité</label>
                <input type="number" step="any" value={(editItem as Position).quantity ?? ''} onChange={e => setEditItem(x => ({ ...x, quantity: parseFloat(e.target.value) }))} style={inputCss} /></div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, color: '#636385', fontWeight: 600 }}>
                    Prix d&apos;achat moyen ({editItem.currency === 'USD' ? 'USD' : '€'})
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['EUR', 'USD'] as const).map(cur => (
                      <button key={cur} type="button"
                        onClick={() => setEditItem(x => ({ ...x, currency: cur }))}
                        style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                          background: (editItem.currency ?? 'EUR') === cur ? 'oklch(63% 0.19 250)' : '#1c1c27',
                          border: `1px solid ${(editItem.currency ?? 'EUR') === cur ? 'oklch(63% 0.19 250)' : '#252535'}`,
                          color: (editItem.currency ?? 'EUR') === cur ? '#fff' : '#636385' }}>
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="number" step="any" value={(editItem as Position).costPerUnit ?? ''} onChange={e => setEditItem(x => ({ ...x, costPerUnit: parseFloat(e.target.value) }))} style={inputCss} />
                {editItem.currency === 'USD' && (editItem as Position).costPerUnit > 0 && (() => {
                  const rate = (editItem as Position).purchaseEurUsd ?? usdToEur
                  return (
                    <div style={{ fontSize: 11, color: '#636385', marginTop: 5 }}>
                      ≈ {fmt((editItem as Position).costPerUnit * rate)} au taux 1 USD = {rate.toFixed(4)} €
                      {(editItem as Position).purchaseEurUsd && <span style={{ color: 'oklch(65% 0.18 148)', marginLeft: 6 }}>taux historique</span>}
                    </div>
                  )
                })()}
              </div>
              {/* Date d'achat — pour récupérer le taux EUR/USD historique */}
              {editItem.currency === 'USD' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, color: '#636385', fontWeight: 600 }}>Date d&apos;achat</label>
                    {(editItem as Position).purchaseEurUsd && (
                      <span style={{ fontSize: 11, color: 'oklch(65% 0.18 148)' }}>
                        1 USD = {((editItem as Position).purchaseEurUsd!).toFixed(4)} € ce jour-là
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="date" value={(editItem as Position).purchaseDate ?? ''}
                      onChange={e => setEditItem(x => ({ ...x, purchaseDate: e.target.value, purchaseEurUsd: undefined }))}
                      style={{ ...inputCss, flex: 1 }} />
                    <button type="button" disabled={!(editItem as Position).purchaseDate || fetchingRate}
                      onClick={() => fetchHistoricalRate((editItem as Position).purchaseDate!)}
                      style={{ padding: '0 14px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                        background: 'oklch(63% 0.19 250 / 0.15)', border: '1px solid oklch(63% 0.19 250 / 0.4)', color: 'oklch(63% 0.19 250)',
                        opacity: !(editItem as Position).purchaseDate || fetchingRate ? 0.5 : 1 }}>
                      {fetchingRate ? '…' : 'Récupérer taux'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#636385', marginTop: 4 }}>
                    Cliquez pour récupérer le taux EUR/USD exact de ce jour via Yahoo Finance
                  </div>
                </div>
              )}
            </>)}
            {editItem._type === 'livrets' && (<>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Nom du compte</label>
                <input value={editItem.name ?? ''} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} style={inputCss} placeholder="Livret A, LDD…" /></div>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Taux (%)</label>
                <input type="number" step="0.01" value={(editItem as Livret).rate ?? ''} onChange={e => setEditItem(x => ({ ...x, rate: parseFloat(e.target.value) }))} style={inputCss} /></div>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Solde (€)</label>
                <input type="number" step="0.01" value={(editItem as Livret).solde ?? ''} onChange={e => setEditItem(x => ({ ...x, solde: parseFloat(e.target.value) }))} style={inputCss} /></div>
            </>)}
            {editItem._type === 'immo' && (<>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Nom du bien</label>
                <input value={editItem.name ?? ''} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} style={inputCss} placeholder="Appartement, maison…" /></div>
              <div><label style={{ fontSize: 12, color: '#636385', display: 'block', marginBottom: 6, fontWeight: 600 }}>Valeur estimée (€)</label>
                <input type="number" step="1000" value={(editItem as Immo).value ?? ''} onChange={e => setEditItem(x => ({ ...x, value: parseFloat(e.target.value) }))} style={inputCss} /></div>
            </>)}
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
