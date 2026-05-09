'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, currentMonthKey, addMonths, monthLabel, resolveBudget, calcSurplus, COLOR_LIST, cardCss, inputCss } from '@/lib/utils'
import type { Budget } from '@/lib/types'

// ── Sankey ────────────────────────────────────────────────────────────────────
interface SNode { id: string; label: string; val: number; color: string; x: number; y: number; h: number; layer: number }
interface SLink { sx: number; sy: number; tx: number; ty: number; h: number; color: string; label: string; val: number }

function sankeyLayout(budget: Budget) {
  const W = 560, nodeW = 14, gap = 10, padY = 16
  const totalIncome  = budget.incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = budget.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const totalSaving  = budget.savings.reduce((s, i) => s + i.amount, 0)
  const surplus      = totalIncome - totalExpense - totalSaving
  const maxVal = Math.max(totalIncome, 1)
  const H_scale = 280
  const layerX = [padY + 50, W * 0.32, W * 0.62, W - nodeW - padY - 40]

  const nodes: SNode[] = []
  const links: SLink[] = []

  let yOff = padY
  for (const inc of budget.incomes) {
    const h = Math.max((inc.amount / maxVal) * H_scale, 6)
    nodes.push({ id: `i-${inc.id}`, label: inc.label, val: inc.amount, color: inc.color, x: layerX[0], y: yOff, h, layer: 0 })
    yOff += h + gap
  }
  const totalH = Math.max(yOff, (totalIncome / maxVal) * H_scale + padY * 2)

  const balH = Math.max((totalIncome / maxVal) * H_scale, 6)
  const balNode: SNode = { id: 'bal', label: 'Budget', val: totalIncome, color: 'oklch(63% 0.19 250)', x: layerX[1], y: padY, h: balH, layer: 1 }
  nodes.push(balNode)

  yOff = padY
  const rightNodes: SNode[] = []
  for (const cat of budget.expenses) {
    const total = cat.items.reduce((s, i) => s + i.amount, 0)
    if (total === 0) continue
    const h = Math.max((total / maxVal) * H_scale, 6)
    rightNodes.push({ id: `c-${cat.label}`, label: cat.label, val: total, color: cat.items[0]?.color ?? '#636385', x: layerX[2], y: yOff, h, layer: 2 })
    yOff += h + gap
  }
  for (const sav of budget.savings) {
    if (sav.amount === 0) continue
    const h = Math.max((sav.amount / maxVal) * H_scale, 6)
    rightNodes.push({ id: `s-${sav.id}`, label: sav.label, val: sav.amount, color: sav.color, x: layerX[2], y: yOff, h, layer: 2 })
    yOff += h + gap
  }
  if (surplus > 0) {
    const h = Math.max((surplus / maxVal) * H_scale, 6)
    rightNodes.push({ id: 'surp', label: 'Surplus / Économies +', val: surplus, color: 'oklch(65% 0.18 148)', x: layerX[2], y: yOff, h, layer: 2 })
  }
  nodes.push(...rightNodes)

  let srcOff = 0
  for (const n of nodes.filter(n => n.layer === 0)) {
    const lh = Math.max((n.val / maxVal) * H_scale, 4)
    links.push({ sx: n.x + nodeW, sy: n.y + n.h / 2 - lh / 2, tx: balNode.x, ty: balNode.y + srcOff, h: lh, color: n.color, label: n.label, val: n.val })
    srcOff += lh
  }
  let dstOff = 0
  for (const n of rightNodes) {
    const lh = Math.max((n.val / maxVal) * H_scale, 4)
    links.push({ sx: balNode.x + nodeW, sy: balNode.y + dstOff, tx: n.x, ty: n.y + n.h / 2 - lh / 2, h: lh, color: n.color, label: n.label, val: n.val })
    dstOff += lh
  }

  return { nodes, links, W, H: Math.max(totalH, yOff + padY, 300) }
}

