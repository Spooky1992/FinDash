'use client'
import { useEffect, useState, useCallback } from 'react'
import { cardCss, fmt } from '@/lib/utils'
import type { CapitalMove } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  deposit:    'Dépôt',
  withdrawal: 'Retrait',
  buy:        'Achat',
  sell:       'Vente',
}
const TYPE_COLORS: Record<string, string> = {
  deposit:    'oklch(65% 0.18 148)',
  withdrawal: 'oklch(62% 0.20 25)',
  buy:        'oklch(63% 0.19 250)',
  sell:       'oklch(68% 0.17 55)',
}
const ACCOUNTS = ['PEA', 'CTO', 'Crypto'] as const
const TYPES    = ['deposit', 'withdrawal', 'buy', 'sell'] as const

function Badge({ val, map, colorMap }: { val: string; map: Record<string, string>; colorMap: Record<string, string> }) {
  const color = colorMap[val] ?? '#636385'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: `${color}22`, color }}>
      {map[val] ?? val}
    </span>
  )
}

function AccountBadge({ account }: { account: string }) {
  const colors: Record<string, string> = { PEA: 'oklch(63% 0.19 250)', CTO: 'oklch(68% 0.15 310)', Crypto: 'oklch(68% 0.17 55)' }
  const c = colors[account] ?? '#636385'
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: `${c}22`, color: c }}>{account}</span>
}

