'use client'
import { useState, useMemo } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, todayISO, cardCss, inputCss, btnCss } from '@/lib/utils'
import type { Compte, LivretMove } from '@/lib/types'

const TYPE_CONFIG = {
  depot:   { label: 'Dépôt',    color: 'oklch(65% 0.18 148)', sign: '+' },
  retrait: { label: 'Retrait',  color: 'oklch(62% 0.20 25)',  sign: '−' },
  interet: { label: 'Intérêts', color: 'oklch(63% 0.19 250)', sign: '+' },
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#636385', display: 'block', marginBottom: 5,
  fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
}

// ── Calendrier livret ─────────────────────────────────────────────────────────
function LivretCalendar({ moves, livretId }: { moves: LivretMove[]; livretId: string }) {
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const [cy, cm] = calMonth.split('-').map(Number)
  const firstDayOfWeek = (new Date(cy, cm - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(cy, cm, 0).getDate()
  const today = new Date()
  const isCurrentMonth = calMonth === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-')
    return new Date(+y, +m - 1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
  }

  const addMonths = (key: string, n: number) => {
    const [y, m] = key.split('-').map(Number)
    const d = new Date(y, m - 1 + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const monthMoves = useMemo(() =>
    moves.filter(m => m.livretId === livretId && m.date.startsWith(calMonth)),
    [moves, livretId, calMonth])

  const byDay = useMemo(() => {
    const map: Record<number, LivretMove[]> = {}
    monthMoves.forEach(m => {
      const d = parseInt(m.date.slice(8))
      map[d] = [...(map[d] ?? []), m]
    })
    return map
  }, [monthMoves])

  const monthTotals = useMemo(() => ({
    depot:   monthMoves.filter(m => m.type === 'depot').reduce((s, m) => s + m.amount, 0),
    retrait: monthMoves.filter(m => m.type === 'retrait').reduce((s, m) => s + m.amount, 0),
    interet: monthMoves.filter(m => m.type === 'interet').reduce((s, m) => s + m.amount, 0),
  }), [monthMoves])

  return (
    <div style={cardCss}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2' }}>Calendrier</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => { setCalMonth(addMonths(calMonth, -1)); setSelectedDay(null) }}
            style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 18 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', minWidth: 140, textAlign: 'center' }}>{monthLabel(calMonth)}</span>
          <button onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null) }}
            style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 18 }}>›</button>
        </div>
      </div>

      {/* Totaux du mois */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Dépôts',    val: monthTotals.depot,   color: 'oklch(65% 0.18 148)', bg: 'oklch(65% 0.18 148 / 0.08)', border: 'oklch(65% 0.18 148 / 0.2)', sign: '+' },
          { label: 'Retraits',  val: monthTotals.retrait, color: 'oklch(62% 0.20 25)',  bg: 'oklch(62% 0.20 25 / 0.08)',  border: 'oklch(62% 0.20 25 / 0.2)',  sign: '−' },
          { label: 'Intérêts', val: monthTotals.interet, color: 'oklch(63% 0.19 250)', bg: 'oklch(63% 0.19 250 / 0.08)', border: 'oklch(63% 0.19 250 / 0.2)', sign: '+' },
        ].map(t => (
          <div key={t.label} style={{ flex: 1, minWidth: 100, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#636385', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.color }}>{t.sign}{fmt(t.val)}</div>
          </div>
        ))}
      </div>

      {/* Grille calendrier */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#636385', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dayMoves = byDay[day] ?? []
          const isToday = isCurrentMonth && today.getDate() === day
          const isSelected = selectedDay === day
          return (
            <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
              style={{
                borderRadius: 10, padding: '6px 4px', cursor: dayMoves.length > 0 ? 'pointer' : 'default', minHeight: 58,
                background: isSelected ? 'oklch(63% 0.19 250 / 0.15)' : isToday ? '#1c1c27' : 'transparent',
                border: `1px solid ${isSelected ? 'oklch(63% 0.19 250 / 0.6)' : isToday ? 'oklch(63% 0.19 250 / 0.4)' : '#1c1c27'}`,
                transition: 'background 0.15s',
              }}>
              <div style={{ textAlign: 'right', fontSize: 11, fontWeight: isToday ? 700 : 400,
                color: isToday ? 'oklch(63% 0.19 250)' : dayMoves.length > 0 ? '#e8e8f2' : '#3a3a50', marginBottom: 3 }}>{day}</div>
              {dayMoves.slice(0, 2).map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: TYPE_CONFIG[m.type as keyof typeof TYPE_CONFIG].color }} />
                  <span style={{ fontSize: 9, color: '#636385', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fmt(m.amount)}
                  </span>
                </div>
              ))}
              {dayMoves.length > 2 && <div style={{ fontSize: 8, color: '#636385', paddingLeft: 8 }}>+{dayMoves.length - 2}</div>}
            </div>
          )
        })}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && byDay[selectedDay] && (
        <div style={{ marginTop: 16, padding: '14px 16px', background: '#1c1c27', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f2', marginBottom: 10 }}>
            {selectedDay} {monthLabel(calMonth)}
            <span style={{ color: '#636385', fontWeight: 400, marginLeft: 8 }}>{byDay[selectedDay].length} mouvement{byDay[selectedDay].length > 1 ? 's' : ''}</span>
          </div>
          {byDay[selectedDay].map(m => {
            const cfg = TYPE_CONFIG[m.type as keyof typeof TYPE_CONFIG]
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #252535' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: cfg.color }} />
                  <div>
                    <div style={{ fontSize: 13, color: '#e8e8f2' }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: '#636385' }}>{cfg.label} · Après : {fmt(m.soldeApres)}</div>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>
                  {cfg.sign}{fmt(m.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LivretsPage() {
  const { comptes, livrets, livretMoves, createCompte, updateCompte, deleteCompte, saveLivretMove, deleteLivretMove, loading } = useAppData()

  const [activeLivretId, setActiveLivretId] = useState<string | null>(null)
  const [form, setForm] = useState({ date: todayISO(), type: 'depot', label: '', amount: '' })
  const [deletingMoveId, setDeletingMoveId] = useState<string | null>(null)
  const [showNewLivret, setShowNewLivret] = useState(false)
  const [newNom, setNewNom] = useState('')
  const [newTaux, setNewTaux] = useState('')
  const [newSolde, setNewSolde] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNom, setEditNom] = useState('')
  const [editTaux, setEditTaux] = useState('')
  const [deletingLivretId, setDeletingLivretId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const activeLivret = livrets.find(l => l.id === activeLivretId) ?? livrets[0] ?? null

  const activeMoves = useMemo(() =>
    livretMoves.filter(m => m.livretId === activeLivret?.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [livretMoves, activeLivret?.id])

  const kpis = useMemo(() => ({
    totalDepot:   activeMoves.filter(m => m.type === 'depot').reduce((s, m) => s + m.amount, 0),
    totalRetrait: activeMoves.filter(m => m.type === 'retrait').reduce((s, m) => s + m.amount, 0),
    totalInteret: activeMoves.filter(m => m.type === 'interet').reduce((s, m) => s + m.amount, 0),
  }), [activeMoves])

  async function submitMove(e: React.FormEvent) {
    e.preventDefault()
    if (!activeLivret || !form.label || !form.amount) return
    setSaving(true)
    const amount = parseFloat(form.amount)
    const delta = form.type === 'retrait' ? -amount : amount
    const soldeApres = activeLivret.solde + delta
    await saveLivretMove({
      livretId: activeLivret.id,
      date: form.date,
      type: form.type as LivretMove['type'],
      label: form.label,
      amount,
      soldeApres,
    })
    setForm(f => ({ ...f, label: '', amount: '' }))
    setSaving(false)
  }

  async function submitNewLivret(e: React.FormEvent) {
    e.preventDefault()
    if (!newNom.trim()) return
    setSaving(true)
    const c = await createCompte(newNom.trim(), 'livret', parseFloat(newSolde) || 0, parseFloat(newTaux) || 0)
    setActiveLivretId(c.id)
    setShowNewLivret(false)
    setNewNom(''); setNewTaux(''); setNewSolde('')
    setSaving(false)
  }

  async function submitEditLivret(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setSaving(true)
    await updateCompte(editingId, { nom: editNom.trim(), taux: parseFloat(editTaux) || 0 })
    setEditingId(null)
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Livrets</h1>
          <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>
            {livrets.length} livret{livrets.length > 1 ? 's' : ''} · Total{' '}
            <span style={{ color: '#e8e8f2', fontWeight: 600 }}>{fmt(livrets.reduce((s, l) => s + l.solde, 0))}</span>
          </p>
        </div>
        <button onClick={() => setShowNewLivret(true)} style={{ ...btnCss(), fontSize: 13 }}>+ Nouveau livret</button>
      </div>

      {/* Onglets livrets */}
      {livrets.length === 0 ? (
        <div style={{ ...cardCss, textAlign: 'center', padding: 48, color: '#636385' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏦</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2', marginBottom: 6 }}>Aucun livret</div>
          <div style={{ fontSize: 12, marginBottom: 20 }}>Créez votre premier livret pour commencer le suivi</div>
          <button onClick={() => setShowNewLivret(true)} style={{ ...btnCss(), fontSize: 13 }}>+ Créer un livret</button>
        </div>
      ) : (
        <>
          {/* Sélecteur de livret */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {livrets.map((l, idx) => {
              const colors = ['oklch(63% 0.19 250)', 'oklch(65% 0.18 148)', 'oklch(68% 0.17 55)', 'oklch(68% 0.15 310)', 'oklch(62% 0.20 25)']
              const color = colors[idx % colors.length]
              const isActive = (activeLivret?.id === l.id)
              return (
                <button key={l.id} onClick={() => setActiveLivretId(l.id)}
                  style={{
                    padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontFamily: 'Inter',
                    background: isActive ? `${color}18` : '#13131b',
                    border: `1.5px solid ${isActive ? color : '#252535'}`,
                    transition: 'all 0.2s', textAlign: 'left',
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? color : '#e8e8f2' }}>{l.nom}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? color : '#636385', marginTop: 2 }}>{fmt(l.solde)}</div>
                  {l.taux != null && l.taux > 0 && (
                    <div style={{ fontSize: 10, color: '#636385', marginTop: 1 }}>{l.taux}% / an</div>
                  )}
                </button>
              )
            })}
          </div>

          {activeLivret && (
            <>
              {/* KPIs + actions */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
                {/* KPIs */}
                <div style={{ ...cardCss, flex: 2, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#636385', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>SOLDE ACTUEL</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: activeLivret.solde >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                        {fmt(activeLivret.solde)}
                      </div>
                      {activeLivret.taux != null && activeLivret.taux > 0 && (
                        <div style={{ fontSize: 12, color: '#636385', marginTop: 4 }}>
                          Intérêts estimés : <span style={{ color: 'oklch(63% 0.19 250)', fontWeight: 600 }}>+{fmt(activeLivret.solde * activeLivret.taux / 100)} / an</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setEditingId(activeLivret.id); setEditNom(activeLivret.nom); setEditTaux(String(activeLivret.taux ?? '')) }}
                        style={{ ...btnCss('secondary'), fontSize: 11, padding: '5px 12px' }}>✏ Modifier</button>
                      <button onClick={() => setDeletingLivretId(activeLivret.id)}
                        style={{ ...btnCss('secondary'), fontSize: 11, padding: '5px 12px', color: 'oklch(62% 0.20 25)', borderColor: 'oklch(62% 0.20 25 / 0.3)' }}>🗑</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Total déposé',  val: kpis.totalDepot,   color: 'oklch(65% 0.18 148)', sign: '+' },
                      { label: 'Total retiré',  val: kpis.totalRetrait, color: 'oklch(62% 0.20 25)',  sign: '−' },
                      { label: 'Intérêts reçus', val: kpis.totalInteret, color: 'oklch(63% 0.19 250)', sign: '+' },
                    ].map(k => (
                      <div key={k.label} style={{ background: '#1c1c27', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: '#636385', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.sign}{fmt(k.val)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formulaire ajout mouvement */}
                <div style={{ ...cardCss, flex: 1, minWidth: 260 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Nouveau mouvement</div>
                  <form onSubmit={submitMove} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Date</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputCss} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
                          <button key={val} type="button" onClick={() => setForm(f => ({ ...f, type: val }))}
                            style={{
                              flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                              background: form.type === val ? cfg.color : 'transparent',
                              border: `1.5px solid ${form.type === val ? cfg.color : '#2a2a3a'}`,
                              color: form.type === val ? '#fff' : '#636385',
                            }}>
                            {cfg.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Libellé</label>
                      <input placeholder="Ex : Versement mensuel" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inputCss} required />
                    </div>
                    <div>
                      <label style={labelStyle}>Montant (€)</label>
                      <input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputCss} required />
                    </div>
                    <button type="submit" disabled={saving}
                      style={{ ...btnCss(), fontSize: 13, opacity: saving ? 0.6 : 1, background: TYPE_CONFIG[form.type as keyof typeof TYPE_CONFIG].color }}>
                      {saving ? '…' : '+ Ajouter'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Calendrier */}
              <LivretCalendar moves={livretMoves} livretId={activeLivret.id} />

              {/* Tableau des mouvements */}
              <div style={cardCss}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>
                  Historique — {activeLivret.nom}
                  <span style={{ fontSize: 11, color: '#636385', marginLeft: 8, fontWeight: 400 }}>{activeMoves.length} mouvement{activeMoves.length > 1 ? 's' : ''}</span>
                </div>
                {activeMoves.length === 0 ? (
                  <div style={{ color: '#636385', fontSize: 13, textAlign: 'center', padding: 32 }}>Aucun mouvement enregistré</div>
                ) : (
                  <div className="table-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                      <thead>
                        <tr>
                          {['Date', 'Type', 'Libellé', 'Montant', 'Solde après', ''].map((h, i) => (
                            <th key={i} style={{ padding: '8px 12px', textAlign: i >= 3 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeMoves.map(m => {
                          const cfg = TYPE_CONFIG[m.type as keyof typeof TYPE_CONFIG]
                          const isDeleting = deletingMoveId === m.id
                          return (
                            <tr key={m.id}
                              style={{ borderBottom: '1px solid #1c1c27', transition: 'background 0.1s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#1c1c27')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <td style={{ padding: '10px 12px', fontSize: 12, color: '#636385', whiteSpace: 'nowrap' }}>{m.date}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, color: cfg.color, background: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}>
                                  {cfg.label}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: 13, color: '#e8e8f2', fontWeight: 500 }}>{m.label}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: cfg.color }}>
                                {cfg.sign}{fmt(m.amount)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: '#636385' }}>{fmt(m.soldeApres)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                {isDeleting ? (
                                  <div style={{ display: 'inline-flex', gap: 5 }}>
                                    <button onClick={async () => { await deleteLivretMove(m.id); setDeletingMoveId(null) }}
                                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter', background: 'oklch(62% 0.20 25)', border: 'none', color: '#fff' }}>
                                      Supprimer
                                    </button>
                                    <button onClick={() => setDeletingMoveId(null)}
                                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', background: 'transparent', border: '1px solid #2a2a3a', color: '#636385' }}>
                                      Annuler
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeletingMoveId(m.id)}
                                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', background: 'transparent', border: '1px solid #2a2a3a', color: '#636385', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(62% 0.20 25)'; e.currentTarget.style.color = 'oklch(62% 0.20 25)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3a'; e.currentTarget.style.color = '#636385' }}>
                                    Supprimer
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Modal nouveau livret */}
      {showNewLivret && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...cardCss, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f2', marginBottom: 20 }}>Nouveau livret</div>
            <form onSubmit={submitNewLivret} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom du livret</label>
                <input value={newNom} onChange={e => setNewNom(e.target.value)} placeholder="Ex : Livret A, LDD…" style={inputCss} required />
              </div>
              <div>
                <label style={labelStyle}>Taux annuel (%)</label>
                <input type="number" step="0.001" min="0" value={newTaux} onChange={e => setNewTaux(e.target.value)} placeholder="Ex : 3" style={inputCss} />
              </div>
              <div>
                <label style={labelStyle}>Solde initial (€)</label>
                <input type="number" step="0.01" min="0" value={newSolde} onChange={e => setNewSolde(e.target.value)} placeholder="0" style={inputCss} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => { setShowNewLivret(false); setNewNom(''); setNewTaux(''); setNewSolde('') }} style={{ ...btnCss('secondary'), fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={saving} style={{ ...btnCss(), fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? '…' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition livret */}
      {editingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ ...cardCss, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f2', marginBottom: 20 }}>Modifier le livret</div>
            <form onSubmit={submitEditLivret} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Nom du livret</label>
                <input value={editNom} onChange={e => setEditNom(e.target.value)} style={inputCss} required />
              </div>
              <div>
                <label style={labelStyle}>Taux annuel (%)</label>
                <input type="number" step="0.001" min="0" value={editTaux} onChange={e => setEditTaux(e.target.value)} placeholder="Ex : 3" style={inputCss} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setEditingId(null)} style={{ ...btnCss('secondary'), fontSize: 13 }}>Annuler</button>
                <button type="submit" disabled={saving} style={{ ...btnCss(), fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? '…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation suppression livret */}
      {deletingLivretId && (() => {
        const l = livrets.find(x => x.id === deletingLivretId)!
        const canDelete = comptes.filter(c => c.type !== 'livret').length > 0 || livrets.length > 1
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ ...cardCss, maxWidth: 380, width: '100%' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f2', marginBottom: 10 }}>Supprimer ce livret ?</div>
              <div style={{ fontSize: 13, color: '#636385', marginBottom: 20 }}>
                <strong style={{ color: '#e8e8f2' }}>{l.nom}</strong> — {fmt(l.solde)}<br />
                {!canDelete
                  ? <span style={{ color: 'oklch(62% 0.20 25)' }}>Impossible : c&apos;est le dernier compte.</span>
                  : 'Tous les mouvements associés seront supprimés.'}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setDeletingLivretId(null)} style={btnCss('secondary')}>Annuler</button>
                {canDelete && (
                  <button onClick={async () => { await deleteCompte(deletingLivretId); setDeletingLivretId(null); if (activeLivretId === deletingLivretId) setActiveLivretId(null) }}
                    style={{ ...btnCss(), background: 'oklch(62% 0.20 25)', boxShadow: 'none' }}>Supprimer</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
