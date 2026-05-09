'use client'
import { useState } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, todayISO, TX_TYPES, TX_CATEGORIES, cardCss, inputCss } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

const typeColor = (t: string) => TX_TYPES.find(x => x.value === t)?.color ?? '#636385'
const typeLabel = (t: string) => TX_TYPES.find(x => x.value === t)?.label ?? t

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#636385', display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }

export default function TransactionsPage() {
  const { transactions, compte, updateSolde, saveTx, deleteTx, loading } = useAppData()
  const [form, setForm] = useState({ date: todayISO(), label: '', category: '', amount: '', type: 'expense' })
  const [editingSolde, setEditingSolde] = useState(false)
  const [soldeInput, setSoldeInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = transactions
    .filter(t => typeFilter === 'all' || t.type === typeFilter)
    .filter(t => !search || t.label.toLowerCase().includes(search.toLowerCase()) || (t.category ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const v = sortBy === 'date' ? a.date.localeCompare(b.date) : a.amount - b.amount
      return sortDir === 'asc' ? v : -v
    })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label || !form.amount) return
    await saveTx({ date: form.date, label: form.label, category: form.category || null, amount: parseFloat(form.amount), type: form.type as Transaction['type'] })
    setForm(f => ({ ...f, label: '', amount: '', category: '' }))
  }

  function toggleSort(col: 'date' | 'amount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const totalIn  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalOut = filtered.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0)

  const selectedType = TX_TYPES.find(t => t.value === form.type)

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Transactions</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Suivez vos entrées et sorties d&apos;argent</p>
      </div>

      {/* Carte compte */}
      <div style={cardCss} className="compte-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'oklch(63% 0.19 250 / 0.15)', border: '1px solid oklch(63% 0.19 250 / 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>◈</div>
          <div>
            <div style={{ fontSize: 11, color: '#636385', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Solde du compte</div>
            {editingSolde ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" step="0.01" autoFocus
                  value={soldeInput}
                  onChange={e => setSoldeInput(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      await updateSolde(parseFloat(soldeInput) || 0, todayISO())
                      setEditingSolde(false)
                    }
                    if (e.key === 'Escape') setEditingSolde(false)
                  }}
                  style={{ ...inputCss, width: 160, fontSize: 20, fontWeight: 700, padding: '4px 10px' }}
                />
                <button onClick={async () => { await updateSolde(parseFloat(soldeInput) || 0, todayISO()); setEditingSolde(false) }}
                  style={{ padding: '6px 14px', borderRadius: 8, background: 'oklch(63% 0.19 250)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter' }}>
                  OK
                </button>
                <button onClick={() => setEditingSolde(false)}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: '1px solid #252535', color: '#636385', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter' }}>
                  Annuler
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 28, fontWeight: 700, color: compte.solde >= 0 ? '#e8e8f2' : 'oklch(62% 0.20 25)', lineHeight: 1.1 }}>
                {fmt(compte.solde)}
              </div>
            )}
            {compte.derniereMaj && !editingSolde && (
              <div style={{ fontSize: 11, color: '#636385', marginTop: 3 }}>
                Mis à jour le {new Date(compte.derniereMaj).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          {!editingSolde && (
            <button onClick={() => { setSoldeInput(String(compte.solde)); setEditingSolde(true) }}
              style={{ padding: '8px 18px', borderRadius: 9, background: 'transparent', border: '1px solid #252535', color: '#636385', fontSize: 13, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              ✏ Modifier le solde
            </button>
          )}
          <div className="compte-stats">
            <div>
              <div style={{ color: '#636385', marginBottom: 2 }}>Entrées (période)</div>
              <div style={{ color: 'oklch(65% 0.18 148)', fontWeight: 700 }}>+{fmt(totalIn)}</div>
            </div>
            <div>
              <div style={{ color: '#636385', marginBottom: 2 }}>Sorties (période)</div>
              <div style={{ color: 'oklch(62% 0.20 25)', fontWeight: 700 }}>−{fmt(totalOut)}</div>
            </div>
            <div>
              <div style={{ color: '#636385', marginBottom: 2 }}>Net période</div>
              <div style={{ color: totalIn >= totalOut ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 700 }}>
                {totalIn - totalOut >= 0 ? '+' : ''}{fmt(totalIn - totalOut)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire ajout */}
      <div style={cardCss}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 18 }}>Nouvelle transaction</div>
        <form onSubmit={submit}>
          {/* Ligne 1 : champs principaux */}
          <div className="grid-form-tx" style={{ marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputCss} required />
            </div>
            <div>
              <label style={labelStyle}>Libellé</label>
              <input placeholder="Ex : Courses Leclerc" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inputCss} required />
            </div>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputCss, cursor: 'pointer' }}>
                <option value="">—</option>
                {TX_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Montant (€)</label>
              <input type="number" placeholder="0,00" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputCss} required />
            </div>
          </div>

          {/* Ligne 2 : type + submit */}
          <div className="tx-form-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="tx-type-pills" style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#636385', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: 4, alignSelf: 'center' }}>Type :</span>
              {TX_TYPES.map(t => {
                const active = form.type === t.value
                return (
                  <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                      background: active ? t.color : 'transparent',
                      border: `1.5px solid ${active ? t.color : '#2a2a3a'}`,
                      color: active ? '#fff' : '#636385',
                      transition: 'all 0.15s',
                    }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
            <button type="submit" className="tx-submit-btn"
              style={{
                padding: '9px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter',
                background: selectedType?.color ?? 'oklch(63% 0.19 250)',
                border: 'none', color: '#fff',
                boxShadow: `0 2px 12px ${selectedType?.color ?? 'oklch(63% 0.19 250)'}44`,
                transition: 'all 0.15s',
              }}>
              + Ajouter
            </button>
          </div>
        </form>
      </div>

      {/* Filtres + recherche */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#3a3a50', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
          <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputCss, paddingLeft: 32, width: 220 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ v: 'all', l: 'Tous', color: 'oklch(63% 0.19 250)' }, ...TX_TYPES.map(t => ({ v: t.value, l: t.label, color: t.color }))].map(f => {
            const active = typeFilter === f.v
            return (
              <button key={f.v} onClick={() => setTypeFilter(f.v)}
                style={{
                  padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                  background: active ? f.color : 'transparent',
                  border: `1.5px solid ${active ? f.color : '#2a2a3a'}`,
                  color: active ? '#fff' : '#636385',
                  transition: 'all 0.15s',
                }}>
                {f.l}
              </button>
            )
          })}
        </div>
        {filtered.length !== transactions.length && (
          <span style={{ fontSize: 11, color: '#636385', marginLeft: 4 }}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div style={cardCss}>
        {loading ? (
          <div style={{ color: '#636385', fontSize: 13, textAlign: 'center', padding: 32 }}>Chargement…</div>
        ) : (
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                {[
                  { k: 'date',   l: 'Date',      right: false },
                  { k: null,     l: 'Libellé',   right: false },
                  { k: null,     l: 'Catégorie', right: false },
                  { k: null,     l: 'Type',      right: false },
                  { k: 'amount', l: 'Montant',   right: true  },
                  { k: null,     l: '',          right: true  },
                ].map((col, i) => (
                  <th key={i} onClick={col.k ? () => toggleSort(col.k as 'date' | 'amount') : undefined}
                    style={{
                      padding: '10px 12px', textAlign: col.right ? 'right' : 'left', fontSize: 11,
                      color: sortBy === col.k ? '#e8e8f2' : '#636385',
                      borderBottom: '1px solid #252535',
                      cursor: col.k ? 'pointer' : 'default',
                      userSelect: 'none', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}>
                    {col.l}{col.k && (sortBy === col.k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#636385', fontSize: 13 }}>Aucune transaction trouvée</td></tr>
              )}
              {filtered.map(tx => {
                const isDeleting = deletingId === tx.id
                return (
                  <tr key={tx.id}
                    style={{ borderBottom: '1px solid #1c1c27', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#1c1c27')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: '#636385', whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={{ padding: '11px 12px', fontSize: 13, color: '#e8e8f2', fontWeight: 500 }}>{tx.label}</td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: '#636385' }}>{tx.category ?? <span style={{ opacity: 0.4 }}>—</span>}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                        color: typeColor(tx.type),
                        background: typeColor(tx.type) + '22',
                        border: `1px solid ${typeColor(tx.type)}44`,
                      }}>
                        {typeLabel(tx.type)}
                      </span>
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700,
                      color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : '#e8e8f2' }}>
                      {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                      {isDeleting ? (
                        <div style={{ display: 'inline-flex', gap: 5 }}>
                          <button onClick={async () => { await deleteTx(tx.id); setDeletingId(null) }}
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter',
                              background: 'oklch(62% 0.20 25)', border: 'none', color: '#fff',
                            }}>
                            Supprimer
                          </button>
                          <button onClick={() => setDeletingId(null)}
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                              background: 'transparent', border: '1px solid #2a2a3a', color: '#636385',
                            }}>
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(tx.id)}
                          style={{
                            padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                            background: 'transparent', border: '1px solid #2a2a3a', color: '#636385',
                            transition: 'all 0.15s',
                          }}
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
    </div>
  )
}