function SankeyDiagram({ budget }: { budget: Budget }) {
  const [hover, setHover] = useState<string | null>(null)
  const { nodes, links, W, H } = useMemo(() => sankeyLayout(budget), [budget])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
      {links.map((l, i) => {
        const mx = (l.sx + l.tx) / 2
        const p = `M${l.sx},${l.sy} C${mx},${l.sy} ${mx},${l.ty} ${l.tx},${l.ty} L${l.tx},${l.ty+l.h} C${mx},${l.ty+l.h} ${mx},${l.sy+l.h} ${l.sx},${l.sy+l.h}Z`
        return <path key={i} d={p} fill={l.color} fillOpacity={hover === l.label ? 0.65 : 0.28}
          onMouseEnter={() => setHover(l.label)} onMouseLeave={() => setHover(null)} style={{ transition: 'fill-opacity 0.15s', cursor: 'pointer' }} />
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={14} height={n.h} rx={3} fill={n.color} />
          <text x={n.layer < 2 ? n.x - 7 : n.x + 22} y={n.y + n.h / 2 + 4}
            textAnchor={n.layer < 2 ? 'end' : 'start'} fontSize={10} fill="#e8e8f2" fontFamily="Inter, sans-serif">{n.label}</text>
          <text x={n.layer < 2 ? n.x - 7 : n.x + 22} y={n.y + n.h / 2 + 15}
            textAnchor={n.layer < 2 ? 'end' : 'start'} fontSize={9} fill="#636385" fontFamily="Inter, sans-serif">{fmt(n.val)}</text>
        </g>
      ))}
    </svg>
  )
}

// ── Inline editable field ─────────────────────────────────────────────────────
function InlineAmount({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() {
    const n = parseFloat(draft.replace(',', '.'))
    if (!isNaN(n) && n >= 0) onSave(n)
    setEditing(false)
  }

  if (editing) return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ ...inputCss, width: 80, padding: '2px 6px', fontSize: 12, textAlign: 'right' }}
    />
  )

  return (
    <span
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      title="Cliquer pour modifier"
      style={{ fontSize: 12, color: '#e8e8f2', fontWeight: 500, cursor: 'text', borderBottom: '1px dashed #2a2a3a', paddingBottom: 1 }}
    >
      {value.toLocaleString('fr-FR')} €
    </span>
  )
}

function InlineLabel({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  function commit() {
    if (draft.trim()) onSave(draft.trim())
    setEditing(false)
  }

  if (editing) return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      style={{ ...inputCss, flex: 1, padding: '2px 6px', fontSize: 12 }}
    />
  )

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true) }}
      title="Cliquer pour modifier"
      style={{ fontSize: 12, color: '#e8e8f2', cursor: 'text', borderBottom: '1px dashed #2a2a3a', paddingBottom: 1 }}
    >
      {value}
    </span>
  )
}

