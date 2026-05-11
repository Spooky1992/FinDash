'use client'
import { useState, useMemo, useRef } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, currentMonthKey, addMonths, monthLabel, resolveBudget, calcSurplus, cardCss, inputCss, btnCss } from '@/lib/utils'

// ── Projection chart ──────────────────────────────────────────────────────────
function ProjectionChart({ solde, surplus, budget, monthPlans }: {
  solde: number; surplus: number
  budget: ReturnType<typeof useAppData>['budget']
  monthPlans: ReturnType<typeof useAppData>['monthPlans']
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const now = currentMonthKey()
  const months = 13

  const points = useMemo(() => {
    let cur = solde
    return Array.from({ length: months }, (_, i) => {
      const key = addMonths(now, i)
      const s = calcSurplus(resolveBudget(budget, monthPlans, key))
      cur += s
      return { key, val: cur, surplus: s }
    })
  }, [solde, budget, monthPlans, now])

  const allVals = [solde, ...points.map(p => p.val)]
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const range = max - min || 1
  const W = 800, H = 200, padL = 60, padR = 20, padT = 20, padB = 36

  const allPoints = [{ key: 'now', val: solde, surplus: 0 }, ...points]
  const px = (i: number) => padL + (i / (allPoints.length - 1)) * (W - padL - padR)
  const py = (v: number) => padT + ((max - v) / range) * (H - padT - padB)

  const path = allPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.val).toFixed(1)}`).join(' ')
  const area = `${path} L${px(allPoints.length - 1).toFixed(1)},${H - padB} L${px(0).toFixed(1)},${H - padB}Z`

  const color = 'oklch(63% 0.19 250)'
  const hov = hovIdx !== null ? allPoints[hovIdx] : null

  // Y-axis labels
  const yTicks = 4
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => min + (i / yTicks) * range)

  return (
    <div>
      {hov && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>Mois</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>{hov.key === 'now' ? 'Maintenant' : monthLabel(hov.key)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>Solde prévu</div>
            <div style={{ fontSize: 13, fontWeight: 600, color }}>{ fmt(hov.val)}</div>
          </div>
          {hov.surplus !== 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>Surplus</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: hov.surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                {hov.surplus >= 0 ? '+' : ''}{fmt(hov.surplus)}
              </div>
            </div>
          )}
        </div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseLeave={() => setHovIdx(null)}
        onMouseMove={e => {
          const rect = svgRef.current?.getBoundingClientRect()
          if (!rect) return
          const svgX = ((e.clientX - rect.left) / rect.width) * W
          const idx = Math.round((svgX - padL) / (W - padL - padR) * (allPoints.length - 1))
          setHovIdx(Math.max(0, Math.min(allPoints.length - 1, idx)))
        }}>
        <defs>
          <linearGradient id="proj-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Gridlines + Y labels */}
        {yLabels.map((v, i) => {
          const y = py(v)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1c1c27" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#636385" fontFamily="Inter, sans-serif">
                {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : Math.round(v)} €
              </text>
            </g>
          )
        })}
        {/* Zero line */}
        {min < 0 && max > 0 && (
          <line x1={padL} y1={py(0)} x2={W - padR} y2={py(0)} stroke="#636385" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        )}
        <path d={area} fill="url(#proj-grad)" />
        <path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {/* Dots at each month */}
        {allPoints.map((p, i) => (
          <circle key={i} cx={px(i)} cy={py(p.val)} r={3} fill={color} opacity={hovIdx === i ? 1 : 0.4} />
        ))}
        {/* X labels */}
        {allPoints.map((p, i) => i % 2 === 0 && (
          <text key={i} x={px(i)} y={H - padB + 16} textAnchor="middle" fontSize={9} fill="#636385" fontFamily="Inter, sans-serif">
            {p.key === 'now' ? 'Auj.' : monthLabel(p.key).slice(0, 3)}
          </text>
        ))}
        {/* Hover crosshair */}
        {hovIdx !== null && (
          <>
            <line x1={px(hovIdx)} y1={padT} x2={px(hovIdx)} y2={H - padB} stroke="#636385" strokeWidth={1} strokeDasharray="4 3" />
            <circle cx={px(hovIdx)} cy={py(allPoints[hovIdx].val)} r={5} fill={color} stroke="#13131b" strokeWidth={2} />
          </>
        )}
      </svg>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function Calendar({ transactions }: { transactions: ReturnType<typeof useAppData>['transactions'] }) {
  const [calMonth, setCalMonth] = useState<string>(currentMonthKey())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const [cy, cm] = calMonth.split('-').map(Number)
  const firstDayOfWeek = (new Date(cy, cm - 1, 1).getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const today = new Date()
  const isCurrentMonth = calMonth === currentMonthKey()

  const txByDay = useMemo(() => {
    const map: Record<number, typeof transactions> = {}
    transactions.filter(t => t.date.startsWith(calMonth)).forEach(t => {
      const d = parseInt(t.date.slice(8))
      map[d] = [...(map[d] ?? []), t]
    })
    return map
  }, [transactions, calMonth])

  const dayTotals = useMemo(() => {
    const map: Record<number, { income: number; expense: number }> = {}
    for (const [d, txs] of Object.entries(txByDay)) {
      map[+d] = {
        income:  txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: txs.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0),
      }
    }
    return map
  }, [txByDay])

  return (
    <div style={cardCss}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>Calendrier des transactions</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setCalMonth(addMonths(calMonth, -1)); setSelectedDay(null) }}
            style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', minWidth: 90, textAlign: 'center' }}>{monthLabel(calMonth)}</span>
          <button onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null) }}
            style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>›</button>
        </div>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#636385', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const txs = txByDay[day] ?? []
          const totals = dayTotals[day]
          const isToday = isCurrentMonth && today.getDate() === day
          const isSelected = selectedDay === day
          const hasIncome  = totals && totals.income > 0
          const hasExpense = totals && totals.expense > 0

          return (
            <div key={day}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              style={{
                borderRadius: 10, padding: '6px 4px', cursor: txs.length > 0 ? 'pointer' : 'default', minHeight: 64,
                background: isSelected ? 'oklch(63% 0.19 250 / 0.15)' : isToday ? '#1c1c27' : 'transparent',
                border: `1px solid ${isSelected ? 'oklch(63% 0.19 250 / 0.6)' : isToday ? 'oklch(63% 0.19 250 / 0.4)' : '#1c1c27'}`,
                transition: 'background 0.15s',
              }}>
              <div style={{ textAlign: 'right', fontSize: 11, fontWeight: isToday ? 700 : 400,
                color: isToday ? 'oklch(63% 0.19 250)' : txs.length > 0 ? '#e8e8f2' : '#3a3a50',
                marginBottom: 4 }}>{day}</div>
              {/* Mini transaction dots */}
              {txs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {txs.slice(0, 3).map(tx => (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'saving' ? 'oklch(63% 0.19 250)' : 'oklch(62% 0.20 25)' }} />
                      <span style={{ fontSize: 9, color: '#636385', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {tx.label}
                      </span>
                    </div>
                  ))}
                  {txs.length > 3 && <div style={{ fontSize: 8, color: '#636385', paddingLeft: 8 }}>+{txs.length - 3} autres</div>}
                </div>
              )}
              {/* Totals */}
              {totals && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {hasIncome  && <div style={{ fontSize: 9, color: 'oklch(65% 0.18 148)', fontWeight: 600, textAlign: 'right' }}>+{totals.income.toLocaleString('fr-FR')} €</div>}
                  {hasExpense && <div style={{ fontSize: 9, color: 'oklch(62% 0.20 25)',  fontWeight: 600, textAlign: 'right' }}>-{totals.expense.toLocaleString('fr-FR')} €</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && txByDay[selectedDay] && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: '#1c1c27', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f2', marginBottom: 10 }}>
            {selectedDay} {monthLabel(calMonth)}
            <span style={{ color: '#636385', fontWeight: 400, marginLeft: 8 }}>{txByDay[selectedDay].length} transaction{txByDay[selectedDay].length > 1 ? 's' : ''}</span>
          </div>
          {txByDay[selectedDay].map(tx => (
            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #252535' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'saving' ? 'oklch(63% 0.19 250)' : 'oklch(62% 0.20 25)' }} />
                <div>
                  <div style={{ fontSize: 13, color: '#e8e8f2' }}>{tx.label}</div>
                  {tx.category && <div style={{ fontSize: 10, color: '#636385' }}>{tx.category}</div>}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700,
                color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'saving' ? 'oklch(63% 0.19 250)' : 'oklch(62% 0.20 25)' }}>
                {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
              </span>
            </div>
          ))}
          {/* Day summary */}
          {(() => {
            const totals = dayTotals[selectedDay]!
            const net = totals.income - totals.expense
            return (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 8, fontSize: 12 }}>
                {totals.income > 0  && <span style={{ color: 'oklch(65% 0.18 148)' }}>+{fmt(totals.income)}</span>}
                {totals.expense > 0 && <span style={{ color: 'oklch(62% 0.20 25)' }}>-{fmt(totals.expense)}</span>}
                <span style={{ fontWeight: 700, color: net >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                  Net : {net >= 0 ? '+' : ''}{fmt(net)}
                </span>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ComptePage() {
  const { compte, transactions, budget, monthPlans, updateSolde, addHistorique, deleteHistorique, loading } = useAppData()
  const [editingSolde, setEditingSolde] = useState(false)
  const [newSolde, setNewSolde] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')

  const curKey  = currentMonthKey()
  const resolved = useMemo(() => resolveBudget(budget, monthPlans, curKey), [budget, monthPlans, curKey])
  const surplus  = calcSurplus(resolved)
  const alreadyApplied = compte.derniereMaj === curKey

  async function applySolde() {
    const val = parseFloat(newSolde)
    if (isNaN(val)) return
    await updateSolde(val)
    setEditingSolde(false)
  }

  async function applyMonth() {
    const rev = resolved.incomes.reduce((s, i) => s + i.amount, 0)
    const dep = resolved.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
    const epa = resolved.savings.reduce((s, i) => s + i.amount, 0)
    const avant = compte.solde
    // On soustrait dépenses + épargne uniquement (les revenus sont saisis manuellement via le solde réel)
    const delta = -(dep + epa)
    const apres = avant + delta
    await updateSolde(apres, curKey)
    await addHistorique({ key: curKey, label: monthLabel(curKey), avant, apres, revenus: rev, depenses: dep, epargne: epa, delta })
  }

  const sortedTx = [...transactions].sort((a, b) => {
    const v = sortBy === 'date' ? a.date.localeCompare(b.date) : a.amount - b.amount
    return sortDir === 'asc' ? v : -v
  })

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Mon Compte</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Solde courant et projection mensuelle</p>
      </div>

      {/* Solde + projection (full width) */}
      <div className="grid-2-narrow">
        {/* Solde card */}
        <div style={{ ...cardCss, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#636385', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>SOLDE ACTUEL</div>
            {editingSolde ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" step="0.01" value={newSolde} onChange={e => setNewSolde(e.target.value)}
                  style={{ ...inputCss, fontSize: 18, fontWeight: 700, flex: 1 }} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') applySolde(); if (e.key === 'Escape') setEditingSolde(false) }} />
                <button onClick={applySolde} style={btnCss()}>✓</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => { setNewSolde(String(compte.solde)); setEditingSolde(true) }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: compte.solde >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                  {fmt(compte.solde)}
                </span>
                <span style={{ fontSize: 12, color: '#3a3a50' }}>✏</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Surplus mensuel', val: surplus, color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' },
              { label: 'Dans 6 mois',  val: (() => { let c = compte.solde; for (let i = 0; i < 6;  i++) { const k = addMonths(curKey, i); c += calcSurplus(resolveBudget(budget, monthPlans, k)) } return c })(), color: 'oklch(63% 0.19 250)' },
              { label: 'Dans 12 mois', val: (() => { let c = compte.solde; for (let i = 0; i < 12; i++) { const k = addMonths(curKey, i); c += calcSurplus(resolveBudget(budget, monthPlans, k)) } return c })(), color: 'oklch(63% 0.19 250)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#636385' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{fmt(r.val)}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #252535', paddingTop: 12 }}>
            {alreadyApplied ? (
              <div style={{ fontSize: 11, color: '#636385', textAlign: 'center' }}>✓ {monthLabel(curKey)} déjà appliqué</div>
            ) : (
              <button onClick={applyMonth} style={{ ...btnCss(), width: '100%', fontSize: 12 }}>
                Déduire dépenses {monthLabel(curKey)}
              </button>
            )}
          </div>
        </div>

        {/* Projection chart */}
        <div style={cardCss}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Projection 13 mois</span>
            <span style={{ fontSize: 12, color: 'oklch(63% 0.19 250)', fontWeight: 600 }}>
              {fmt((() => { let c = compte.solde; for (let i = 0; i < 13; i++) { const k = addMonths(curKey, i); c += calcSurplus(resolveBudget(budget, monthPlans, k)) } return c })())} dans 13 mois
            </span>
          </div>
          <ProjectionChart solde={compte.solde} surplus={surplus} budget={budget} monthPlans={monthPlans} />
        </div>
      </div>

      {/* Calendrier pleine largeur */}
      <Calendar transactions={transactions} />

      {/* Historique mensuel */}
      {compte.historique.length > 0 && (
        <div style={cardCss}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Historique mensuel</div>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
            <thead><tr>
              {['Mois', 'Avant', 'Revenus', 'Dépenses', 'Épargne', 'Après', 'Δ', ''].map((h, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 5 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {compte.historique.map(h => (
                <tr key={h.key} style={{ borderBottom: '1px solid #1c1c27' }}>
                  <td style={{ padding: '8px 10px', fontSize: 13, color: '#e8e8f2', fontWeight: 600 }}>{h.label}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#636385' }}>{fmt(h.avant)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: 'oklch(65% 0.18 148)' }}>+{fmt(h.revenus)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: 'oklch(62% 0.20 25)' }}>-{fmt(h.depenses)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: 'oklch(63% 0.19 250)' }}>{fmt(h.epargne)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#e8e8f2', textAlign: 'right', fontWeight: 600 }}>{fmt(h.apres)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right', fontWeight: 600, color: h.delta >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                    {h.delta >= 0 ? '+' : ''}{fmt(h.delta)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <button onClick={() => deleteHistorique(h.key)} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Transactions */}
      <div style={cardCss}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Historique transactions</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['date', 'amount'] as const).map(col => (
              <button key={col} onClick={() => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc') }}}
                style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter',
                  background: sortBy === col ? 'oklch(63% 0.19 250)' : '#1c1c27',
                  border: `1px solid ${sortBy === col ? 'oklch(63% 0.19 250)' : '#252535'}`,
                  color: sortBy === col ? '#fff' : '#636385' }}>
                {col === 'date' ? 'Date' : 'Montant'} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead><tr>
            {['Date', 'Libellé', 'Catégorie', 'Type', 'Montant'].map((h, i) => (
              <th key={i} style={{ padding: '6px 10px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {sortedTx.slice(0, 50).map(tx => (
              <tr key={tx.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                <td style={{ padding: '8px 10px', fontSize: 12, color: '#636385' }}>{tx.date}</td>
                <td style={{ padding: '8px 10px', fontSize: 13, color: '#e8e8f2' }}>{tx.label}</td>
                <td style={{ padding: '8px 10px', fontSize: 12, color: '#636385' }}>{tx.category ?? '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
                    background: tx.type === 'income' ? 'oklch(65% 0.18 148 / 0.15)' : tx.type === 'saving' ? 'oklch(63% 0.19 250 / 0.15)' : 'oklch(62% 0.20 25 / 0.15)',
                    color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'saving' ? 'oklch(63% 0.19 250)' : 'oklch(62% 0.20 25)' }}>
                    {tx.type === 'income' ? 'Revenu' : tx.type === 'saving' ? 'Épargne' : tx.type === 'invest' ? 'Invest.' : 'Dépense'}
                  </span>
                </td>
                <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right',
                  color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'saving' ? 'oklch(63% 0.19 250)' : '#e8e8f2' }}>
                  {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                </td>
              </tr>
            ))}
            {sortedTx.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#636385', fontSize: 13 }}>Aucune transaction</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
