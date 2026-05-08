'use client'
import { useState, useMemo } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, currentMonthKey, addMonths, monthLabel, resolveBudget, calcSurplus, cardCss, inputCss, btnCss } from '@/lib/utils'

function ProjectionChart({ solde, surplus }: { solde: number; surplus: number }) {
  const months = 13
  const points: { key: string; val: number }[] = []
  let cur = solde
  const now = currentMonthKey()
  for (let i = 0; i < months; i++) {
    cur += surplus
    points.push({ key: addMonths(now, i), val: cur })
  }
  const min = Math.min(...points.map(p => p.val))
  const max = Math.max(...points.map(p => p.val))
  const range = max - min || 1
  const W = 600, H = 160, PAD = 40

  const px = (i: number) => PAD + (i / (months - 1)) * (W - PAD * 2)
  const py = (v: number) => H - 20 - ((v - min) / range) * (H - 40)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(p.val)}`).join(' ')
  const area = `${path} L ${px(months - 1)} ${H - 20} L ${px(0)} ${H - 20} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
      <defs>
        <linearGradient id="proj-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(63% 0.19 250)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="oklch(63% 0.19 250)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#proj-grad)" />
      <path d={path} stroke="oklch(63% 0.19 250)" strokeWidth={2} fill="none" />
      {points.map((p, i) => i % 2 === 0 && (
        <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize={10} fill="#636385">
          {monthLabel(p.key).slice(0, 3)}
        </text>
      ))}
    </svg>
  )
}

