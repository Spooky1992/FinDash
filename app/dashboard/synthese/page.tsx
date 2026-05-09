'use client'
import { useMemo } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, fmtPct, currentMonthKey, addMonths, monthLabel, resolveBudget, calcSurplus, cardCss } from '@/lib/utils'
import { Treemap, TreemapLegend, type TreemapItem } from '@/components/Treemap'

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

function LineChart({ points, color = 'oklch(63% 0.19 250)' }: { points: number[]; color?: string }) {
  if (points.length < 2) return null
  const min = Math.min(...points), max = Math.max(...points)
  const range = max - min || 1
  const W = 300, H = 80, pad = 10
  const px = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2)
  const py = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2)
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(v)}`).join(' ')
  const area = `${path} L${px(points.length - 1)},${H} L${px(0)},${H}Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
      <defs>
        <linearGradient id="lg-synth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lg-synth)" />
      <path d={path} stroke={color} strokeWidth={2} fill="none" />
    </svg>
  )
}

export default function SynthesePage() {
  const { budget, monthPlans, compte, transactions, portfolio, loading } = useAppData()

  const curKey = currentMonthKey()

  // Budget actuel résolu
  const resolved = useMemo(() => resolveBudget(budget, monthPlans, curKey), [budget, monthPlans, curKey])
  const totalRevenu   = resolved.incomes.reduce((s, i) => s + i.amount, 0)
  const totalDepense  = resolved.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const totalEpargne  = resolved.savings.reduce((s, i) => s + i.amount, 0)
  const surplus       = totalRevenu - totalDepense - totalEpargne
  const tauxEpargne   = totalRevenu > 0 ? (totalEpargne / totalRevenu) * 100 : 0

  // Patrimoine total
  const peaTotal      = portfolio.pea.positions.reduce((s, p) => s + p.quantity * (p.price ?? p.costPerUnit), 0)
  const cryptoTotal   = portfolio.crypto.positions.reduce((s, p) => s + p.quantity * (p.price ?? p.costPerUnit), 0)
  const livretsTotal  = portfolio.livrets.accounts.reduce((s, l) => s + l.solde, 0)
  const immoTotal     = portfolio.immo.properties.reduce((s, i) => s + i.value, 0)
  const patrimoineTotal = peaTotal + cryptoTotal + livretsTotal + immoTotal + compte.solde

  // Dépenses par catégorie (ce mois)
  const depCat = resolved.expenses.map(cat => ({
    label: cat.label,
    value: cat.items.reduce((s, i) => s + i.amount, 0),
  })).filter(x => x.value > 0).sort((a, b) => b.value - a.value)

  // Projection solde (6 mois)
  const projPoints = useMemo(() => {
    let s = compte.solde
    return Array.from({ length: 6 }, (_, i) => {
      s += calcSurplus(resolveBudget(budget, monthPlans, addMonths(curKey, i)))
      return s
    })
  }, [budget, monthPlans, curKey, compte.solde])

  // Transactions récentes (30 derniers jours)
  const recentTx = transactions.slice(0, 10)

  // Allocation patrimoine (treemap)
  const allocItems: TreemapItem[] = [
    { label: 'Liquidités',  value: compte.solde,  color: 'oklch(63% 0.19 250)' },
    { label: 'Actions/ETF', value: peaTotal,       color: 'oklch(65% 0.18 148)' },
    { label: 'Crypto',      value: cryptoTotal,    color: 'oklch(68% 0.17 55)'  },
    { label: 'Livrets',     value: livretsTotal,   color: 'oklch(65% 0.16 185)' },
    { label: 'Immobilier',  value: immoTotal,      color: 'oklch(63% 0.19 290)' },
  ].filter(s => s.value > 0).map(s => ({ ...s, sub: `${patrimoineTotal > 0 ? ((s.value / patrimoineTotal) * 100).toFixed(1) : 0}%` }))

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Synthèse</h1>

      {/* KPIs principaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[
          { label: 'Patrimoine',   val: patrimoineTotal, color: 'oklch(65% 0.18 148)', fmt: true },
          { label: 'Solde compte', val: compte.solde,    color: compte.solde >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fmt: true },
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Allocation */}
        <div style={cardCss}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 12 }}>Allocation patrimoine</div>
          {allocItems.length > 0 ? (
            <>
              <Treemap items={allocItems} height={180} />
              <div style={{ marginTop: 10 }}><TreemapLegend items={allocItems} /></div>
            </>
          ) : (
            <div style={{ color: '#636385', fontSize: 12 }}>Aucune donnée</div>
          )}
        </div>

        {/* Projection */}
        <div style={cardCss}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Projection solde</span>
            <span style={{ fontSize: 12, color: 'oklch(65% 0.18 148)', fontWeight: 600 }}>{fmt(projPoints[projPoints.length - 1])}</span>
          </div>
          <LineChart points={[compte.solde, ...projPoints]} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {projPoints.slice(0, 3).map((v, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#636385' }}>{monthLabel(addMonths(curKey, i + 1)).slice(0, 3)}</div>
                <div style={{ fontSize: 11, color: '#e8e8f2', fontWeight: 600 }}>{fmt(v)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
