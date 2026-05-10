'use client'
import { useEffect, useState, useCallback } from 'react'
import { cardCss, fmt } from '@/lib/utils'
import type { CapitalMove } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  deposit: 'Dépôt', withdrawal: 'Retrait', buy: 'Achat', sell: 'Vente',
}
const TYPE_COLORS: Record<string, string> = {
  deposit: 'oklch(65% 0.18 148)', withdrawal: 'oklch(62% 0.20 25)',
  buy: 'oklch(63% 0.19 250)', sell: 'oklch(68% 0.17 55)',
}
const ACCOUNTS = ['PEA', 'CTO', 'Crypto'] as const
const TYPES    = ['deposit', 'withdrawal', 'buy', 'sell'] as const

const inputStyle: React.CSSProperties = {
  background: '#1c1c27', border: '1px solid #252535', borderRadius: 8,
  padding: '9px 12px', color: '#e8e8f2', fontSize: 13,
  fontFamily: 'Inter, sans-serif', width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#636385', marginBottom: 4, display: 'block' }

function Badge({ val }: { val: string }) {
  const color = TYPE_COLORS[val] ?? '#636385'
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: `${color}22`, color }}>{TYPE_LABELS[val] ?? val}</span>
}
function AccountBadge({ account }: { account: string }) {
  const c = ({ PEA: 'oklch(63% 0.19 250)', CTO: 'oklch(68% 0.15 310)', Crypto: 'oklch(68% 0.17 55)' } as Record<string,string>)[account] ?? '#636385'
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: `${c}22`, color: c }}>{account}</span>
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function SummaryBar({ moves }: { moves: CapitalMove[] }) {
  const deposits    = moves.filter(m => m.type === 'deposit').reduce((s, m) => s + m.amount, 0)
  const withdrawals = moves.filter(m => m.type === 'withdrawal').reduce((s, m) => s + m.amount, 0)
  const totalBuys   = moves.filter(m => m.type === 'buy').reduce((s, m) => s + m.amount, 0)
  const totalSells  = moves.filter(m => m.type === 'sell').reduce((s, m) => s + m.amount, 0)
  const netInvested = totalBuys - totalSells  // capital réellement immobilisé
  const realised    = moves.filter(m => m.type === 'sell' && m.pnl != null).reduce((s, m) => s + (m.pnl ?? 0), 0)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {[
        { label: 'Capital apporté',    val: fmt(deposits),    color: 'oklch(65% 0.18 148)', sub: `dont ${fmt(withdrawals)} retirés` },
        { label: 'Capital net',        val: fmt(deposits - withdrawals), color: '#e8e8f2', sub: null },
        { label: 'Capital immobilisé', val: fmt(Math.max(0, netInvested)), color: 'oklch(63% 0.19 250)', sub: `${fmt(totalBuys)} achetés · ${fmt(totalSells)} récupérés` },
        { label: 'P&L réalisé',        val: (realised >= 0 ? '+' : '') + fmt(realised), color: realised >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', sub: `${moves.filter(m => m.type === 'sell').length} ventes` },
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

// ── P&L par ticker (FIFO) ─────────────────────────────────────────────────────
interface TickerPnL {
  ticker: string
  buys:  { date: string; qty: number; price: number; amount: number }[]
  sells: { date: string; qty: number; price: number; amount: number; pnlManual: number | null }[]
  totalBought:  number
  totalSold:    number
  avgBuyPrice:  number
  realizedPnL:  number
  manualPnL:    number | null
  investedEur:  number   // total achats
  recoveredEur: number   // total ventes
  netInvested:  number   // investedEur - recoveredEur (capital réellement immobilisé)
  stillHeld:    number
}

function computeTickerPnL(moves: CapitalMove[]): TickerPnL[] {
  const tickers = [...new Set(moves.filter(m => m.ticker).map(m => m.ticker!))]
  return tickers.map(ticker => {
    const tm    = moves.filter(m => m.ticker === ticker).sort((a, b) => a.date.localeCompare(b.date))
    const buys  = tm.filter(m => m.type === 'buy'  && m.quantity != null && m.quantity > 0)
    const sells = tm.filter(m => m.type === 'sell' && m.quantity != null && m.quantity > 0)

    const queue = buys.map(b => ({ price: b.amount / b.quantity!, remaining: b.quantity! }))
    let realizedPnL = 0
    for (const sell of sells) {
      let rem = sell.quantity!
      const sp = sell.amount / sell.quantity!
      while (rem > 0 && queue.length > 0) {
        const lot   = queue[0]
        const taken = Math.min(lot.remaining, rem)
        realizedPnL += taken * (sp - lot.price)
        lot.remaining -= taken; rem -= taken
        if (lot.remaining <= 0) queue.shift()
      }
    }

    const totalBought  = buys.reduce((s, b) => s + b.quantity!, 0)
    const totalSold    = sells.reduce((s, b) => s + b.quantity!, 0)
    const investedEur  = buys.reduce((s, b) => s + b.amount, 0)
    const recoveredEur = sells.reduce((s, b) => s + b.amount, 0)
    const avgBuyPrice  = totalBought > 0 ? investedEur / totalBought : 0
    const manualPnLSum = sells.some(s => s.pnl != null) ? sells.reduce((s, b) => s + (b.pnl ?? 0), 0) : null

    return {
      ticker, avgBuyPrice, totalBought, totalSold, investedEur, recoveredEur,
      netInvested: investedEur - recoveredEur,
      stillHeld: totalBought - totalSold,
      realizedPnL, manualPnL: manualPnLSum,
      buys:  buys.map(b => ({ date: b.date, qty: b.quantity!, price: b.amount / b.quantity!, amount: b.amount })),
      sells: sells.map(s => ({ date: s.date, qty: s.quantity!, price: s.amount / s.quantity!, amount: s.amount, pnlManual: s.pnl ?? null })),
    }
  }).filter(t => t.buys.length > 0 || t.sells.length > 0)
}

function TickerPnLSection({ moves }: { moves: CapitalMove[] }) {
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [livePrices, setLive]     = useState<Record<string, number>>({})
  const [fetchingLive, setFetch]  = useState(false)

  const data = computeTickerPnL(moves)
  if (data.length === 0) return null

  const tickersWithHoldings = data.filter(t => t.stillHeld > 0).map(t => t.ticker)

  async function fetchLive() {
    if (tickersWithHoldings.length === 0) return
    setFetch(true)
    const results: Record<string, number> = {}
    await Promise.all(tickersWithHoldings.map(async ticker => {
      try {
        const r = await fetch(`/api/prices/stock?ticker=${encodeURIComponent(ticker)}`)
        const d = await r.json()
        if (d.price) results[ticker] = d.price
      } catch {}
    }))
    setLive(results); setFetch(false)
  }

  const totalRealized = data.reduce((s, t) => s + t.realizedPnL, 0)
  const totalLatent   = data.reduce((s, t) => {
    if (t.stillHeld <= 0 || !livePrices[t.ticker]) return s
    return s + t.stillHeld * (livePrices[t.ticker] - t.avgBuyPrice)
  }, 0)
  const hasLive = Object.keys(livePrices).length > 0

  return (
    <div style={cardCss}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f2' }}>Analyse P&L par ticker</div>
          <div style={{ fontSize: 11, color: '#636385', marginTop: 2 }}>Calcul FIFO automatique · clic sur un ticker pour le détail</div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {tickersWithHoldings.length > 0 && (
            <button onClick={fetchLive} disabled={fetchingLive} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600, background: '#1c1c27', border: '1px solid #252535', color: '#636385', opacity: fetchingLive ? 0.5 : 1 }}>
              {fetchingLive ? 'Chargement…' : '↻ Prix live'}
            </button>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#636385' }}>P&L réalisé</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: totalRealized >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
              {totalRealized >= 0 ? '+' : ''}{fmt(totalRealized)}
            </div>
          </div>
          {hasLive && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#636385' }}>P&L latent</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: totalLatent >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                {totalLatent >= 0 ? '+' : ''}{fmt(totalLatent)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(t => {
          const isOpen    = expanded === t.ticker
          const livePrice = livePrices[t.ticker]
          const latentPnL = t.stillHeld > 0 && livePrice ? t.stillHeld * (livePrice - t.avgBuyPrice) : null
          const latentPct = latentPnL != null && t.netInvested > 0 ? (latentPnL / t.netInvested) * 100 : null
          const realPct   = t.investedEur > 0 ? (t.realizedPnL / t.investedEur) * 100 : 0

          return (
            <div key={t.ticker} style={{ border: '1px solid #252535', borderRadius: 10, overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded(e => e === t.ticker ? null : t.ticker)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', cursor: 'pointer', background: isOpen ? '#1c1c27' : 'transparent' }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#1c1c27' }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}>

                {/* Ticker + position restante */}
                <div style={{ minWidth: 90 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8f2' }}>{t.ticker}</span>
                  {t.stillHeld > 0
                    ? <div style={{ fontSize: 10, color: '#636385', marginTop: 1 }}>{t.stillHeld.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} en pf</div>
                    : <div style={{ fontSize: 10, color: '#3a3a50', marginTop: 1 }}>Position clôturée</div>
                  }
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 20, flex: 1, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#636385' }}>PRU moyen</div>
                    <div style={{ fontSize: 12, color: '#e8e8f2', fontWeight: 600 }}>{t.avgBuyPrice.toFixed(4)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#636385' }}>Investi</div>
                    <div style={{ fontSize: 12, color: '#e8e8f2' }}>{fmt(t.investedEur)}</div>
                  </div>
                  {t.totalSold > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: '#636385' }}>Récupéré</div>
                      <div style={{ fontSize: 12, color: '#e8e8f2' }}>{fmt(t.recoveredEur)}</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 10, color: '#636385' }}>Capital net immobilisé</div>
                    <div style={{ fontSize: 12, color: '#e8e8f2', fontWeight: 600 }}>{fmt(Math.max(0, t.netInvested))}</div>
                  </div>
                  {livePrice && t.stillHeld > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: '#636385' }}>Prix live</div>
                      <div style={{ fontSize: 12, color: '#e8e8f2' }}>{livePrice.toFixed(4)}</div>
                    </div>
                  )}
                </div>

                {/* P&L colonne droite */}
                <div style={{ textAlign: 'right', minWidth: 130 }}>
                  {t.totalSold > 0 && (
                    <div style={{ marginBottom: latentPnL != null ? 4 : 0 }}>
                      <div style={{ fontSize: 12, color: '#636385' }}>Réalisé</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.realizedPnL >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                        {t.realizedPnL >= 0 ? '+' : ''}{fmt(t.realizedPnL)}
                      </div>
                      <div style={{ fontSize: 10, color: t.realizedPnL >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{realPct >= 0 ? '+' : ''}{realPct.toFixed(2)}%</div>
                    </div>
                  )}
                  {latentPnL != null && (
                    <div>
                      <div style={{ fontSize: 12, color: '#636385' }}>Latent</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: latentPnL >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
                        {latentPnL >= 0 ? '+' : ''}{fmt(latentPnL)}
                      </div>
                      {latentPct != null && <div style={{ fontSize: 10, color: latentPnL >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{latentPct >= 0 ? '+' : ''}{latentPct.toFixed(2)}%</div>}
                    </div>
                  )}
                  {t.totalSold === 0 && latentPnL == null && (
                    <span style={{ fontSize: 11, color: '#636385' }}>↻ Prix live</span>
                  )}
                </div>

                <span style={{ color: '#636385', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {/* Détail */}
              {isOpen && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid #252535', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#636385', fontWeight: 600, marginBottom: 8 }}>ACHATS</div>
                    {t.buys.map((b, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#e8e8f2', marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #1c1c27' }}>
                        <span style={{ color: '#636385' }}>{new Date(b.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span>{b.qty.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} × {b.price.toFixed(4)}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#636385', fontWeight: 600, marginBottom: 8 }}>VENTES</div>
                    {t.sells.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#3a3a50' }}>Aucune vente enregistrée</div>
                    ) : t.sells.map((s, i) => {
                      const costFifo = t.avgBuyPrice * s.qty
                      const pnlRow   = s.amount - costFifo
                      return (
                        <div key={i} style={{ marginBottom: 4, paddingBottom: 4, borderBottom: '1px solid #1c1c27' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#e8e8f2' }}>
                            <span style={{ color: '#636385' }}>{new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span>{s.qty.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} × {s.price.toFixed(4)}</span>
                            <span style={{ fontWeight: 600 }}>{fmt(s.amount)}</span>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: 11, color: pnlRow >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', marginTop: 2 }}>
                            P&L FIFO : {pnlRow >= 0 ? '+' : ''}{fmt(pnlRow)}
                            {s.pnlManual != null && <span style={{ color: '#636385', marginLeft: 6 }}>(manuel : {s.pnlManual >= 0 ? '+' : ''}{fmt(s.pnlManual)})</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared form fields ────────────────────────────────────────────────────────
interface FormState {
  date: string; type: string; account: string; ticker: string
  label: string; quantity: string; priceUnit: string; amount: string
  currency: string; pnl: string; notes: string
}
function emptyForm(): FormState {
  return { date: new Date().toISOString().slice(0, 10), type: 'deposit', account: 'PEA', ticker: '', label: '', quantity: '', priceUnit: '', amount: '', currency: 'EUR', pnl: '', notes: '' }
}
function moveToForm(m: CapitalMove): FormState {
  return {
    date: m.date, type: m.type, account: m.account,
    ticker: m.ticker ?? '', label: m.label,
    quantity: m.quantity != null ? String(m.quantity) : '',
    priceUnit: m.priceUnit != null ? String(m.priceUnit) : '',
    amount: String(m.amount), currency: m.currency,
    pnl: m.pnl != null ? String(m.pnl) : '', notes: m.notes ?? '',
  }
}

function MoveForm({
  form, setForm, onSubmit, onCancel, saving, err, submitLabel,
}: {
  form: FormState; setForm: (f: FormState) => void
  onSubmit: (e: React.FormEvent) => void; onCancel: () => void
  saving: boolean; err: string; submitLabel: string
}) {
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value })
  const isTrade = form.type === 'buy' || form.type === 'sell'

  useEffect(() => {
    if (!isTrade) return
    const q = parseFloat(form.quantity), p = parseFloat(form.priceUnit)
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0)
      setForm({ ...form, amount: (q * p).toFixed(2) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.quantity, form.priceUnit, isTrade])

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={set('date')} style={inputStyle} required /></div>
        <div><label style={labelStyle}>Type</label>
          <select value={form.type} onChange={set('type')} style={inputStyle}>
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Compte</label>
          <select value={form.account} onChange={set('account')} style={inputStyle}>
            {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Devise</label>
          <select value={form.currency} onChange={set('currency')} style={inputStyle}>
            <option value="EUR">EUR €</option>
            <option value="USD">USD $</option>
          </select>
        </div>
      </div>

      {isTrade && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div><label style={labelStyle}>Ticker</label><input placeholder="ex: AAPL, BTC…" value={form.ticker} onChange={set('ticker')} style={inputStyle} /></div>
          <div><label style={labelStyle}>Quantité</label><input type="number" step="any" min="0" placeholder="0" value={form.quantity} onChange={set('quantity')} style={inputStyle} /></div>
          <div><label style={labelStyle}>Prix unitaire</label><input type="number" step="any" min="0" placeholder="0.00" value={form.priceUnit} onChange={set('priceUnit')} style={inputStyle} /></div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isTrade && form.type === 'sell' ? '2fr 1fr 1fr' : '2fr 1fr', gap: 12 }}>
        <div><label style={labelStyle}>Libellé (optionnel)</label><input placeholder={TYPE_LABELS[form.type] + (form.ticker ? ` ${form.ticker}` : '')} value={form.label} onChange={set('label')} style={inputStyle} /></div>
        <div><label style={labelStyle}>Montant ({form.currency})</label><input type="number" step="any" min="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} style={inputStyle} required /></div>
        {form.type === 'sell' && <div><label style={labelStyle}>P&L réalisé ({form.currency})</label><input type="number" step="any" placeholder="0.00" value={form.pnl} onChange={set('pnl')} style={inputStyle} /></div>}
      </div>

      <div><label style={labelStyle}>Notes (optionnel)</label>
        <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Ex: Réinvesti dans MSFT suite vente de TSLA…" style={{ ...inputStyle, resize: 'vertical' }} />
      </div>

      {err && <div style={{ fontSize: 12, color: 'oklch(62% 0.20 25)' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{ padding: '9px 20px', borderRadius: 8, background: 'transparent', border: '1px solid #252535', color: '#636385', cursor: 'pointer', fontFamily: 'Inter', fontSize: 13 }}>Annuler</button>
        <button type="submit" disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, background: 'oklch(63% 0.19 250)', border: 'none', color: '#fff', cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter', fontWeight: 600, fontSize: 13, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

// ── Add form (collapsible) ────────────────────────────────────────────────────
function AddForm({ onAdded }: { onAdded: () => void }) {
  const [form, setForm]     = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const [open, setOpen]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const isTrade = form.type === 'buy' || form.type === 'sell'
      const body: Record<string, unknown> = {
        date: form.date, type: form.type, account: form.account, currency: form.currency,
        label: form.label || (TYPE_LABELS[form.type] + (form.ticker ? ` ${form.ticker}` : '')),
        amount: form.amount,
      }
      if (isTrade && form.ticker)    body.ticker    = form.ticker
      if (isTrade && form.quantity)  body.quantity  = form.quantity
      if (isTrade && form.priceUnit) body.priceUnit = form.priceUnit
      if (form.type === 'sell' && form.pnl) body.pnl = form.pnl
      if (form.notes) body.notes = form.notes
      const res = await fetch('/api/capital-moves', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { setErr(d.error ?? 'Erreur'); return }
      setForm(emptyForm()); setOpen(false); onAdded()
    } catch { setErr('Erreur réseau') }
    finally { setSaving(false) }
  }

  return (
    <div style={cardCss}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#e8e8f2', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14 }}>
        <span style={{ fontSize: 18, color: 'oklch(63% 0.19 250)' }}>{open ? '▾' : '▸'}</span>
        Nouveau mouvement
      </button>
      {open && (
        <div style={{ marginTop: 18 }}>
          <MoveForm form={form} setForm={setForm} onSubmit={submit} onCancel={() => { setOpen(false); setForm(emptyForm()) }} saving={saving} err={err} submitLabel="Enregistrer" />
        </div>
      )}
    </div>
  )
}

// ── Edit form (inline under the row) ─────────────────────────────────────────
function EditForm({ move, onSaved, onCancel }: { move: CapitalMove; onSaved: (updated: CapitalMove) => void; onCancel: () => void }) {
  const [form, setForm]     = useState<FormState>(moveToForm(move))
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr('')
    try {
      const isTrade = form.type === 'buy' || form.type === 'sell'
      const body: Record<string, unknown> = {
        id: move.id, date: form.date, type: form.type, account: form.account, currency: form.currency,
        label: form.label || (TYPE_LABELS[form.type] + (form.ticker ? ` ${form.ticker}` : '')),
        amount: form.amount,
        ticker:    isTrade && form.ticker    ? form.ticker    : null,
        quantity:  isTrade && form.quantity  ? form.quantity  : null,
        priceUnit: isTrade && form.priceUnit ? form.priceUnit : null,
        pnl:   form.type === 'sell' && form.pnl ? form.pnl : null,
        notes: form.notes || null,
      }
      const res = await fetch('/api/capital-moves', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { setErr(d.error ?? 'Erreur'); return }
      onSaved({
        ...move,
        date: form.date, type: form.type as CapitalMove['type'], account: form.account as CapitalMove['account'],
        ticker: body.ticker as string | null, label: body.label as string,
        quantity:  form.quantity  ? parseFloat(form.quantity)  : null,
        priceUnit: form.priceUnit ? parseFloat(form.priceUnit) : null,
        amount: parseFloat(form.amount), currency: form.currency,
        pnl:   form.pnl   ? parseFloat(form.pnl)   : null,
        notes: form.notes || null,
      })
    } catch { setErr('Erreur réseau') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '16px 20px', background: '#0e0e16', borderTop: '1px solid #252535' }}>
      <div style={{ fontSize: 11, color: '#636385', marginBottom: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Modifier l&apos;entrée</div>
      <MoveForm form={form} setForm={setForm} onSubmit={submit} onCancel={onCancel} saving={saving} err={err} submitLabel="Sauvegarder" />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function JournalPage() {
  const [moves, setMoves]       = useState<CapitalMove[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterType, setFT]     = useState('all')
  const [filterAccount, setFA]  = useState('all')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editing, setEditing]   = useState<string | null>(null)

  const load = useCallback(async () => {
    try { const r = await fetch('/api/capital-moves'); if (r.ok) setMoves(await r.json()) } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function remove(id: string) {
    setDeleting(id)
    await fetch('/api/capital-moves', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setMoves(m => m.filter(x => x.id !== id))
    setDeleting(null)
  }

  function handleSaved(updated: CapitalMove) {
    setMoves(m => m.map(x => x.id === updated.id ? updated : x))
    setEditing(null)
  }

  const filtered = moves.filter(m =>
    (filterType    === 'all' || m.type    === filterType) &&
    (filterAccount === 'all' || m.account === filterAccount)
  )

  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600,
    background: active ? 'oklch(63% 0.19 250 / 0.2)' : '#1c1c27',
    border: `1px solid ${active ? 'oklch(63% 0.19 250 / 0.5)' : '#252535'}`,
    color: active ? 'oklch(63% 0.19 250)' : '#636385',
  })

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Journal d&apos;investissement</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Dépôts, retraits, achats et ventes avec P&L</p>
      </div>

      {!loading && <SummaryBar moves={moves} />}

      {!loading && moves.some(m => m.ticker) && <TickerPnLSection moves={moves} />}

      <AddForm onAdded={load} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#636385', marginRight: 4 }}>Type :</span>
        {(['all', ...TYPES] as string[]).map(t => (
          <button key={t} onClick={() => setFT(t)} style={pillBtn(filterType === t)}>
            {t === 'all' ? 'Tous' : TYPE_LABELS[t]}
          </button>
        ))}
        <span style={{ fontSize: 11, color: '#636385', margin: '0 4px 0 12px' }}>Compte :</span>
        {(['all', ...ACCOUNTS] as string[]).map(a => (
          <button key={a} onClick={() => setFA(a)} style={pillBtn(filterAccount === a)}>
            {a === 'all' ? 'Tous' : a}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...cardCss, padding: 0, overflow: 'hidden' }}>
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
                <tr style={{ background: '#0e0e16' }}>
                  {['Date', 'Type', 'Compte', 'Libellé / Ticker', 'Qté', 'Prix unit.', 'Montant', 'P&L réalisé', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11, color: '#636385', borderBottom: '1px solid #252535', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <>
                    <tr key={m.id}
                      style={{ borderBottom: editing === m.id ? 'none' : '1px solid #1c1c27', background: editing === m.id ? '#0e0e16' : 'transparent', cursor: 'pointer' }}
                      onClick={() => setEditing(e => e === m.id ? null : m.id)}
                      onMouseEnter={e => { if (editing !== m.id) e.currentTarget.style.background = '#1c1c27' }}
                      onMouseLeave={e => { if (editing !== m.id) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '11px 12px', fontSize: 12, color: '#636385', whiteSpace: 'nowrap' }}>
                        {new Date(m.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '11px 12px' }}><Badge val={m.type} /></td>
                      <td style={{ padding: '11px 12px' }}><AccountBadge account={m.account} /></td>
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
                            {m.amount > 0 && <div style={{ fontSize: 10, color: m.pnl >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{((m.pnl / m.amount) * 100).toFixed(1)}%</div>}
                          </div>
                        ) : <span style={{ color: '#3a3a50', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setEditing(e => e === m.id ? null : m.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: editing === m.id ? 'oklch(63% 0.19 250)' : '#636385', fontSize: 13, padding: '2px 6px', marginRight: 2 }}
                          title="Modifier">✎</button>
                        <button onClick={() => remove(m.id)} disabled={deleting === m.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636385', fontSize: 14, opacity: deleting === m.id ? 0.4 : 0.6, padding: '2px 4px' }}
                          title="Supprimer">×</button>
                      </td>
                    </tr>
                    {editing === m.id && (
                      <tr key={`${m.id}-edit`}>
                        <td colSpan={9} style={{ padding: 0, borderBottom: '1px solid #252535' }}>
                          <EditForm move={m} onSaved={handleSaved} onCancel={() => setEditing(null)} />
                        </td>
                      </tr>
                    )}
                  </>
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
