'use client'
import { useState } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, TX_CATEGORIES, COLOR_LIST, cardCss, inputCss, btnCss } from '@/lib/utils'
import type { Budget, Portfolio } from '@/lib/types'

type Tab = 'budget' | 'portfolio' | 'export'

export default function ConfigPage() {
  const { budget, portfolio, transactions, saveBudget, savePortfolio, loading } = useAppData()
  const [tab, setTab] = useState<Tab>('budget')
  const [b, setB] = useState<Budget | null>(null)
  const [p, setP] = useState<Portfolio | null>(null)
  const [saved, setSaved] = useState(false)

  const editBudget = b ?? budget
  const editPortfolio = p ?? portfolio

  function markSaved() { setSaved(true); setTimeout(() => setSaved(false), 2000) }

  async function saveBudgetChanges() {
    if (!b) return
    await saveBudget(b)
    setB(null)
    markSaved()
  }

  async function savePortfolioChanges() {
    if (!p) return
    await savePortfolio(p)
    setP(null)
    markSaved()
  }

  function exportData() {
    const data = { budget, portfolio, transactions, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `findash-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Configuration</h1>
        {saved && <span style={{ fontSize: 12, color: 'oklch(65% 0.18 148)', fontWeight: 600 }}>✓ Enregistré</span>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {([
          { key: 'budget',    label: 'Budget' },
          { key: 'portfolio', label: 'Patrimoine' },
          { key: 'export',    label: 'Export / Import' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 18px', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter', fontWeight: tab === t.key ? 600 : 400,
            background: tab === t.key ? 'oklch(63% 0.19 250)' : '#1c1c27',
            border: `1px solid ${tab === t.key ? 'oklch(63% 0.19 250)' : '#252535'}`,
            color: tab === t.key ? '#fff' : '#636385',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Budget tab */}
      {tab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Revenus */}
          <div style={cardCss}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 14 }}>Revenus</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {editBudget.incomes.map((inc, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input value={inc.label} onChange={e => setB({ ...editBudget, incomes: editBudget.incomes.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} style={{ ...inputCss, flex: 1 }} />
                  <input type="number" value={inc.amount || ''} placeholder="€" onChange={e => setB({ ...editBudget, incomes: editBudget.incomes.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x) })} style={{ ...inputCss, width: 120 }} />
                  <button onClick={() => setB({ ...editBudget, incomes: editBudget.incomes.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                </div>
              ))}
              <button onClick={() => setB({ ...editBudget, incomes: [...editBudget.incomes, { id: `i${Date.now()}`, label: 'Nouveau revenu', amount: 0, color: COLOR_LIST[editBudget.incomes.length % COLOR_LIST.length] }] })}
                style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>+ Ajouter revenu</button>
            </div>
          </div>

          {/* Dépenses */}
          <div style={cardCss}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 14 }}>Dépenses</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {editBudget.expenses.map((cat, ci) => (
                <div key={ci} style={{ background: '#1c1c27', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input value={cat.label} onChange={e => { const cats = [...editBudget.expenses]; cats[ci] = { ...cats[ci], label: e.target.value }; setB({ ...editBudget, expenses: cats }) }} style={{ ...inputCss, flex: 1, fontSize: 12 }} />
                    <button onClick={() => setB({ ...editBudget, expenses: editBudget.expenses.filter((_, j) => j !== ci) })} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>✕</button>
                  </div>
                  {cat.items.map((item, ii) => (
                    <div key={ii} style={{ display: 'flex', gap: 8, marginLeft: 12, marginBottom: 6 }}>
                      <input value={item.label} onChange={e => { const cats = [...editBudget.expenses]; cats[ci] = { ...cats[ci], items: cats[ci].items.map((x, j) => j === ii ? { ...x, label: e.target.value } : x) }; setB({ ...editBudget, expenses: cats }) }} style={{ ...inputCss, flex: 1, fontSize: 12 }} />
                      <input type="number" value={item.amount || ''} placeholder="€" onChange={e => { const cats = [...editBudget.expenses]; cats[ci] = { ...cats[ci], items: cats[ci].items.map((x, j) => j === ii ? { ...x, amount: parseFloat(e.target.value) || 0 } : x) }; setB({ ...editBudget, expenses: cats }) }} style={{ ...inputCss, width: 100, fontSize: 12 }} />
                      <button onClick={() => { const cats = [...editBudget.expenses]; cats[ci] = { ...cats[ci], items: cats[ci].items.filter((_, j) => j !== ii) }; setB({ ...editBudget, expenses: cats }) }} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => { const cats = [...editBudget.expenses]; cats[ci] = { ...cats[ci], items: [...cats[ci].items, { label: 'Dépense', amount: 0, color: COLOR_LIST[cats[ci].items.length % COLOR_LIST.length] }] }; setB({ ...editBudget, expenses: cats }) }}
                    style={{ marginLeft: 12, ...btnCss('#252535', false), color: '#636385', fontSize: 11 }}>+ Ajouter ligne</button>
                </div>
              ))}
              <button onClick={() => setB({ ...editBudget, expenses: [...editBudget.expenses, { id: `c${Date.now()}`, label: 'Nouvelle catégorie', items: [] }] })}
                style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>+ Ajouter catégorie</button>
            </div>
          </div>

          {/* Épargne */}
          <div style={cardCss}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 14 }}>Épargne</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {editBudget.savings.map((sav, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input value={sav.label} onChange={e => setB({ ...editBudget, savings: editBudget.savings.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} style={{ ...inputCss, flex: 1 }} />
                  <input type="number" value={sav.amount || ''} placeholder="€" onChange={e => setB({ ...editBudget, savings: editBudget.savings.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x) })} style={{ ...inputCss, width: 120 }} />
                  <button onClick={() => setB({ ...editBudget, savings: editBudget.savings.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                </div>
              ))}
              <button onClick={() => setB({ ...editBudget, savings: [...editBudget.savings, { id: `s${Date.now()}`, label: 'Nouvelle épargne', amount: 0, color: COLOR_LIST[editBudget.savings.length % COLOR_LIST.length] }] })}
                style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>+ Ajouter épargne</button>
            </div>
          </div>

          {b && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setB(null)} style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>Annuler</button>
              <button onClick={saveBudgetChanges} style={btnCss()}>Enregistrer le budget</button>
            </div>
          )}
        </div>
      )}

      {/* Portfolio tab */}
      {tab === 'portfolio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Livrets */}
          <div style={cardCss}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 14 }}>Livrets d&apos;épargne</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {editPortfolio.livrets.accounts.map((liv, i) => (
                <div key={liv.id} style={{ display: 'flex', gap: 8 }}>
                  <input value={liv.name} placeholder="Nom" onChange={e => { const acc = [...editPortfolio.livrets.accounts]; acc[i] = { ...acc[i], name: e.target.value }; setP({ ...editPortfolio, livrets: { accounts: acc } }) }} style={{ ...inputCss, flex: 1 }} />
                  <input type="number" value={liv.rate || ''} step="0.01" placeholder="Taux %" onChange={e => { const acc = [...editPortfolio.livrets.accounts]; acc[i] = { ...acc[i], rate: parseFloat(e.target.value) || 0 }; setP({ ...editPortfolio, livrets: { accounts: acc } }) }} style={{ ...inputCss, width: 90 }} />
                  <input type="number" value={liv.solde || ''} step="0.01" placeholder="Solde €" onChange={e => { const acc = [...editPortfolio.livrets.accounts]; acc[i] = { ...acc[i], solde: parseFloat(e.target.value) || 0 }; setP({ ...editPortfolio, livrets: { accounts: acc } }) }} style={{ ...inputCss, width: 120 }} />
                  <button onClick={() => setP({ ...editPortfolio, livrets: { accounts: editPortfolio.livrets.accounts.filter((_, j) => j !== i) } })} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                </div>
              ))}
              <button onClick={() => setP({ ...editPortfolio, livrets: { accounts: [...editPortfolio.livrets.accounts, { id: `l${Date.now()}`, name: 'Livret', rate: 3, solde: 0 }] } })}
                style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>+ Ajouter livret</button>
            </div>
          </div>

          {p && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setP(null)} style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>Annuler</button>
              <button onClick={savePortfolioChanges} style={btnCss()}>Enregistrer</button>
            </div>
          )}

          <div style={{ ...cardCss, padding: '14px 18px', fontSize: 12, color: '#636385' }}>
            Pour gérer les positions (actions, ETF, crypto, immobilier), utilisez la page <strong style={{ color: '#e8e8f2' }}>Patrimoine</strong>.
          </div>
        </div>
      )}

      {/* Export tab */}
      {tab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardCss}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 12 }}>Export JSON</div>
            <p style={{ fontSize: 12, color: '#636385', marginBottom: 16 }}>
              Téléchargez toutes vos données (budget, patrimoine, transactions) au format JSON.
            </p>
            <button onClick={exportData} style={btnCss()}>📥 Télécharger l&apos;export</button>
          </div>

          <div style={cardCss}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 12 }}>Résumé des données</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Transactions', val: transactions.length },
                { label: 'Revenus',      val: budget.incomes.length },
                { label: 'Catégories dépenses', val: budget.expenses.length },
                { label: 'Lignes épargne', val: budget.savings.length },
                { label: 'Positions PEA', val: portfolio.pea.positions.length },
                { label: 'Cryptos',      val: portfolio.crypto.positions.length },
              ].map(item => (
                <div key={item.label} style={{ background: '#1c1c27', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>{item.val}</div>
                  <div style={{ fontSize: 11, color: '#636385', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
