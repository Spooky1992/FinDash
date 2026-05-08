'use client'
import { useState, useMemo } from 'react'
import { useAppData } from '@/hooks/useAppData'
import { fmt, currentMonthKey, addMonths, monthLabel, resolveBudget, calcSurplus, COLOR_LIST, cardCss, inputCss, btnCss } from '@/lib/utils'
import type { Budget, MonthPlan } from '@/lib/types'

// ── Sankey ────────────────────────────────────────────────────────────────────
interface SNode { id: string; label: string; val: number; color: string; x: number; y: number; h: number; layer: number }
interface SLink { sx: number; sy: number; tx: number; ty: number; h: number; color: string; label: string; val: number }

function sankeyLayout(budget: Budget) {
  const W = 700, nodeW = 18, gap = 12, padY = 20
  const totalIncome  = budget.incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = budget.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const totalSaving  = budget.savings.reduce((s, i) => s + i.amount, 0)
  const surplus      = totalIncome - totalExpense - totalSaving
  const maxVal = Math.max(totalIncome, 1)
  const H_scale = 260
  const layerX = [padY + 60, W * 0.3, W * 0.58, W - nodeW - padY - 60]

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
    rightNodes.push({ id: 'surp', label: 'Surplus', val: surplus, color: 'oklch(65% 0.18 148)', x: layerX[2], y: yOff, h, layer: 2 })
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

  return { nodes, links, W, H: Math.max(totalH, yOff + padY, 280) }
}

function SankeyDiagram({ budget }: { budget: Budget }) {
  const [hover, setHover] = useState<string | null>(null)
  const { nodes, links, W, H } = useMemo(() => sankeyLayout(budget), [budget])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
      {links.map((l, i) => {
        const mx = (l.sx + l.tx) / 2
        const p = `M${l.sx},${l.sy} C${mx},${l.sy} ${mx},${l.ty} ${l.tx},${l.ty} L${l.tx},${l.ty+l.h} C${mx},${l.ty+l.h} ${mx},${l.sy+l.h} ${l.sx},${l.sy+l.h}Z`
        return <path key={i} d={p} fill={l.color} fillOpacity={hover === l.label ? 0.65 : 0.3}
          onMouseEnter={() => setHover(l.label)} onMouseLeave={() => setHover(null)} style={{ transition: 'fill-opacity 0.15s' }} />
      })}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={18} height={n.h} rx={4} fill={n.color} />
          <text x={n.layer < 2 ? n.x - 8 : n.x + 26} y={n.y + n.h / 2 + 4}
            textAnchor={n.layer < 2 ? 'end' : 'start'} fontSize={11} fill="#e8e8f2">{n.label}</text>
          <text x={n.layer < 2 ? n.x - 8 : n.x + 26} y={n.y + n.h / 2 + 16}
            textAnchor={n.layer < 2 ? 'end' : 'start'} fontSize={10} fill="#636385">{fmt(n.val)}</text>
        </g>
      ))}
    </svg>
  )
}

