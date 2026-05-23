'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, currentMonthKey, addMonths, monthLabel, resolveBudget, calcSurplus, cardCss } from '@/lib/utils'
import { Treemap, TreemapLegend, type TreemapItem } from '@/components/Treemap'

const KNOWN_COINS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano',
  XRP: 'ripple', DOT: 'polkadot', AVAX: 'avalanche-2', MATIC: 'matic-network',
}

function VerticalBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  if (data.length === 0) return <div style={{ color: '#636385', fontSize: 12 }}>Aucune dépense configurée</div>
  const H = 160, barW = 44, gap = 14, padT = 16, padB = 28
  const max = Math.max(...data.map(d => d.value), 1)
  const W = data.length * (barW + gap) + gap
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {data.map((d, i) => {
        const bh = ((d.value / max) * (H - padT - padB))
        const bx = gap + i * (barW + gap)
        const by = padT + (H - padT - padB) - bh
        return (
          <g key={d.label}>
            <rect x={bx} y={by} width={barW} height={bh} rx={5} fill={d.color} fillOpacity={0.85} />
            <text x={bx + barW / 2} y={H - 8} textAnchor="middle" fontSize={9} fill="#636385" fontFamily="Inter, sans-serif">
              {d.label.length > 7 ? d.label.slice(0, 6) + '…' : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ProjectionChart({ points, labels, color = 'oklch(63% 0.19 250)' }: {
  points: number[]
  labels: string[]
  color?: string
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  if (points.length < 2) return null

  const W = 500, H = 140, padL = 52, padR = 12, padT = 14, padB = 28
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1

  const px = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR)
  const py = (v: number) => padT + ((max - v) / range) * (H - padT - padB)

  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const area = `${path} L${px(points.length - 1).toFixed(1)},${H - padB} L${px(0).toFixed(1)},${H - padB}Z`

  const yTicks = 3
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => min + (i / yTicks) * range)

  const hov = hovIdx !== null ? { val: points[hovIdx], label: labels[hovIdx] } : null

  return (
    <div>
      {/* Tooltip */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 10, minHeight: 36, alignItems: 'center' }}>
        {hov ? (
          <>
            <div>
              <div style={{ fontSize: 10, color: '#636385', marginBottom: 1 }}>Mois</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f2' }}>{hov.label}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#636385', marginBottom: 1 }}>Solde prévu</div>
              <div style={{ fontSize: 14, fontWeight: 700, color }}>{fmt(hov.val)}</div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: '#636385' }}>Survolez le graphe pour voir le détail</div>
        )}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block', cursor: 'crosshair' }}
        onMouseLeave={() => setHovIdx(null)}
        onMouseMove={e => {
          const rect = svgRef.current?.getBoundingClientRect()
          if (!rect) return
          const svgX = ((e.clientX - rect.left) / rect.width) * W
          const idx = Math.round((svgX - padL) / (W - padL - padR) * (points.length - 1))
          setHovIdx(Math.max(0, Math.min(points.length - 1, idx)))
        }}>
        <defs>
          <linearGradient id="lg-synth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Gridlines + Y labels */}
        {yLabels.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={py(v)} x2={W - padR} y2={py(v)} stroke="#1c1c27" strokeWidth={1} />
            <text x={padL - 5} y={py(v) + 4} textAnchor="end" fontSize={8} fill="#636385" fontFamily="Inter, sans-serif">
              {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : Math.round(v)}€
            </text>
          </g>
        ))}
        <path d={area} fill="url(#lg-synth)" />
        <path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
        {/* Dots + X labels */}
        {points.map((v, i) => (
          <g key={i}>
            <circle cx={px(i)} cy={py(v)} r={hovIdx === i ? 4.5 : 2.5} fill={color} opacity={hovIdx === i ? 1 : 0.5} />
            <text x={px(i)} y={H - padB + 14} textAnchor="middle" fontSize={8} fill={hovIdx === i ? '#e8e8f2' : '#636385'} fontFamily="Inter, sans-serif">
              {labels[i].slice(0, 3)}
            </text>
          </g>
        ))}
        {/* Crosshair */}
        {hovIdx !== null && (
          <line x1={px(hovIdx)} y1={padT} x2={px(hovIdx)} y2={H - padB} stroke="#636385" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        )}
      </svg>
    </div>
  )
}

