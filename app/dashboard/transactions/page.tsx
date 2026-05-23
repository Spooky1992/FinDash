'use client'
import { useState } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, todayISO, TX_TYPES, TX_CATEGORIES, cardCss, inputCss } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

const ALL_TYPES = [...TX_TYPES, { value: 'transfer', label: 'Virement', color: 'oklch(68% 0.15 310)' }]
const typeColor = (t: string) => ALL_TYPES.find(x => x.value === t)?.color ?? '#636385'
const typeLabel = (t: string) => ALL_TYPES.find(x => x.value === t)?.label ?? t

const COMPTE_COLORS = [
  'oklch(63% 0.19 250)',
  'oklch(65% 0.18 148)',
  'oklch(68% 0.17 55)',
  'oklch(62% 0.20 25)',
  'oklch(65% 0.16 185)',
  'oklch(63% 0.19 290)',
  'oklch(68% 0.15 310)',
]

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#636385', display: 'block', marginBottom: 5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }

export default function TransactionsPage() {
  const { transactions, comptes, defaultCompte, saveTx, deleteTx, loading } = useAppData()
  const [form, setForm] = useState({ date: todayISO(), label: '', category: '', amount: '', type: 'expense', compteId: '', toCompteId: '' })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formCompteId = form.compteId || defaultCompte?.id || ''

  const applyFilters = (txs: Transaction[]) =>
    txs
      .filter(t => typeFilter === 'all' || t.type === typeFilter)
      .filter(t => catFilter === 'all' || (t.category ?? '') === catFilter)
      .filter(t => !search || t.label.toLowerCase().includes(search.toLowerCase()) || (t.category ?? '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const v = sortBy === 'date' ? a.date.localeCompare(b.date) : a.amount - b.amount
        return sortDir === 'asc' ? v : -v
      })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label || !form.amount) return
    const amount = parseFloat(form.amount)
    const type = form.type as Transaction['type']
    if (type === 'transfer' && !form.toCompteId) return
    await saveTx({
      date: form.date, label: form.label,
      category: form.category || null,
      amount, type,
      compteId: formCompteId || null,
      toCompteId: type === 'transfer' ? form.toCompteId : null,
    })
    setForm(f => ({ ...f, label: '', amount: '', category: '', toCompteId: '' }))
  }

  function toggleSort(col: 'date' | 'amount') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  const selectedType = ALL_TYPES.find(t => t.value === form.type)

  // Grouper par compte
  const compteBlocks = comptes.map((compte, idx) => {
    const color = COMPTE_COLORS[idx % COMPTE_COLORS.length]
    const txsForCompte = transactions.filter(t =>
      t.compteId === compte.id ||
      (t.toCompteId === compte.id) ||
      (!t.compteId && compte.id === (defaultCompte?.id ?? ''))
    )
    const filtered = applyFilters(txsForCompte)
    const totalIn  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const totalOut = filtered.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0)
    return { compte, color, filtered, totalIn, totalOut }
  })

  const totalFiltered = compteBlocks.reduce((s, b) => s + b.filtered.length, 0)
  const totalAll = transactions.length

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Transactions</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Suivez vos entrées et sorties par compte</p>
      </div>

      {/* Formulaire ajout */}
      <div style={cardCss}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 18 }}>Nouvelle transaction</div>
        <form onSubmit={submit}>
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

          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={labelStyle}>{form.type === 'transfer' ? 'Compte source' : 'Compte'}</label>
              <select value={formCompteId} onChange={e => setForm(f => ({ ...f, compteId: e.target.value }))} style={{ ...inputCss, cursor: 'pointer' }}>
                {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}{c.isDefault ? ' (défaut)' : ''}</option>)}
              </select>
            </div>
            {form.type === 'transfer' && (
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>Compte destinataire</label>
                <select value={form.toCompteId} onChange={e => setForm(f => ({ ...f, toCompteId: e.target.value }))} style={{ ...inputCss, cursor: 'pointer' }} required>
                  <option value="">— Choisir —</option>
                  {comptes.filter(c => c.id !== formCompteId).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="tx-form-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="tx-type-pills" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#636385', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: 4, alignSelf: 'center' }}>Type :</span>
              {ALL_TYPES.map(t => {
                const active = form.type === t.value
                return (
                  <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value, toCompteId: '' }))}
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

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#3a3a50', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
          <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputCss, paddingLeft: 32, width: 200 }} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ ...inputCss, width: 'auto', cursor: 'pointer', paddingRight: 28 }}>
          <option value="all">Toutes catégories</option>
          {TX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[{ v: 'all', l: 'Tous', color: 'oklch(63% 0.19 250)' }, ...TX_TYPES.map(t => ({ v: t.value, l: t.label, color: t.color }))].map(f => {
            const active = typeFilter === f.v
            return (
              <button key={f.v} onClick={() => setTypeFilter(f.v)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
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
        {totalFiltered !== totalAll && (
          <span style={{ fontSize: 11, color: '#636385' }}>{totalFiltered} résultat{totalFiltered > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Blocs par compte */}
      {loading ? (
        <div style={{ ...cardCss, color: '#636385', fontSize: 13, textAlign: 'center', padding: 32 }}>Chargement…</div>
      ) : (
        compteBlocks.map(({ compte, color, filtered, totalIn, totalOut }) => (
          <CompteBlock
            key={compte.id}
            compte={compte}
            color={color}
            transactions={filtered}
            totalIn={totalIn}
            totalOut={totalOut}
            deletingId={deletingId}
            setDeletingId={setDeletingId}
            deleteTx={deleteTx}
            sortBy={sortBy}
            sortDir={sortDir}
            toggleSort={toggleSort}
          />
        ))
      )}

      {/* Récap par catégorie */}
      <CategoryRecap transactions={transactions} />
    </div>
  )
}

function CompteBlock({
  compte, color, transactions, totalIn, totalOut,
  deletingId, setDeletingId, deleteTx, sortBy, sortDir, toggleSort,
}: {
  compte: { id: string; nom: string; solde: number; type: string }
  color: string
  transactions: Transaction[]
  totalIn: number
  totalOut: number
  deletingId: string | null
  setDeletingId: (id: string | null) => void
  deleteTx: (id: string) => Promise<void>
  sortBy: 'date' | 'amount'
  sortDir: 'desc' | 'asc'
  toggleSort: (col: 'date' | 'amount') => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ ...cardCss, padding: 0, overflow: 'hidden' }}>
      {/* En-tête compte */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
          borderBottom: collapsed ? 'none' : '1px solid #1c1c27',
          textAlign: 'left',
        }}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0,
          boxShadow: `0 0 8px ${color}88`,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f2' }}>{compte.nom}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
              color, background: color + '22', border: `1px solid ${color}44`,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{compte.type}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: compte.solde >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>
              Solde : {fmt(compte.solde)}
            </span>
            {transactions.length > 0 && (
              <>
                <span style={{ fontSize: 12, color: '#636385' }}>
                  +{fmt(totalIn)}
                </span>
                <span style={{ fontSize: 12, color: '#636385' }}>
                  −{fmt(totalOut)}
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#636385' }}>{transactions.length} tx</span>
          <span style={{ fontSize: 12, color: '#636385', transition: 'transform 0.2s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
        </div>
      </button>

      {!collapsed && (
        <>
          {transactions.length === 0 ? (
            <div style={{ padding: '24px 16px', color: '#636385', fontSize: 13, textAlign: 'center' }}>
              Aucune transaction
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="tx-table">
                <div className="table-scroll">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
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
                              padding: '9px 12px', textAlign: col.right ? 'right' : 'left', fontSize: 11,
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
                      {transactions.map((tx, idx) => {
                        const isDeleting = deletingId === tx.id
                        return (
                          <tr key={tx.id}
                            style={{ borderBottom: idx < transactions.length - 1 ? '1px solid #1c1c27' : 'none', transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#1c1c27')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: '#636385', whiteSpace: 'nowrap' }}>{tx.date}</td>
                            <td style={{ padding: '10px 12px', fontSize: 13, color: '#e8e8f2', fontWeight: 500 }}>{tx.label}</td>
                            <td style={{ padding: '10px 12px', fontSize: 12, color: '#636385' }}>{tx.category ?? <span style={{ opacity: 0.4 }}>—</span>}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                                color: typeColor(tx.type),
                                background: typeColor(tx.type) + '22',
                                border: `1px solid ${typeColor(tx.type)}44`,
                              }}>
                                {typeLabel(tx.type)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700,
                              color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : '#e8e8f2' }}>
                              {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              {isDeleting ? (
                                <div style={{ display: 'inline-flex', gap: 5 }}>
                                  <button onClick={async () => { await deleteTx(tx.id); setDeletingId(null) }}
                                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter', background: 'oklch(62% 0.20 25)', border: 'none', color: '#fff' }}>
                                    Supprimer
                                  </button>
                                  <button onClick={() => setDeletingId(null)}
                                    style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', background: 'transparent', border: '1px solid #2a2a3a', color: '#636385' }}>
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setDeletingId(tx.id)}
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
              </div>

              {/* Mobile cards */}
              <div className="tx-mobile-list">
                {transactions.map((tx, idx) => {
                  const isDeleting = deletingId === tx.id
                  return (
                    <div key={tx.id} style={{
                      padding: '13px 16px',
                      borderBottom: idx < transactions.length - 1 ? '1px solid #1c1c27' : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f2', flex: 1, lineHeight: 1.3 }}>{tx.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
                          color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : '#e8e8f2' }}>
                          {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#636385' }}>{tx.date}</span>
                        {tx.category && <span style={{ fontSize: 12, color: '#636385' }}>· {tx.category}</span>}
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                          color: typeColor(tx.type), background: typeColor(tx.type) + '22', border: `1px solid ${typeColor(tx.type)}44`,
                        }}>
                          {typeLabel(tx.type)}
                        </span>
                        <div style={{ marginLeft: 'auto' }}>
                          {isDeleting ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={async () => { await deleteTx(tx.id); setDeletingId(null) }}
                                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter', background: 'oklch(62% 0.20 25)', border: 'none', color: '#fff', minHeight: 32 }}>
                                Confirmer
                              </button>
                              <button onClick={() => setDeletingId(null)}
                                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', background: 'transparent', border: '1px solid #2a2a3a', color: '#636385', minHeight: 32 }}>
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingId(tx.id)}
                              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter', background: 'transparent', border: '1px solid #2a2a3a', color: '#636385', minHeight: 32 }}>
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function CategoryRecap({ transactions }: { transactions: Transaction[] }) {
  const byCategory: Record<string, { total: number; count: number }> = {}
  for (const tx of transactions) {
    if (tx.type === 'income') continue
    const cat = tx.category || 'Sans catégorie'
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 }
    byCategory[cat].total += tx.amount
    byCategory[cat].count += 1
  }
  const rows = Object.entries(byCategory)
    .filter(([, { total }]) => total > 0)
    .sort((a, b) => b[1].total - a[1].total)

  if (rows.length === 0) return null

  const grandTotal = rows.reduce((s, [, { total }]) => s + total, 0)

  return (
    <div style={cardCss}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Récap par catégorie</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(([cat, { total, count }]) => {
          const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
          return (
            <div key={cat}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#e8e8f2', fontWeight: 500 }}>
                  {cat}
                  <span style={{ fontSize: 11, color: '#636385', marginLeft: 6 }}>({count} tx)</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f2' }}>
                  {fmt(total)}
                  <span style={{ fontSize: 11, color: '#636385', marginLeft: 6 }}>{pct.toFixed(1)}%</span>
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 3, background: '#252535' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: 'oklch(63% 0.19 250)', transition: 'width 0.3s' }} />
              </div>
            </div>
          )
        })}
        <div style={{ borderTop: '1px solid #252535', paddingTop: 10, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: '#636385', fontWeight: 600 }}>Total dépenses</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e8e8f2' }}>{fmt(grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}
