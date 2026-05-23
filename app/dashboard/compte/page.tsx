'use client'
import { useState, useMemo, useRef } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, currentMonthKey, addMonths, monthLabel, resolveBudget, calcSurplus, cardCss, inputCss, btnCss } from '@/lib/utils'
import type { Compte, CompteHistorique } from '@/lib/types'

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
  const yTicks = 4
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => min + (i / yTicks) * range)

  return (
    <div>
      {hov && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 12, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>Mois</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>{hov.key === 'now' ? 'Maintenant' : monthLabel(hov.key)}</div></div>
          <div><div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>Solde prévu</div>
            <div style={{ fontSize: 13, fontWeight: 600, color }}>{fmt(hov.val)}</div></div>
          {hov.surplus !== 0 && (
            <div><div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>Surplus</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: hov.surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                {hov.surplus >= 0 ? '+' : ''}{fmt(hov.surplus)}</div></div>
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
        {min < 0 && max > 0 && (
          <line x1={padL} y1={py(0)} x2={W - padR} y2={py(0)} stroke="#636385" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
        )}
        <path d={area} fill="url(#proj-grad)" />
        <path d={path} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        {allPoints.map((p, i) => (
          <circle key={i} cx={px(i)} cy={py(p.val)} r={3} fill={color} opacity={hovIdx === i ? 1 : 0.4} />
        ))}
        {allPoints.map((p, i) => i % 2 === 0 && (
          <text key={i} x={px(i)} y={H - padB + 16} textAnchor="middle" fontSize={9} fill="#636385" fontFamily="Inter, sans-serif">
            {p.key === 'now' ? 'Auj.' : monthLabel(p.key).slice(0, 3)}
          </text>
        ))}
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

// ── Calendrier (pour un compte donné) ────────────────────────────────────────
function Calendar({ transactions, compte }: {
  transactions: ReturnType<typeof useAppData>['transactions']
  compte: Compte
}) {
  const [calMonth, setCalMonth] = useState<string>(currentMonthKey())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [cy, cm] = calMonth.split('-').map(Number)
  const firstDayOfWeek = (new Date(cy, cm - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const today = new Date()
  const isCurrentMonth = calMonth === currentMonthKey()

  const monthTxs = useMemo(() =>
    transactions.filter(t => t.date.startsWith(calMonth) &&
      (t.compteId === compte.id || (!t.compteId && compte.isDefault))),
    [transactions, calMonth, compte.id, compte.isDefault])

  const txByDay = useMemo(() => {
    const map: Record<number, typeof transactions> = {}
    monthTxs.forEach(t => {
      const d = parseInt(t.date.slice(8))
      map[d] = [...(map[d] ?? []), t]
    })
    return map
  }, [monthTxs])

  const monthTotals = useMemo(() => ({
    income:  monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    expense: monthTxs.filter(t => t.type !== 'income' && t.type !== 'transfer').reduce((s, t) => s + t.amount, 0),
  }), [monthTxs])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>Calendrier — {compte.nom}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setCalMonth(addMonths(calMonth, -1)); setSelectedDay(null) }}
            style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 18 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', minWidth: 90, textAlign: 'center' }}>{monthLabel(calMonth)}</span>
          <button onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null) }}
            style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 18 }}>›</button>
        </div>
      </div>

      {/* Totaux du mois */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, background: 'oklch(65% 0.18 148 / 0.08)', border: '1px solid oklch(65% 0.18 148 / 0.2)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#636385', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Reçu</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(65% 0.18 148)' }}>+{fmt(monthTotals.income)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: 'oklch(62% 0.20 25 / 0.08)', border: '1px solid oklch(62% 0.20 25 / 0.2)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#636385', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Dépensé</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(62% 0.20 25)' }}>−{fmt(monthTotals.expense)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, background: '#1c1c27', border: '1px solid #252535', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: '#636385', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Net</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: monthTotals.income - monthTotals.expense >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
            {monthTotals.income - monthTotals.expense >= 0 ? '+' : ''}{fmt(monthTotals.income - monthTotals.expense)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#636385', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const txs = txByDay[day] ?? []
          const totals = dayTotals[day]
          const isToday = isCurrentMonth && today.getDate() === day
          const isSelected = selectedDay === day
          return (
            <div key={day} className="cal-day-cell"
              onClick={() => setSelectedDay(isSelected ? null : day)}
              style={{
                borderRadius: 10, padding: '6px 4px', cursor: txs.length > 0 ? 'pointer' : 'default', minHeight: 64,
                background: isSelected ? 'oklch(63% 0.19 250 / 0.15)' : isToday ? '#1c1c27' : 'transparent',
                border: `1px solid ${isSelected ? 'oklch(63% 0.19 250 / 0.6)' : isToday ? 'oklch(63% 0.19 250 / 0.4)' : '#1c1c27'}`,
                transition: 'background 0.15s', overflow: 'hidden',
              }}>
              <div style={{ textAlign: 'right', fontSize: 11, fontWeight: isToday ? 700 : 400,
                color: isToday ? 'oklch(63% 0.19 250)' : txs.length > 0 ? '#e8e8f2' : '#3a3a50', marginBottom: 4 }}>{day}</div>
              {txs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {txs.slice(0, 3).map(tx => (
                    <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                        background: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'saving' ? 'oklch(63% 0.19 250)' : 'oklch(62% 0.20 25)' }} />
                      <span className="cal-day-text" style={{ fontSize: 9, color: '#636385', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                        {tx.label}
                      </span>
                    </div>
                  ))}
                  {txs.length > 3 && <div className="cal-day-text" style={{ fontSize: 8, color: '#636385', paddingLeft: 8 }}>+{txs.length - 3}</div>}
                </div>
              )}
              {totals && (
                <div className="cal-day-amounts" style={{ marginTop: 4 }}>
                  {totals.income > 0  && <div style={{ fontSize: 9, color: 'oklch(65% 0.18 148)', fontWeight: 600, textAlign: 'right' }}>+{totals.income.toLocaleString('fr-FR')} €</div>}
                  {totals.expense > 0 && <div style={{ fontSize: 9, color: 'oklch(62% 0.20 25)', fontWeight: 600, textAlign: 'right' }}>-{totals.expense.toLocaleString('fr-FR')} €</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

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

// ── Modal ajout/édition compte ────────────────────────────────────────────────
function CompteModal({ initial, onSave, onClose }: {
  initial?: Compte
  onSave: (nom: string, type: Compte['type'], solde: number) => Promise<void>
  onClose: () => void
}) {
  const [nom, setNom]   = useState(initial?.nom ?? '')
  const [type, setType] = useState<Compte['type']>(initial?.type ?? 'courant')
  const [solde, setSolde] = useState(initial ? String(initial.solde) : '0')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setSaving(true)
    await onSave(nom.trim(), type, parseFloat(solde) || 0)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...cardCss, width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f2', marginBottom: 20 }}>
          {initial ? 'Modifier le compte' : 'Nouveau compte'}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom du compte</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Compte courant BNP" style={inputCss} required />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value as Compte['type'])} style={{ ...inputCss, cursor: 'pointer' }}>
              <option value="courant">Compte courant</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          {!initial && (
            <div>
              <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solde initial (€)</label>
              <input type="number" step="0.01" value={solde} onChange={e => setSolde(e.target.value)} style={inputCss} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ ...btnCss('secondary'), fontSize: 13 }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ ...btnCss(), fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? '…' : initial ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Carte compte ──────────────────────────────────────────────────────────────
const COMPTE_COLORS = ['oklch(63% 0.19 250)', 'oklch(65% 0.18 148)', 'oklch(68% 0.17 55)', 'oklch(68% 0.15 310)', 'oklch(62% 0.20 25)']

function CompteCard({ compte, idx, isActive, onSelect, onEdit, onDelete, onSetDefault, onEditSolde }: {
  compte: Compte & { historique: CompteHistorique[] }
  idx: number; isActive: boolean
  onSelect: () => void; onEdit: () => void; onDelete: () => void
  onSetDefault: () => void; onEditSolde: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const color = COMPTE_COLORS[idx % COMPTE_COLORS.length]

  return (
    <div onClick={onSelect} style={{
      borderRadius: 16, padding: '20px 22px', cursor: 'pointer', position: 'relative',
      background: isActive ? `${color}18` : '#13131b',
      border: `1.5px solid ${isActive ? color : '#252535'}`,
      transition: 'all 0.2s',
    }}>
      {/* Badge défaut */}
      {compte.isDefault && (
        <span style={{ position: 'absolute', top: 12, left: 14, fontSize: 10, fontWeight: 700, color, background: `${color}20`, padding: '2px 8px', borderRadius: 6 }}>
          Par défaut
        </span>
      )}
      {/* Menu contextuel */}
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <button onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}
          style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}>⋯</button>
        {menuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
            <div style={{ position: 'absolute', right: 0, top: 28, background: '#1c1c27', border: '1px solid #252535', borderRadius: 10, padding: '4px 0', zIndex: 100, minWidth: 170, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {[
                { label: '✏ Renommer', action: () => { onEdit(); setMenuOpen(false) } },
                { label: '✎ Modifier le solde', action: () => { onEditSolde(); setMenuOpen(false) } },
                ...(!compte.isDefault ? [{ label: '★ Définir par défaut', action: () => { onSetDefault(); setMenuOpen(false) } }] : []),
                { label: '🗑 Supprimer', action: () => { onDelete(); setMenuOpen(false) }, danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter', color: (item as { danger?: boolean }).danger ? 'oklch(62% 0.20 25)' : '#e8e8f2' }}>
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: compte.isDefault ? 24 : 4, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#636385', marginBottom: 4 }}>{compte.type === 'courant' ? 'Compte courant' : 'Compte'}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f2' }}>{compte.nom}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: compte.solde >= 0 ? color : 'oklch(62% 0.20 25)', letterSpacing: '-0.5px' }}>
        {fmt(compte.solde)}
      </div>
      {compte.derniereMaj && (
        <div style={{ fontSize: 10, color: '#636385', marginTop: 6 }}>Maj {compte.derniereMaj}</div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ComptePage() {
  const { comptes, transactions, totalSolde, budget, monthPlans, createCompte, updateCompte, deleteCompte, setDefaultCompte, addHistorique, deleteHistorique, loading } = useAppData()

  const [activeCompteId, setActiveCompteId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingCompte, setEditingCompte] = useState<(Compte & { historique: CompteHistorique[] }) | null>(null)
  const [editSoldeId, setEditSoldeId] = useState<string | null>(null)
  const [soldeInput, setSoldeInput] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const curKey = currentMonthKey()
  const resolved = useMemo(() => resolveBudget(budget, monthPlans, curKey), [budget, monthPlans, curKey])
  const surplus  = calcSurplus(resolved)

  // Compte actif (sélectionné ou défaut)
  const comptesWithHistorique = comptes as (Compte & { historique: CompteHistorique[] })[]
  const defaultCompte = comptesWithHistorique.find(c => c.isDefault) ?? comptesWithHistorique[0]
  const activeCompte  = comptesWithHistorique.find(c => c.id === activeCompteId) ?? defaultCompte

  const alreadyApplied = activeCompte?.derniereMaj === curKey

  async function applyMonth() {
    if (!activeCompte) return
    const rev = resolved.incomes.reduce((s, i) => s + i.amount, 0)
    const dep = resolved.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
    const epa = resolved.savings.reduce((s, i) => s + i.amount, 0)
    const avant = activeCompte.solde
    const delta = -(dep + epa)
    const apres = avant + delta
    await updateCompte(activeCompte.id, { solde: apres, derniereMaj: curKey })
    await addHistorique(activeCompte.id, { key: curKey, label: monthLabel(curKey), avant, apres, revenus: rev, depenses: dep, epargne: epa, delta })
  }

  const sortedTx = useMemo(() => {
    if (!activeCompte) return []
    return [...transactions]
      .filter(t => t.compteId === activeCompte.id || (!t.compteId && activeCompte.isDefault))
      .sort((a, b) => sortDir === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
  }, [transactions, activeCompte, sortDir])

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Mes Comptes</h1>
          <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>
            {comptes.length} compte{comptes.length > 1 ? 's' : ''} · Total&nbsp;
            <span style={{ color: '#e8e8f2', fontWeight: 600 }}>{fmt(totalSolde)}</span>
          </p>
        </div>
        <button onClick={() => { setEditingCompte(null); setShowModal(true) }} style={{ ...btnCss(), fontSize: 13 }}>
          + Nouveau compte
        </button>
      </div>

      {/* Grille de cartes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {comptesWithHistorique.map((c, idx) => (
          <CompteCard key={c.id} compte={c} idx={idx}
            isActive={activeCompte?.id === c.id}
            onSelect={() => setActiveCompteId(c.id)}
            onEdit={() => { setEditingCompte(c); setShowModal(true) }}
            onDelete={() => setDeletingId(c.id)}
            onSetDefault={() => setDefaultCompte(c.id)}
            onEditSolde={() => { setEditSoldeId(c.id); setSoldeInput(String(c.solde)) }}
          />
        ))}
      </div>

      {/* Édition solde inline */}
      {editSoldeId && (() => {
        const c = comptesWithHistorique.find(x => x.id === editSoldeId)!
        return (
          <div style={{ ...cardCss, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#e8e8f2', fontWeight: 600 }}>Modifier le solde — {c.nom}</span>
            <input type="number" step="0.01" value={soldeInput} autoFocus
              onChange={e => setSoldeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setEditSoldeId(null) }}
              style={{ ...inputCss, width: 160 }} />
            <button onClick={async () => { await updateCompte(editSoldeId, { solde: parseFloat(soldeInput) || 0 }); setEditSoldeId(null) }}
              style={btnCss()}>Valider</button>
            <button onClick={() => setEditSoldeId(null)} style={btnCss('secondary')}>Annuler</button>
          </div>
        )
      })()}

      {/* Projection + surplus — basé sur compte actif */}
      {activeCompte && (
        <div className="grid-2-narrow">
          <div style={{ ...cardCss, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: '#636385', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>SOLDE — {activeCompte.nom.toUpperCase()}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: activeCompte.solde >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                {fmt(activeCompte.solde)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Surplus mensuel', val: surplus, color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' },
                { label: 'Dans 6 mois',  val: (() => { let c = activeCompte.solde; for (let i = 0; i < 6;  i++) { const k = addMonths(curKey, i); c += calcSurplus(resolveBudget(budget, monthPlans, k)) } return c })(), color: 'oklch(63% 0.19 250)' },
                { label: 'Dans 12 mois', val: (() => { let c = activeCompte.solde; for (let i = 0; i < 12; i++) { const k = addMonths(curKey, i); c += calcSurplus(resolveBudget(budget, monthPlans, k)) } return c })(), color: 'oklch(63% 0.19 250)' },
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
          <div style={cardCss}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Projection 13 mois</span>
              <span style={{ fontSize: 12, color: 'oklch(63% 0.19 250)', fontWeight: 600 }}>
                {fmt((() => { let c = activeCompte.solde; for (let i = 0; i < 13; i++) { const k = addMonths(curKey, i); c += calcSurplus(resolveBudget(budget, monthPlans, k)) } return c })())} dans 13 mois
              </span>
            </div>
            <ProjectionChart solde={activeCompte.solde} surplus={surplus} budget={budget} monthPlans={monthPlans} />
          </div>
        </div>
      )}

      {/* Calendrier */}
      {activeCompte && <Calendar transactions={transactions} compte={activeCompte} />}

      {/* Historique mensuel */}
      {activeCompte && activeCompte.historique.length > 0 && (
        <div style={cardCss}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Historique mensuel — {activeCompte.nom}</div>
          <div className="tx-table">
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                <thead><tr>
                  {['Mois', 'Avant', 'Revenus', 'Dépenses', 'Épargne', 'Après', 'Δ', ''].map((h, i) => (
                    <th key={i} style={{ padding: '6px 10px', textAlign: i >= 5 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {activeCompte.historique.map(h => (
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
                        <button onClick={() => deleteHistorique(activeCompte.id, h.key)} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transactions du compte actif */}
      {activeCompte && (
        <div style={cardCss}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Transactions — {activeCompte.nom}</span>
            <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              style={{ ...btnCss('secondary'), fontSize: 11 }}>
              Date {sortDir === 'desc' ? '↓' : '↑'}
            </button>
          </div>
          <div className="tx-table">
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
                          background: tx.type === 'income' ? 'oklch(65% 0.18 148 / 0.15)' : tx.type === 'transfer' ? 'oklch(68% 0.15 310 / 0.15)' : 'oklch(62% 0.20 25 / 0.15)',
                          color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'transfer' ? 'oklch(68% 0.15 310)' : 'oklch(62% 0.20 25)' }}>
                          {tx.type === 'income' ? 'Revenu' : tx.type === 'saving' ? 'Épargne' : tx.type === 'invest' ? 'Invest.' : tx.type === 'transfer' ? 'Virement' : 'Dépense'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right',
                        color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : tx.type === 'transfer' ? 'oklch(68% 0.15 310)' : '#e8e8f2' }}>
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
      )}

      {/* Modal création / édition */}
      {showModal && (
        <CompteModal
          initial={editingCompte ?? undefined}
          onSave={async (nom, type, solde) => {
            if (editingCompte) {
              await updateCompte(editingCompte.id, { nom, type })
            } else {
              await createCompte(nom, type, solde)
            }
          }}
          onClose={() => { setShowModal(false); setEditingCompte(null) }}
        />
      )}

      {/* Confirmation suppression */}
      {deletingId && (() => {
        const c = comptesWithHistorique.find(x => x.id === deletingId)!
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ ...cardCss, maxWidth: 380, width: '100%' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f2', marginBottom: 10 }}>Supprimer ce compte ?</div>
              <div style={{ fontSize: 13, color: '#636385', marginBottom: 20 }}>
                <strong style={{ color: '#e8e8f2' }}>{c.nom}</strong> — {fmt(c.solde)}<br />
                Cette action est irréversible. L&apos;historique associé sera supprimé.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeletingId(null)} style={btnCss('secondary')}>Annuler</button>
                <button onClick={async () => { await deleteCompte(deletingId); setDeletingId(null); if (activeCompteId === deletingId) setActiveCompteId(null) }}
                  style={{ ...btnCss(), background: 'oklch(62% 0.20 25)', boxShadow: 'none' }}>Supprimer</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