export default function ComptePage() {
  const { compte, transactions, budget, monthPlans, updateSolde, addHistorique, deleteHistorique, loading } = useAppData()
  const [editingSolde, setEditingSolde] = useState(false)
  const [newSolde, setNewSolde] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [calMonth, setCalMonth] = useState<string | null>(null)

  const curKey = currentMonthKey()
  const resolved = useMemo(() => resolveBudget(budget, monthPlans, curKey), [budget, monthPlans, curKey])
  const surplus = calcSurplus(resolved)

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
    const apres = avant + surplus
    const key = curKey
    await updateSolde(apres, key)
    await addHistorique({ key, label: monthLabel(key), avant, apres, revenus: rev, depenses: dep, epargne: epa, delta: surplus })
  }

  const sortedTx = [...transactions].sort((a, b) => {
    const v = sortBy === 'date' ? a.date.localeCompare(b.date) : a.amount - b.amount
    return sortDir === 'asc' ? v : -v
  })

  // Calendar
  const calMonthKey = calMonth ?? currentMonthKey()
  const [cy, cm] = calMonthKey.split('-').map(Number)
  const firstDay = new Date(cy, cm - 1, 1).getDay()
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const txByDay: Record<number, typeof transactions> = {}
  transactions.filter(t => t.date.startsWith(calMonthKey)).forEach(t => {
    const d = parseInt(t.date.slice(8))
    txByDay[d] = [...(txByDay[d] ?? []), t]
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const alreadyApplied = compte.derniereMaj === curKey
  const dayOfMonth = new Date().getDate()

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Mon Compte</h1>

      {loading ? <div style={{ color: '#636385' }}>Chargement…</div> : (
        <>
          {/* Solde + projection */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
            <div style={{ ...cardCss, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, color: '#636385', fontWeight: 600 }}>SOLDE ACTUEL</div>
              {editingSolde ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" step="0.01" value={newSolde} onChange={e => setNewSolde(e.target.value)}
                    style={{ ...inputCss, fontSize: 20, fontWeight: 700 }} autoFocus
                    onKeyDown={e => e.key === 'Enter' && applySolde()} />
                  <button onClick={applySolde} style={btnCss()}>✓</button>
                  <button onClick={() => setEditingSolde(false)} style={{ ...btnCss('#1c1c27'), border: '1px solid #252535', color: '#636385' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { setNewSolde(String(compte.solde)); setEditingSolde(true) }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: compte.solde >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{fmt(compte.solde)}</span>
                  <span style={{ fontSize: 12, color: '#636385' }}>✏</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#636385' }}>
                  <span>Surplus mensuel</span>
                  <span style={{ color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>{fmt(surplus)}</span>
                </div>
                {!alreadyApplied && dayOfMonth >= 27 && (
                  <button onClick={applyMonth} style={{ ...btnCss(), fontSize: 12, marginTop: 4 }}>
                    Appliquer {monthLabel(curKey)}
                  </button>
                )}
                {alreadyApplied && (
                  <span style={{ fontSize: 11, color: '#636385', textAlign: 'center' }}>✓ {monthLabel(curKey)} appliqué</span>
                )}
              </div>
            </div>
            <div style={cardCss}>
              <div style={{ fontSize: 12, color: '#636385', fontWeight: 600, marginBottom: 12 }}>PROJECTION 13 MOIS</div>
              <ProjectionChart solde={compte.solde} surplus={surplus} />
            </div>
          </div>

          {/* Historique mensuel */}
          {compte.historique.length > 0 && (
            <div style={cardCss}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Historique mensuel</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Mois', 'Avant', 'Revenus', 'Dépenses', 'Épargne', 'Après', 'Δ', ''].map((h, i) => (
                      <th key={i} style={{ padding: '6px 10px', textAlign: i >= 5 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compte.historique.map(h => (
                    <tr key={h.key} style={{ borderBottom: '1px solid #1c1c27' }}>
                      <td style={{ padding: '8px 10px', fontSize: 13, color: '#e8e8f2' }}>{h.label}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#636385' }}>{fmt(h.avant)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: 'oklch(65% 0.18 148)' }}>+{fmt(h.revenus)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: 'oklch(62% 0.20 25)' }}>-{fmt(h.depenses)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: 'oklch(63% 0.19 250)' }}>{fmt(h.epargne)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, color: '#e8e8f2', textAlign: 'right', fontWeight: 600 }}>{fmt(h.apres)}</td>
                      <td style={{ padding: '8px 10px', fontSize: 12, textAlign: 'right', color: h.delta >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>
                        {h.delta >= 0 ? '+' : ''}{fmt(h.delta)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <button onClick={() => deleteHistorique(h.key)} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 13 }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Transactions history */}
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
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Libellé', 'Catégorie', 'Montant'].map((h, i) => (
                    <th key={i} style={{ padding: '6px 10px', textAlign: i === 3 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTx.slice(0, 50).map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                    <td style={{ padding: '8px 10px', fontSize: 12, color: '#636385' }}>{tx.date}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13, color: '#e8e8f2' }}>{tx.label}</td>
                    <td style={{ padding: '8px 10px', fontSize: 12, color: '#636385' }}>{tx.category ?? '—'}</td>
                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right',
                      color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : '#e8e8f2' }}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calendrier */}
          <div style={cardCss}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Calendrier</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => setCalMonth(addMonths(calMonthKey, -1))} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 16 }}>‹</button>
                <span style={{ fontSize: 13, color: '#e8e8f2' }}>{monthLabel(calMonthKey)}</span>
                <button onClick={() => setCalMonth(addMonths(calMonthKey, 1))} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 16 }}>›</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['Lu','Ma','Me','Je','Ve','Sa','Di'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#636385', padding: '4px 0' }}>{d}</div>
              ))}
              {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const txs = txByDay[day] ?? []
                const active = selectedDay === day
                return (
                  <div key={day} onClick={() => setSelectedDay(active ? null : day)}
                    style={{ textAlign: 'center', padding: '6px 4px', borderRadius: 8, cursor: txs.length > 0 ? 'pointer' : 'default',
                      background: active ? 'oklch(63% 0.19 250 / 0.2)' : txs.length > 0 ? '#1c1c27' : 'transparent',
                      border: `1px solid ${active ? 'oklch(63% 0.19 250)' : txs.length > 0 ? '#252535' : 'transparent'}` }}>
                    <div style={{ fontSize: 12, color: txs.length > 0 ? '#e8e8f2' : '#636385' }}>{day}</div>
                    {txs.length > 0 && <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'oklch(63% 0.19 250)', margin: '2px auto 0' }} />}
                  </div>
                )
              })}
            </div>
            {selectedDay && txByDay[selectedDay] && (
              <div style={{ marginTop: 16, padding: 12, background: '#1c1c27', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: '#636385', marginBottom: 8 }}>
                  {selectedDay} {monthLabel(calMonthKey)}
                </div>
                {txByDay[selectedDay].map(tx => (
                  <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #252535', fontSize: 13 }}>
                    <span style={{ color: '#e8e8f2' }}>{tx.label}</span>
                    <span style={{ color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : '#e8e8f2', fontWeight: 600 }}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
