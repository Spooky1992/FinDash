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
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Partial<Position & Livret & Immo> & { _type?: Tab }>({})

  useEffect(() => {
    if (loading) return
    const fetchAll = async () => {
      setLoadingPrices(true)
      const newPrices: Record<string, number> = {}
      await Promise.all([
        ...portfolio.pea.positions.map(async p => { const price = await fetchStockPrice(p.ticker); if (price) newPrices[p.ticker] = price }),
        ...portfolio.crypto.positions.map(async p => { const id = KNOWN_COINS[p.ticker.toUpperCase()] ?? p.ticker.toLowerCase(); const price = await fetchCryptoPrice(id); if (price) newPrices[p.ticker] = price }),
      ])
      setPrices(newPrices)
      setLoadingPrices(false)
    }
    fetchAll()
  }, [loading, portfolio.pea.positions, portfolio.crypto.positions])

  function openAdd() { setEditItem({ _type: tab }); setShowForm(true) }
  function openEdit(item: Position | Livret | Immo, t: Tab) { setEditItem({ ...item, _type: t }); setShowForm(true) }

  async function saveItem() {
    const p: Portfolio = JSON.parse(JSON.stringify(portfolio))
    const t = editItem._type ?? tab
    if (t === 'pea' || t === 'crypto') {
      const pos: Position = { id: (editItem as Position).id || uid(), ticker: editItem.ticker || '', quantity: Number(editItem.quantity) || 0, costPerUnit: Number(editItem.costPerUnit) || 0, name: editItem.name }
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

  const peaTotal     = portfolio.pea.positions.reduce((s, p) => s + p.quantity * (prices[p.ticker] ?? p.price ?? p.costPerUnit), 0)
  const cryptoTotal  = portfolio.crypto.positions.reduce((s, p) => s + p.quantity * (prices[p.ticker] ?? p.price ?? p.costPerUnit), 0)
  const livretsTotal = portfolio.livrets.accounts.reduce((s, l) => s + l.solde, 0)
  const immoTotal    = portfolio.immo.properties.reduce((s, i) => s + i.value, 0)
  const grandTotal   = peaTotal + cryptoTotal + livretsTotal + immoTotal

  const TABS: { key: Tab; label: string; total: number }[] = [
    { key: 'pea',     label: 'Actions & Fonds', total: peaTotal },
    { key: 'crypto',  label: 'Crypto',          total: cryptoTotal },
    { key: 'livrets', label: 'Livrets',          total: livretsTotal },
    { key: 'immo',    label: 'Immobilier',       total: immoTotal },
  ]

  // Treemap : une tuile par catégorie (pas par actif individuel)
  const treemapItems: TreemapItem[] = TABS
    .filter(t => t.total > 0)
    .map(t => ({ label: t.label, value: t.total, color: CAT_COLORS[t.key], sub: `${grandTotal > 0 ? ((t.total / grandTotal) * 100).toFixed(1) : 0}%` }))

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
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

      {/* Table */}
      <div style={cardCss}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>{TABS.find(t => t.key === tab)?.label}</span>
          <button onClick={openAdd} style={btnCss()}>+ Ajouter</button>
        </div>

        {(tab === 'pea' || tab === 'crypto') && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Ticker', 'Nom', 'Qté', 'PRU', 'Prix live', 'Valeur', 'P&L', ''].map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(tab === 'pea' ? portfolio.pea.positions : portfolio.crypto.positions).map(pos => {
                const live   = prices[pos.ticker] ?? pos.price ?? pos.costPerUnit
                const value  = pos.quantity * live
                const cost   = pos.quantity * pos.costPerUnit
                const pnl    = value - cost
                const pnlPct = cost > 0 ? ((value - cost) / cost) * 100 : 0
                const col    = tab === 'pea' ? CAT_COLORS.pea : CAT_COLORS.crypto
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
                    <td style={{ padding: '10px 10px', fontSize: 12, color: '#636385' }}>{fmt(pos.costPerUnit)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, color: prices[pos.ticker] ? '#e8e8f2' : '#636385', textAlign: 'right' }}>{fmt(live)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: '#e8e8f2', textAlign: 'right' }}>{fmt(value)}</td>
                    <td style={{ padding: '10px 10px', fontSize: 12, textAlign: 'right', color: pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>
                      {pnl >= 0 ? '+' : ''}{fmt(pnl)} ({fmtPct(pnlPct)})
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      <button onClick={() => openEdit(pos, tab)} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', marginRight: 4 }}>✏</button>
                      <button onClick={() => deleteItem(pos.id, tab)} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>🗑</button>
                    </td>
                  </tr>
                )
              })}
              {(tab === 'pea' ? portfolio.pea.positions : portfolio.crypto.positions).length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#636385', fontSize: 13 }}>Aucune position</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'livrets' && (
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
                    <button onClick={() => openEdit(liv, 'livrets')} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', marginRight: 4 }}>✏</button>
                    <button onClick={() => deleteItem(liv.id, 'livrets')} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>🗑</button>
                  </td>
                </tr>
              ))}
              {portfolio.livrets.accounts.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: '#636385' }}>Aucun livret</td></tr>}
            </tbody>
          </table>
        )}

        {tab === 'immo' && (
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
                    <button onClick={() => openEdit(immo, 'immo')} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', marginRight: 4 }}>✏</button>
                    <button onClick={() => deleteItem(immo.id, 'immo')} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>🗑</button>
                  </td>
                </tr>
              ))}
              {portfolio.immo.properties.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: '#636385' }}>Aucun bien immobilier</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ ...cardCss, width: 400, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2', marginBottom: 4 }}>
              {(editItem as Position).ticker || (editItem as Livret).name || (editItem as Immo).name ? 'Modifier' : 'Ajouter'} — {TABS.find(t => t.key === editItem._type)?.label}
            </div>
            {(editItem._type === 'pea' || editItem._type === 'crypto') && (<>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Ticker</label>
                <input value={editItem.ticker ?? ''} onChange={e => setEditItem(x => ({ ...x, ticker: e.target.value.toUpperCase() }))} style={inputCss} placeholder="Ex: IWDA.AS, BTC" /></div>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Nom (optionnel)</label>
                <input value={editItem.name ?? ''} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} style={inputCss} /></div>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Quantité</label>
                <input type="number" step="any" value={(editItem as Position).quantity ?? ''} onChange={e => setEditItem(x => ({ ...x, quantity: parseFloat(e.target.value) }))} style={inputCss} /></div>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Prix d&apos;achat moyen (€)</label>
                <input type="number" step="any" value={(editItem as Position).costPerUnit ?? ''} onChange={e => setEditItem(x => ({ ...x, costPerUnit: parseFloat(e.target.value) }))} style={inputCss} /></div>
            </>)}
            {editItem._type === 'livrets' && (<>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Nom du compte</label>
                <input value={editItem.name ?? ''} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} style={inputCss} placeholder="Livret A, LDD…" /></div>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Taux (%)</label>
                <input type="number" step="0.01" value={(editItem as Livret).rate ?? ''} onChange={e => setEditItem(x => ({ ...x, rate: parseFloat(e.target.value) }))} style={inputCss} /></div>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Solde (€)</label>
                <input type="number" step="0.01" value={(editItem as Livret).solde ?? ''} onChange={e => setEditItem(x => ({ ...x, solde: parseFloat(e.target.value) }))} style={inputCss} /></div>
            </>)}
            {editItem._type === 'immo' && (<>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Nom du bien</label>
                <input value={editItem.name ?? ''} onChange={e => setEditItem(x => ({ ...x, name: e.target.value }))} style={inputCss} placeholder="Appartement, maison…" /></div>
              <div><label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Valeur estimée (€)</label>
                <input type="number" step="1000" value={(editItem as Immo).value ?? ''} onChange={e => setEditItem(x => ({ ...x, value: parseFloat(e.target.value) }))} style={inputCss} /></div>
            </>)}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => { setShowForm(false); setEditItem({}) }} style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>Annuler</button>
              <button onClick={saveItem} style={btnCss()}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
