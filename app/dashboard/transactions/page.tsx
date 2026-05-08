'use client'
import { useState } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, todayISO, TX_TYPES, TX_CATEGORIES, cardCss, inputCss, btnCss } from '@/lib/utils'
import type { Transaction } from '@/lib/types'

const typeColor = (t: string) => TX_TYPES.find(x => x.value === t)?.color ?? '#636385'
const typeLabel = (t: string) => TX_TYPES.find(x => x.value === t)?.label ?? t

export default function TransactionsPage() {
  const { transactions, saveTx, deleteTx, loading } = useAppData()
  const [form, setForm] = useState({ date: todayISO(), label: '', category: '', amount: '', type: 'expense' })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const filtered = transactions
    .filter(t => typeFilter === 'all' || t.type === typeFilter)
    .filter(t => !search || t.label.toLowerCase().includes(search.toLowerCase()) || (t.category ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const v = sortBy === 'date'
        ? a.date.localeCompare(b.date)
        : a.amount - b.amount
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

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Transactions</h1>

      {/* Formulaire ajout */}
      <div style={cardCss}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 16 }}>Nouvelle transaction</div>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 120px auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputCss} required />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Libellé</label>
            <input placeholder="Ex: Courses" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inputCss} required />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Catégorie</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputCss, cursor: 'pointer' }}>
              <option value="">—</option>
              {TX_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Montant (€)</label>
            <input type="number" placeholder="0" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inputCss} required />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Type</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {TX_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  style={{ padding: '7px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
                    background: form.type === t.value ? t.color : '#1c1c27',
                    border: `1px solid ${form.type === t.value ? t.color : '#252535'}`,
                    color: form.type === t.value ? '#fff' : '#636385' }}>
                  {t.label.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" style={{ ...btnCss(), marginTop: 18 }}>+ Ajouter</button>
        </form>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Entrées', val: totalIn,  color: 'oklch(65% 0.18 148)' },
          { label: 'Sorties', val: totalOut, color: 'oklch(62% 0.20 25)'  },
          { label: 'Solde',   val: totalIn - totalOut, color: totalIn >= totalOut ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' },
        ].map(k => (
          <div key={k.label} style={{ ...cardCss, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{fmt(k.val)}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputCss, width: 200 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ v: 'all', l: 'Tous' }, ...TX_TYPES.map(t => ({ v: t.value, l: t.label }))].map(f => (
            <button key={f.v} onClick={() => setTypeFilter(f.v)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter',
                background: typeFilter === f.v ? 'oklch(63% 0.19 250)' : '#1c1c27',
                border: `1px solid ${typeFilter === f.v ? 'oklch(63% 0.19 250)' : '#252535'}`,
                color: typeFilter === f.v ? '#fff' : '#636385' }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={cardCss}>
        {loading ? <div style={{ color: '#636385', fontSize: 13, textAlign: 'center', padding: 24 }}>Chargement…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { k: 'date',  l: 'Date'   },
                  { k: null,    l: 'Libellé' },
                  { k: null,    l: 'Catégorie' },
                  { k: null,    l: 'Type'    },
                  { k: 'amount',l: 'Montant' },
                  { k: null,    l: ''        },
                ].map((col, i) => (
                  <th key={i} onClick={col.k ? () => toggleSort(col.k as 'date' | 'amount') : undefined}
                    style={{ padding: '8px 12px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11,
                      color: sortBy === col.k ? '#e8e8f2' : '#636385',
                      borderBottom: '1px solid #252535',
                      cursor: col.k ? 'pointer' : 'default',
                      userSelect: 'none', fontWeight: 600 }}>
                    {col.l}{col.k && (sortBy === col.k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#636385', fontSize: 13 }}>Aucune transaction</td></tr>
              )}
              {filtered.map(tx => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #1c1c27' }}>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#636385' }}>{tx.date}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: '#e8e8f2' }}>{tx.label}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: '#636385' }}>{tx.category ?? '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, color: typeColor(tx.type), background: typeColor(tx.type) + '22' }}>
                      {typeLabel(tx.type)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600,
                    color: tx.type === 'income' ? 'oklch(65% 0.18 148)' : '#e8e8f2' }}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button onClick={() => deleteTx(tx.id)} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 14, padding: 4 }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