// ── Summary KPI bar ───────────────────────────────────────────────────────────
function SummaryBar({ moves }: { moves: CapitalMove[] }) {
  const deposits    = moves.filter(m => m.type === 'deposit').reduce((s, m) => s + m.amount, 0)
  const withdrawals = moves.filter(m => m.type === 'withdrawal').reduce((s, m) => s + m.amount, 0)
  const invested    = moves.filter(m => m.type === 'buy').reduce((s, m) => s + m.amount, 0)
  const realised    = moves.filter(m => m.type === 'sell' && m.pnl != null).reduce((s, m) => s + (m.pnl ?? 0), 0)
  const netCapital  = deposits - withdrawals

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {[
        { label: 'Capital apporté',    val: fmt(deposits),    color: 'oklch(65% 0.18 148)', sub: `dont ${fmt(withdrawals)} retirés` },
        { label: 'Capital net',         val: fmt(netCapital),  color: '#e8e8f2', sub: null },
        { label: 'Total investi',        val: fmt(invested),    color: 'oklch(63% 0.19 250)', sub: `${moves.filter(m => m.type === 'buy').length} achats` },
        { label: 'P&L réalisé',         val: (realised >= 0 ? '+' : '') + fmt(realised), color: realised >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', sub: `${moves.filter(m => m.type === 'sell').length} ventes` },
      ].map(k => (
        <div key={k.label} style={{ ...cardCss, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: '#636385', marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.val}</div>
          {k.sub && <div style={{ fontSize: 11, color: '#636385', marginTop: 2 }}>{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Add form ──────────────────────────────────────────────────────────────────
interface FormState {
  date: string; type: string; account: string; ticker: string
  label: string; quantity: string; priceUnit: string; amount: string
  currency: string; pnl: string; notes: string
}

function emptyForm(): FormState {
  return { date: new Date().toISOString().slice(0, 10), type: 'deposit', account: 'PEA', ticker: '', label: '', quantity: '', priceUnit: '', amount: '', currency: 'EUR', pnl: '', notes: '' }
}

function AddForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm]     = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [open, setOpen]     = useState(false)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const isTrade = form.type === 'buy' || form.type === 'sell'

  // Auto-compute amount from quantity × priceUnit
  useEffect(() => {
    if (!isTrade) return
    const q = parseFloat(form.quantity)
    const p = parseFloat(form.priceUnit)
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0)
      setForm(f => ({ ...f, amount: (q * p).toFixed(2) }))
  }, [form.quantity, form.priceUnit, isTrade])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const body: Record<string, unknown> = {
        date:     form.date,
        type:     form.type,
        account:  form.account,
        label:    form.label || (TYPE_LABELS[form.type] + (form.ticker ? ` ${form.ticker}` : '')),
        amount:   form.amount,
        currency: form.currency,
      }
      if (isTrade && form.ticker)    body.ticker    = form.ticker
      if (isTrade && form.quantity)  body.quantity  = form.quantity
      if (isTrade && form.priceUnit) body.priceUnit = form.priceUnit
      if (form.type === 'sell' && form.pnl) body.pnl = form.pnl
      if (form.notes) body.notes = form.notes

      const res = await fetch('/api/capital-moves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d   = await res.json()
      if (!res.ok) { setErr(d.error ?? 'Erreur'); return }
      setForm(emptyForm())
      setOpen(false)
      onAdded()
    } catch { setErr('Erreur réseau') }
    finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = {
    background: '#1c1c27', border: '1px solid #252535', borderRadius: 8,
    padding: '9px 12px', color: '#e8e8f2', fontSize: 13, fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#636385', marginBottom: 4, display: 'block' }

  return (
    <div style={cardCss}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#e8e8f2', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14 }}>
        <span style={{ fontSize: 18, color: 'oklch(63% 0.19 250)' }}>{open ? '▾' : '▸'}</span>
        Nouveau mouvement
      </button>

      {open && (
        <form onSubmit={submit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            {/* Date */}
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={form.date} onChange={set('date')} style={inputStyle} required />
            </div>
            {/* Type */}
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.type} onChange={set('type')} style={inputStyle}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            {/* Compte */}
            <div>
              <label style={labelStyle}>Compte</label>
              <select value={form.account} onChange={set('account')} style={inputStyle}>
                {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {/* Devise */}
            <div>
              <label style={labelStyle}>Devise</label>
              <select value={form.currency} onChange={set('currency')} style={inputStyle}>
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
              </select>
            </div>
          </div>

          {isTrade && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Ticker</label>
                <input placeholder="ex: AAPL, BTC…" value={form.ticker} onChange={set('ticker')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Quantité</label>
                <input type="number" step="any" min="0" placeholder="0" value={form.quantity} onChange={set('quantity')} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Prix unitaire</label>
                <input type="number" step="any" min="0" placeholder="0.00" value={form.priceUnit} onChange={set('priceUnit')} style={inputStyle} />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: isTrade ? '2fr 1fr 1fr' : '2fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Libellé (optionnel)</label>
              <input placeholder={TYPE_LABELS[form.type] + (form.ticker ? ` ${form.ticker}` : '')} value={form.label} onChange={set('label')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Montant ({form.currency})</label>
              <input type="number" step="any" min="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} style={inputStyle} required />
            </div>
            {form.type === 'sell' && (
              <div>
                <label style={labelStyle}>P&L réalisé ({form.currency})</label>
                <input type="number" step="any" placeholder="0.00 (positif=gain)" value={form.pnl} onChange={set('pnl')} style={inputStyle} />
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Notes (optionnel)</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Ex: Réinvesti dans MSFT suite vente de TSLA…" style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {err && <div style={{ fontSize: 12, color: 'oklch(62% 0.20 25)' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setOpen(false); setForm(emptyForm()) }} style={{ padding: '9px 20px', borderRadius: 8, background: 'transparent', border: '1px solid #252535', color: '#636385', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13 }}>
              Annuler
            </button>
            <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: 'oklch(63% 0.19 250)', border: 'none', color: '#fff', cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function JournalPage() {
  const [moves, setMoves]       = useState<CapitalMove[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterType, setFT]     = useState<string>('all')
  const [filterAccount, setFA]  = useState<string>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/capital-moves')
      if (r.ok) setMoves(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function remove(id: string) {
    setDeleting(id)
    await fetch('/api/capital-moves', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setMoves(m => m.filter(x => x.id !== id))
    setDeleting(null)
  }

  const filtered = moves.filter(m =>
    (filterType === 'all'    || m.type    === filterType) &&
    (filterAccount === 'all' || m.account === filterAccount)
  )

  const pillBtn = (active: boolean) => ({
    padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600,
    background:  active ? 'oklch(63% 0.19 250 / 0.2)' : '#1c1c27',
    border:      `1px solid ${active ? 'oklch(63% 0.19 250 / 0.5)' : '#252535'}`,
    color:       active ? 'oklch(63% 0.19 250)' : '#636385',
  } as React.CSSProperties)

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Journal d&apos;investissement</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Dépôts, retraits, achats et ventes avec P&L</p>
      </div>

      {!loading && <SummaryBar moves={moves} />}

      <AddForm onAdded={load} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#636385', marginRight: 4 }}>Type :</span>
        {['all', ...TYPES].map(t => (
          <button key={t} onClick={() => setFT(t)} style={pillBtn(filterType === t)}>
            {t === 'all' ? 'Tous' : TYPE_LABELS[t]}
          </button>
        ))}
        <span style={{ fontSize: 11, color: '#636385', margin: '0 4px 0 12px' }}>Compte :</span>
        {['all', ...ACCOUNTS].map(a => (
          <button key={a} onClick={() => setFA(a)} style={pillBtn(filterAccount === a)}>
            {a === 'all' ? 'Tous' : a}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={cardCss}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#636385', fontSize: 13 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📒</div>
            <div style={{ color: '#e8e8f2', fontWeight: 600, marginBottom: 6 }}>Aucun mouvement</div>
            <div style={{ color: '#636385', fontSize: 13 }}>Ajoutez un dépôt, retrait, achat ou vente ci-dessus.</div>
          </div>
        ) : (
          <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
              <thead>
                <tr>
                  {['Date', 'Type', 'Compte', 'Libellé / Ticker', 'Qté', 'Prix unit.', 'Montant', 'P&L réalisé', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #1c1c27' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1c1c27'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: '#636385', whiteSpace: 'nowrap' }}>
                      {new Date(m.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <Badge val={m.type} map={TYPE_LABELS} colorMap={TYPE_COLORS} />
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <AccountBadge account={m.account} />
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ fontSize: 13, color: '#e8e8f2', fontWeight: 500 }}>{m.label}</div>
                      {m.ticker && <div style={{ fontSize: 11, color: '#636385', marginTop: 1 }}>{m.ticker}</div>}
                      {m.notes  && <div style={{ fontSize: 10, color: '#3a3a50', marginTop: 2, fontStyle: 'italic' }}>{m.notes}</div>}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: '#636385', textAlign: 'right' }}>
                      {m.quantity != null ? m.quantity.toLocaleString('fr-FR', { maximumFractionDigits: 6 }) : '—'}
                    </td>
                    <td style={{ padding: '11px 12px', fontSize: 12, color: '#636385', textAlign: 'right' }}>
                      {m.priceUnit != null ? `${m.priceUnit.toFixed(4)} ${m.currency}` : '—'}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 600 }}>
                      <span style={{ fontSize: 13, color: m.type === 'withdrawal' ? 'oklch(62% 0.20 25)' : '#e8e8f2' }}>
                        {m.type === 'withdrawal' ? '-' : ''}{fmt(m.amount)}
                      </span>
                      {m.currency === 'USD' && <span style={{ fontSize: 10, color: '#636385', marginLeft: 4 }}>USD</span>}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                      {m.pnl != null ? (
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: m.pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                            {m.pnl >= 0 ? '+' : ''}{fmt(m.pnl)}
                          </span>
                          {m.amount > 0 && (
                            <div style={{ fontSize: 10, color: m.pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                              {((m.pnl / m.amount) * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                      ) : <span style={{ color: '#3a3a50', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right' }}>
                      <button onClick={() => remove(m.id)} disabled={deleting === m.id}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636385', fontSize: 14, opacity: deleting === m.id ? 0.4 : 0.6, padding: '2px 4px' }}
                        title="Supprimer">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div style={{ fontSize: 11, color: '#636385', textAlign: 'right' }}>
          {filtered.length} entrée{filtered.length > 1 ? 's' : ''}
          {filterType !== 'all' || filterAccount !== 'all' ? ` (filtré sur ${moves.length} au total)` : ''}
        </div>
      )}
    </div>
  )
}