function MonthGrid({ budget, monthPlans, solde }: { budget: Budget; monthPlans: Record<string, MonthPlan>; solde: number }) {
  const curKey = currentMonthKey()
  let running = solde
  const months = Array.from({ length: 6 }, (_, i) => addMonths(curKey, i - 2))
  for (let i = -2; i < 0; i++) running -= calcSurplus(resolveBudget(budget, monthPlans, addMonths(curKey, i)))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {months.map(key => {
        const b  = resolveBudget(budget, monthPlans, key)
        const s  = calcSurplus(b)
        const before = running
        running += s
        const isCur = key === curKey
        return (
          <div key={key} style={{ ...cardCss, padding: '14px 16px', border: `1px solid ${isCur ? 'oklch(63% 0.19 250 / 0.5)' : '#252535'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: isCur ? 'oklch(63% 0.19 250)' : '#636385', fontWeight: isCur ? 600 : 400 }}>{monthLabel(key)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' }}>{s >= 0 ? '+' : ''}{fmt(s)}</span>
            </div>
            <div style={{ fontSize: 11, color: '#636385', display: 'flex', justifyContent: 'space-between' }}>
              <span>Solde prévu</span><span style={{ color: '#e8e8f2' }}>{fmt(before + s)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EditPanel({ budget, onSave, onCancel }: { budget: Budget; onSave: (b: Budget) => void; onCancel: () => void }) {
  const [b, setB] = useState<Budget>(JSON.parse(JSON.stringify(budget)))
  const [tab, setTab] = useState<'incomes' | 'expenses' | 'savings'>('incomes')

  return (
    <div style={cardCss}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['incomes', 'expenses', 'savings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'Inter', fontWeight: 600,
            background: tab === t ? 'oklch(63% 0.19 250)' : '#1c1c27', border: `1px solid ${tab === t ? 'oklch(63% 0.19 250)' : '#252535'}`,
            color: tab === t ? '#fff' : '#636385' }}>
            {t === 'incomes' ? 'Revenus' : t === 'expenses' ? 'Dépenses' : 'Épargne'}
          </button>
        ))}
      </div>

      {tab === 'incomes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {b.incomes.map((inc, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input value={inc.label} onChange={e => { const n = [...b.incomes]; n[i] = { ...n[i], label: e.target.value }; setB({ ...b, incomes: n }) }} style={{ ...inputCss, flex: 1 }} />
              <input type="number" value={inc.amount || ''} onChange={e => { const n = [...b.incomes]; n[i] = { ...n[i], amount: parseFloat(e.target.value) || 0 }; setB({ ...b, incomes: n }) }} style={{ ...inputCss, width: 110 }} placeholder="€" />
              <button onClick={() => setB({ ...b, incomes: b.incomes.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setB({ ...b, incomes: [...b.incomes, { id: `i${Date.now()}`, label: 'Revenu', amount: 0, color: COLOR_LIST[b.incomes.length % COLOR_LIST.length] }] })}
            style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385', marginTop: 4 }}>+ Ajouter</button>
        </div>
      )}

      {tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {b.expenses.map((cat, ci) => (
            <div key={ci} style={{ background: '#1c1c27', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={cat.label} onChange={e => { const n = [...b.expenses]; n[ci] = { ...n[ci], label: e.target.value }; setB({ ...b, expenses: n }) }} style={{ ...inputCss, flex: 1, fontSize: 12 }} />
                <button onClick={() => setB({ ...b, expenses: b.expenses.filter((_, j) => j !== ci) })} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>✕</button>
              </div>
              {cat.items.map((item, ii) => (
                <div key={ii} style={{ display: 'flex', gap: 8, marginLeft: 12, marginBottom: 6 }}>
                  <input value={item.label} onChange={e => { const cats = [...b.expenses]; cats[ci] = { ...cats[ci], items: cats[ci].items.map((x, j) => j === ii ? { ...x, label: e.target.value } : x) }; setB({ ...b, expenses: cats }) }} style={{ ...inputCss, flex: 1, fontSize: 12 }} />
                  <input type="number" value={item.amount || ''} onChange={e => { const cats = [...b.expenses]; cats[ci] = { ...cats[ci], items: cats[ci].items.map((x, j) => j === ii ? { ...x, amount: parseFloat(e.target.value) || 0 } : x) }; setB({ ...b, expenses: cats }) }} style={{ ...inputCss, width: 90, fontSize: 12 }} placeholder="€" />
                  <button onClick={() => { const cats = [...b.expenses]; cats[ci] = { ...cats[ci], items: cats[ci].items.filter((_, j) => j !== ii) }; setB({ ...b, expenses: cats }) }} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
              <button onClick={() => { const cats = [...b.expenses]; cats[ci] = { ...cats[ci], items: [...cats[ci].items, { label: 'Dépense', amount: 0, color: COLOR_LIST[cats[ci].items.length % COLOR_LIST.length] }] }; setB({ ...b, expenses: cats }) }}
                style={{ marginLeft: 12, ...btnCss('#252535', false), color: '#636385', fontSize: 11 }}>+ item</button>
            </div>
          ))}
          <button onClick={() => setB({ ...b, expenses: [...b.expenses, { id: `c${Date.now()}`, label: 'Catégorie', items: [] }] })}
            style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>+ Catégorie</button>
        </div>
      )}

      {tab === 'savings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {b.savings.map((sav, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input value={sav.label} onChange={e => { const n = [...b.savings]; n[i] = { ...n[i], label: e.target.value }; setB({ ...b, savings: n }) }} style={{ ...inputCss, flex: 1 }} />
              <input type="number" value={sav.amount || ''} onChange={e => { const n = [...b.savings]; n[i] = { ...n[i], amount: parseFloat(e.target.value) || 0 }; setB({ ...b, savings: n }) }} style={{ ...inputCss, width: 110 }} placeholder="€" />
              <button onClick={() => setB({ ...b, savings: b.savings.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: '#636385', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setB({ ...b, savings: [...b.savings, { id: `s${Date.now()}`, label: 'Épargne', amount: 0, color: COLOR_LIST[b.savings.length % COLOR_LIST.length] }] })}
            style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385', marginTop: 4 }}>+ Ajouter</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnCss('#1c1c27', false), border: '1px solid #252535', color: '#636385' }}>Annuler</button>
        <button onClick={() => onSave(b)} style={btnCss()}>Enregistrer</button>
      </div>
    </div>
  )
}

export default function FluxPage() {
  const { budget, monthPlans, compte, saveBudget, loading } = useAppData()
  const [showEdit, setShowEdit] = useState(false)
  const curKey = currentMonthKey()
  const resolved = useMemo(() => resolveBudget(budget, monthPlans, curKey), [budget, monthPlans, curKey])

  const totalIncome  = resolved.incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = resolved.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const totalSaving  = resolved.savings.reduce((s, i) => s + i.amount, 0)
  const surplus = totalIncome - totalExpense - totalSaving

  if (loading) return <div style={{ padding: 32, color: '#636385' }}>Chargement…</div>

  return (
    <div style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Flux — {monthLabel(curKey)}</h1>
        <button onClick={() => setShowEdit(e => !e)} style={btnCss()}>{showEdit ? '✕ Fermer' : '✏ Modifier budget'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Revenus',  val: totalIncome,  color: 'oklch(65% 0.18 148)' },
          { label: 'Dépenses', val: totalExpense, color: 'oklch(62% 0.20 25)'  },
          { label: 'Épargne',  val: totalSaving,  color: 'oklch(63% 0.19 250)' },
          { label: 'Surplus',  val: surplus, color: surplus >= 0 ? 'oklch(65% 0.18 148)' : 'oklch(62% 0.20 25)' },
        ].map(k => (
          <div key={k.label} style={{ ...cardCss, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{fmt(k.val)}</div>
          </div>
        ))}
      </div>

      {showEdit && <EditPanel budget={budget} onSave={async b => { await saveBudget(b); setShowEdit(false) }} onCancel={() => setShowEdit(false)} />}

      {totalIncome > 0 && (
        <div style={cardCss}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2', marginBottom: 20 }}>Flux financier</div>
          <SankeyDiagram budget={resolved} />
        </div>
      )}

      {totalIncome === 0 && !showEdit && (
        <div style={{ ...cardCss, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ color: '#e8e8f2', fontWeight: 600, marginBottom: 8 }}>Aucun budget configuré</div>
          <div style={{ color: '#636385', fontSize: 13, marginBottom: 20 }}>Ajoutez vos revenus et dépenses pour voir votre flux financier.</div>
          <button onClick={() => setShowEdit(true)} style={btnCss()}>Configurer mon budget</button>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f2' }}>Vue mensuelle</div>
      <MonthGrid budget={budget} monthPlans={monthPlans} solde={compte.solde} />
    </div>
  )
}