// ── Budget panel (inline editable) ────────────────────────────────────────────
function BudgetPanel({ budget, onSave }: { budget: Budget; onSave: (b: Budget) => void }) {
  const totalIncome  = budget.incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = budget.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const totalSaving  = budget.savings.reduce((s, i) => s + i.amount, 0)
  const surplus      = totalIncome - totalExpense - totalSaving

  function updateIncome(id: string, patch: Partial<{ label: string; amount: number }>) {
    onSave({ ...budget, incomes: budget.incomes.map(i => i.id === id ? { ...i, ...patch } : i) })
  }
  function deleteIncome(id: string) {
    onSave({ ...budget, incomes: budget.incomes.filter(i => i.id !== id) })
  }
  function addIncome() {
    onSave({ ...budget, incomes: [...budget.incomes, { id: `i${Date.now()}`, label: 'Nouveau revenu', amount: 0, color: COLOR_LIST[budget.incomes.length % COLOR_LIST.length] }] })
  }

  function updateExpenseCategoryLabel(oldLabel: string, newLabel: string) {
    onSave({
      ...budget,
      expenses: budget.expenses.map(cat => cat.label === oldLabel ? { ...cat, label: newLabel } : cat),
    })
  }
  function updateExpenseItem(catLabel: string, itemLabel: string, patch: Partial<{ label: string; amount: number }>) {
    onSave({
      ...budget,
      expenses: budget.expenses.map(cat =>
        cat.label === catLabel
          ? { ...cat, items: cat.items.map(i => i.label === itemLabel ? { ...i, ...patch } : i) }
          : cat
      ),
    })
  }
  function deleteExpenseItem(catLabel: string, itemLabel: string) {
    onSave({
      ...budget,
      expenses: budget.expenses.map(cat =>
        cat.label === catLabel ? { ...cat, items: cat.items.filter(i => i.label !== itemLabel) } : cat
      ).filter(cat => cat.items.length > 0),
    })
  }
  function addExpenseItem(catLabel: string) {
    onSave({
      ...budget,
      expenses: budget.expenses.map(cat =>
        cat.label === catLabel
          ? { ...cat, items: [...cat.items, { label: 'Dépense', amount: 0, color: COLOR_LIST[cat.items.length % COLOR_LIST.length] }] }
          : cat
      ),
    })
  }
  function addExpenseCategory() {
    onSave({ ...budget, expenses: [...budget.expenses, { id: `c${Date.now()}`, label: 'Catégorie', items: [{ label: 'Dépense', amount: 0, color: COLOR_LIST[0] }] }] })
  }

  function updateSaving(id: string, patch: Partial<{ label: string; amount: number }>) {
    onSave({ ...budget, savings: budget.savings.map(s => s.id === id ? { ...s, ...patch } : s) })
  }
  function deleteSaving(id: string) {
    onSave({ ...budget, savings: budget.savings.filter(s => s.id !== id) })
  }
  function addSaving() {
    onSave({ ...budget, savings: [...budget.savings, { id: `s${Date.now()}`, label: 'Épargne', amount: 0, color: COLOR_LIST[budget.savings.length % COLOR_LIST.length] }] })
  }

  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#3a3a50', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1, flexShrink: 0 }
  const addBtn: React.CSSProperties = { background: 'none', border: '1px dashed #2a2a3a', borderRadius: 5, color: '#3a3a50', cursor: 'pointer', fontSize: 11, padding: '3px 8px', fontFamily: 'Inter', width: '100%', textAlign: 'left', marginTop: 4 }

  return (
    <div style={{ ...cardCss, display: 'flex', flexDirection: 'column', gap: 0, minWidth: 280, maxWidth: 320 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f2', marginBottom: 14 }}>Budget mensuel de base</div>

      {/* REVENUS */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'oklch(65% 0.18 148)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>↑ REVENUS</div>
        {budget.incomes.map(inc => (
          <div key={inc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #1c1c27' }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: inc.color, flexShrink: 0 }} />
            <InlineLabel value={inc.label} onSave={v => updateIncome(inc.id, { label: v })} />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <InlineAmount value={inc.amount} onSave={v => updateIncome(inc.id, { amount: v })} />
              <button style={iconBtn} onClick={() => deleteIncome(inc.id)} title="Supprimer">✕</button>
            </div>
          </div>
        ))}
        <button style={addBtn} onClick={addIncome}>+ Ajouter un revenu</button>
      </div>

      {/* DÉPENSES */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'oklch(62% 0.20 25)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>↓ DÉPENSES</div>
        {budget.expenses.map(cat => {
          const total = cat.items.reduce((s, i) => s + i.amount, 0)
          return (
            <div key={cat.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #252535' }}>
                <InlineLabel value={cat.label} onSave={v => updateExpenseCategoryLabel(cat.label, v)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#636385' }}>{total.toLocaleString('fr-FR')} €</span>
                  <button style={iconBtn} onClick={() => addExpenseItem(cat.label)} title="Ajouter une ligne">+</button>
                </div>
              </div>
              {cat.items.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0 3px 12px', borderBottom: '1px solid #13131b' }}>
                  <div style={{ width: 5, height: 5, borderRadius: 1, background: item.color ?? '#636385', flexShrink: 0 }} />
                  <InlineLabel value={item.label} onSave={v => updateExpenseItem(cat.label, item.label, { label: v })} />
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <InlineAmount value={item.amount} onSave={v => updateExpenseItem(cat.label, item.label, { amount: v })} />
                    <button style={iconBtn} onClick={() => deleteExpenseItem(cat.label, item.label)} title="Supprimer">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        <button style={addBtn} onClick={addExpenseCategory}>+ Ajouter une catégorie</button>
      </div>

      {/* ÉPARGNE */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: 'oklch(63% 0.19 250)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>○ ÉPARGNE</div>
        {budget.savings.map(sav => (
          <div key={sav.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #1c1c27' }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: sav.color, flexShrink: 0 }} />
            <InlineLabel value={sav.label} onSave={v => updateSaving(sav.id, { label: v })} />
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <InlineAmount value={sav.amount} onSave={v => updateSaving(sav.id, { amount: v })} />
              <button style={iconBtn} onClick={() => deleteSaving(sav.id)} title="Supprimer">✕</button>
            </div>
          </div>
        ))}
        <button style={addBtn} onClick={addSaving}>+ Ajouter une épargne</button>
      </div>

      {/* SURPLUS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #252535' }}>
        <span style={{ fontSize: 12, color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', fontWeight: 600 }}>Surplus / Économies</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>
          {surplus >= 0 ? '+' : ''}{surplus.toLocaleString('fr-FR')} €
        </span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FluxPage() {
  const { budget, monthPlans, saveBudget, loading } = useAppData()
  const curKey = currentMonthKey()
  const resolved = useMemo(() => resolveBudget(budget, monthPlans, curKey), [budget, monthPlans, curKey])

  const totalIncome  = resolved.incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = resolved.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const totalSaving  = resolved.savings.reduce((s, i) => s + i.amount, 0)
  const surplus      = totalIncome - totalExpense - totalSaving
  const savingRate   = totalIncome > 0 ? ((totalSaving + Math.max(surplus, 0)) / totalIncome) * 100 : 0

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  const kpis = [
    { label: 'Revenus',        val: fmt(totalIncome),           color: 'oklch(65% 0.18 148)', icon: '↑' },
    { label: 'Dépenses',       val: fmt(totalExpense),          color: 'oklch(62% 0.20 25)',  icon: '↓' },
    { label: 'Épargne',        val: fmt(totalSaving),           color: 'oklch(63% 0.19 250)', icon: '○' },
    { label: 'Surplus',        val: fmt(surplus),               color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)', icon: '+' },
    { label: "Taux d'épargne", val: savingRate.toFixed(1) + '%', color: 'oklch(78% 0.16 80)', icon: '◎' },
  ]

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>Flux budgétaires</h1>
        <p style={{ fontSize: 12, color: '#636385', margin: '2px 0 0' }}>Visualisez et modifiez vos flux d&apos;argent</p>
      </div>

      {/* KPIs */}
      <div className="grid-5" style={{ gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...cardCss, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: `${k.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: k.color, flexShrink: 0 }}>
              {k.icon}
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#636385', marginBottom: 2 }}>{k.label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: k.color }}>{k.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sankey + Budget panel */}
      {totalIncome > 0 && (
        <div className="grid-sankey">
          <div style={cardCss}>
            <SankeyDiagram budget={resolved} />
          </div>
          <BudgetPanel budget={budget} onSave={saveBudget} />
        </div>
      )}

      {totalIncome === 0 && (
        <div style={{ ...cardCss, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ color: '#e8e8f2', fontWeight: 600, marginBottom: 8 }}>Aucun budget configuré</div>
          <div style={{ color: '#636385', fontSize: 13, marginBottom: 20 }}>Utilisez le panneau de droite pour ajouter vos revenus et dépenses.</div>
          <BudgetPanel budget={budget} onSave={saveBudget} />
        </div>
      )}

    </div>
  )
}