export default function SynthesePage() {
  const { budget, monthPlans, totalSolde, transactions, portfolio, loading } = useAppData()

  // Live prices
  const [prices, setPrices]               = useState<Record<string, number>>({})
  const [liveCurrencies, setLiveCurrencies] = useState<Record<string, string>>({})
  const [usdToEur, setUsdToEur]           = useState(0.92)
  const [gbpToEur, setGbpToEur]           = useState(1.17)

  const fetchPrices = useCallback(async () => {
    if (loading) return
    const newPrices: Record<string, number> = {}
    const newCurrencies: Record<string, string> = {}
    await Promise.all([
      ...portfolio.pea.positions.map(async p => {
        try { const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(p.ticker)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = d.currency ?? 'USD' } } catch {}
      }),
      ...portfolio.crypto.positions.map(async p => {
        try { const id = KNOWN_COINS[p.ticker.replace('-EUR', '').toUpperCase()] ?? p.ticker.toLowerCase(); const r = await fetch(`/api/prices/crypto?id=${encodeURIComponent(id)}`); const d = await r.json(); if (d.price) { newPrices[p.ticker] = d.price; newCurrencies[p.ticker] = 'EUR' } } catch {}
      }),
      (async () => { try { const r = await fetch('/api/prices/stock?ticker=EUR%3DX'); const d = await r.json(); if (d.price) setUsdToEur(d.price) } catch {} })(),
      (async () => { try { const r = await fetch('/api/prices/stock?ticker=GBPEUR%3DX'); const d = await r.json(); if (d.price) setGbpToEur(d.price) } catch {} })(),
    ])
    setPrices(newPrices); setLiveCurrencies(newCurrencies)
  }, [loading, portfolio.pea.positions, portfolio.crypto.positions])

  useEffect(() => { fetchPrices() }, [fetchPrices])

  function liveEur(p: { ticker: string; costPerUnit: number; quantity: number }) {
    const raw = prices[p.ticker] ?? p.costPerUnit
    const cur = liveCurrencies[p.ticker] ?? 'USD'
    if (cur === 'EUR') return raw
    if (cur === 'GBp' || cur === 'GBX') return (raw / 100) * gbpToEur
    return raw * usdToEur
  }
  function cpuEur(p: { ticker: string; costPerUnit: number; currency?: string; purchaseEurUsd?: number }) {
    if (p.currency !== 'USD') return p.costPerUnit
    return p.costPerUnit * (p.purchaseEurUsd ?? usdToEur)
  }

  const curKey = currentMonthKey()

  // Budget actuel résolu
  const resolved = useMemo(() => resolveBudget(budget, monthPlans, curKey), [budget, monthPlans, curKey])
  const totalRevenu   = resolved.incomes.reduce((s, i) => s + i.amount, 0)
  const totalDepense  = resolved.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const totalEpargne  = resolved.savings.reduce((s, i) => s + i.amount, 0)
  const surplus       = totalRevenu - totalDepense - totalEpargne
  const tauxEpargne   = totalRevenu > 0 ? (totalEpargne / totalRevenu) * 100 : 0

  // Patrimoine — valeur marché (live) et coût d'achat
  const peaValue      = portfolio.pea.positions.reduce((s, p) => s + p.quantity * liveEur(p), 0)
  const peaCost       = portfolio.pea.positions.reduce((s, p) => s + p.quantity * cpuEur(p as never), 0)
  const cryptoValue   = portfolio.crypto.positions.reduce((s, p) => s + p.quantity * liveEur(p), 0)
  const cryptoCost    = portfolio.crypto.positions.reduce((s, p) => s + p.quantity * cpuEur(p as never), 0)
  const livretsTotal  = portfolio.livrets.accounts.reduce((s, l) => s + l.solde, 0)
  const immoTotal     = portfolio.immo.properties.reduce((s, i) => s + i.value, 0)
  const patrimoineTotal = peaValue + cryptoValue + livretsTotal + immoTotal + totalSolde

  // Dépenses par catégorie (ce mois)
  const depCat = resolved.expenses.map(cat => ({
    label: cat.label,
    value: cat.items.reduce((s, i) => s + i.amount, 0),
  })).filter(x => x.value > 0).sort((a, b) => b.value - a.value)

  // Projection solde (7 points : solde actuel + 6 mois)
  const { projPoints, projLabels } = useMemo(() => {
    let s = totalSolde
    const pts = [s]
    const lbls = ['Auj.']
    for (let i = 0; i < 6; i++) {
      s += calcSurplus(resolveBudget(budget, monthPlans, addMonths(curKey, i)))
      pts.push(s)
      lbls.push(monthLabel(addMonths(curKey, i)))
    }
    return { projPoints: pts, projLabels: lbls }
  }, [budget, monthPlans, curKey, totalSolde])

  // Transactions récentes (30 derniers jours)
  const recentTx = transactions.slice(0, 10)

  // Allocation patrimoine (treemap)
  const allocItems: TreemapItem[] = [
    { label: 'Liquidités',  value: totalSolde, color: 'oklch(63% 0.19 250)' },
    { label: 'Actions/ETF', value: peaValue,      color: 'oklch(65% 0.18 148)' },
    { label: 'Crypto',      value: cryptoValue,   color: 'oklch(68% 0.17 55)'  },
    { label: 'Livrets',     value: livretsTotal,  color: 'oklch(65% 0.16 185)' },
    { label: 'Immobilier',  value: immoTotal,     color: 'oklch(63% 0.19 290)' },
  ].filter(s => s.value > 0).map(s => ({ ...s, sub: `${patrimoineTotal > 0 ? ((s.value / patrimoineTotal) * 100).toFixed(1) : 0}%` }))

  const pricesLoaded = Object.keys(prices).length > 0 || (portfolio.pea.positions.length === 0 && portfolio.crypto.positions.length === 0)

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Synthèse</h1>

      {/* KPIs principaux */}
      <div className="grid-5">
        {[
          { label: 'Patrimoine',   val: patrimoineTotal, color: 'oklch(65% 0.18 148)', fmt: true },
          { label: 'Liquidités',   val: totalSolde,       color: totalSolde >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fmt: true },
          { label: 'Revenus/mois', val: totalRevenu,     color: 'oklch(65% 0.18 148)', fmt: true },
          { label: 'Surplus/mois', val: surplus,         color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fmt: true },
          { label: 'Taux épargne', val: tauxEpargne,     color: 'oklch(63% 0.19 250)', fmt: false },
        ].map(k => (
          <div key={k.label} style={{ ...cardCss, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#636385', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>
              {k.fmt ? fmt(k.val) : k.val.toFixed(1) + '%'}
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Allocation */}
        <div style={cardCss}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 12 }}>Allocation patrimoine</div>
          {allocItems.length > 0 ? (
            <>
              <Treemap items={allocItems} height={180} />
              <div style={{ marginTop: 10 }}><TreemapLegend items={allocItems} /></div>
              {/* Résumé investi vs marché */}
              {(peaValue > 0 || cryptoValue > 0) && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1c1c27', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {peaValue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: '#636385' }}>Actions/ETF — investi</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: '#636385' }}>{fmt(peaCost)}</span>
                        <span style={{ color: 'oklch(65% 0.18 148)', fontWeight: 600 }}>
                          {!pricesLoaded ? '…' : fmt(peaValue)}
                          {pricesLoaded && peaCost > 0 && (
                            <span style={{ fontSize: 11, marginLeft: 4, color: peaValue >= peaCost ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                              ({peaValue >= peaCost ? '+' : ''}{((peaValue - peaCost) / peaCost * 100).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                  {cryptoValue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: '#636385' }}>Crypto — investi</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span style={{ color: '#636385' }}>{fmt(cryptoCost)}</span>
                        <span style={{ color: 'oklch(68% 0.17 55)', fontWeight: 600 }}>
                          {!pricesLoaded ? '…' : fmt(cryptoValue)}
                          {pricesLoaded && cryptoCost > 0 && (
                            <span style={{ fontSize: 11, marginLeft: 4, color: cryptoValue >= cryptoCost ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                              ({cryptoValue >= cryptoCost ? '+' : ''}{((cryptoValue - cryptoCost) / cryptoCost * 100).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#636385', fontSize: 12 }}>Aucune donnée</div>
          )}
        </div>

        {/* Projection */}
        <div style={cardCss}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Projection solde — 6 mois</span>
            <span style={{ fontSize: 13, color: 'oklch(65% 0.18 148)', fontWeight: 700 }}>{fmt(projPoints[projPoints.length - 1])}</span>
          </div>
          <ProjectionChart points={projPoints} labels={projLabels} />
        </div>
      </div>

      <div className="grid-2">
        {/* Dépenses par catégorie */}
        <div style={cardCss}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 12 }}>Dépenses — {monthLabel(curKey)}</div>
          <VerticalBarChart data={depCat.map((d, i) => ({
            ...d,
            color: ['oklch(62% 0.20 25)', 'oklch(68% 0.17 55)', 'oklch(63% 0.19 290)', 'oklch(65% 0.16 185)', 'oklch(63% 0.19 250)'][i % 5],
          }))} />
        </div>

        {/* Transactions récentes */}
        <div style={cardCss}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Dernières transactions</div>
          {recentTx.length === 0
            ? <div style={{ color: '#636385', fontSize: 12 }}>Aucune transaction</div>
            : recentTx.map(tx => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #1c1c27', fontSize: 13 }}>
                <div>
                  <div style={{ color: '#e8e8f2' }}>{tx.label}</div>
                  <div style={{ fontSize: 11, color: '#636385' }}>{tx.date} · {tx.category ?? tx.type}</div>
                </div>
                <span style={{ fontWeight: 600, color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : '#e8e8f2', flexShrink: 0 }}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                </span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Budget résumé */}
      <div style={cardCss}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Budget mensuel — {monthLabel(curKey)}</div>
        <div className="grid-3" style={{ gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 8, fontWeight: 600 }}>REVENUS</div>
            {resolved.incomes.map((inc, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: '#636385' }}>{inc.label}</span>
                <span style={{ color: 'oklch(65% 0.18 148)', fontWeight: 600 }}>{fmt(inc.amount)}</span>
              </div>
            ))}
            {resolved.incomes.length === 0 && <div style={{ color: '#636385', fontSize: 12 }}>—</div>}
            <div style={{ borderTop: '1px solid #252535', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#e8e8f2' }}>Total</span>
              <span style={{ color: 'oklch(65% 0.18 148)' }}>{fmt(totalRevenu)}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 8, fontWeight: 600 }}>DÉPENSES</div>
            {resolved.expenses.map((cat, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: '#636385', fontWeight: 600, marginBottom: 2 }}>{cat.label}</div>
                {cat.items.map((item, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, paddingLeft: 8, fontSize: 12 }}>
                    <span style={{ color: '#636385' }}>{item.label}</span>
                    <span style={{ color: '#e8e8f2' }}>{fmt(item.amount)}</span>
                  </div>
                ))}
              </div>
            ))}
            {resolved.expenses.length === 0 && <div style={{ color: '#636385', fontSize: 12 }}>—</div>}
            <div style={{ borderTop: '1px solid #252535', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#e8e8f2' }}>Total</span>
              <span style={{ color: 'oklch(62% 0.20 25)' }}>{fmt(totalDepense)}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 8, fontWeight: 600 }}>ÉPARGNE</div>
            {resolved.savings.map((sav, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ color: '#636385' }}>{sav.label}</span>
                <span style={{ color: 'oklch(63% 0.19 250)', fontWeight: 600 }}>{fmt(sav.amount)}</span>
              </div>
            ))}
            {resolved.savings.length === 0 && <div style={{ color: '#636385', fontSize: 12 }}>—</div>}
            <div style={{ borderTop: '1px solid #252535', marginTop: 8, paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span style={{ color: '#e8e8f2' }}>Total épargne</span>
                <span style={{ color: 'oklch(63% 0.19 250)' }}>{fmt(totalEpargne)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: '#e8e8f2' }}>Surplus</span>
                <span style={{ color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{surplus >= 0 ? '+' : ''}{fmt(surplus)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
