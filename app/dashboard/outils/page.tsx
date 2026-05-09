'use client'
import { useState } from 'react'
import { fmt, cardCss, inputCss, btnCss } from '@/lib/utils'

type Tool = 'loan' | 'compound' | 'sim'

function LoanCalc() {
  const [f, setF] = useState({ capital: 200000, rate: 3.5, months: 240, insurance: 0.1 })
  const monthly = (() => {
    const r = f.rate / 100 / 12
    if (r === 0) return f.capital / f.months
    return (f.capital * r * Math.pow(1 + r, f.months)) / (Math.pow(1 + r, f.months) - 1)
  })()
  const insurance = (f.capital * f.insurance / 100) / 12
  const total = (monthly + insurance) * f.months
  const totalInterest = total - f.capital - insurance * f.months

  const schedule = (() => {
    const r = f.rate / 100 / 12
    let remain = f.capital
    return Array.from({ length: Math.min(f.months, 60) }, (_, i) => {
      const interest = remain * r
      const principal = monthly - interest
      remain -= principal
      return { month: i + 1, interest, principal, remain: Math.max(remain, 0) }
    })
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Capital emprunté (€)', key: 'capital', step: 1000, min: 1000 },
          { label: 'Taux annuel (%)',      key: 'rate',    step: 0.1,  min: 0.1 },
          { label: 'Durée (mois)',         key: 'months',  step: 12,   min: 12 },
          { label: "Assurance (%/an)",     key: 'insurance', step: 0.01, min: 0 },
        ].map(field => (
          <div key={field.key}>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>{field.label}</label>
            <input type="number" step={field.step} min={field.min} value={f[field.key as keyof typeof f]}
              onChange={e => setF(x => ({ ...x, [field.key]: parseFloat(e.target.value) || 0 }))} style={inputCss} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Mensualité', val: monthly + insurance, color: 'oklch(63% 0.19 250)' },
          { label: 'Coût total', val: total, color: 'oklch(62% 0.20 25)' },
          { label: 'Intérêts totaux', val: totalInterest, color: 'oklch(68% 0.17 55)' },
        ].map(k => (
          <div key={k.label} style={{ background: '#1c1c27', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{fmt(k.val)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#636385', marginTop: 4 }}>Amortissement — Capital vs Intérêts (60 premiers mois)</div>
      {(() => {
        const rows = schedule.slice(0, 60)
        const W = 600, H = 160, padL = 8, padR = 8, padT = 12, padB = 24
        const barW = Math.floor((W - padL - padR) / rows.length) - 2
        const maxVal = monthly
        const usableH = H - padT - padB
        return (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = padT + (1 - f) * usableH
              return <line key={f} x1={padL} y1={y} x2={W - padR} y2={y} stroke="#1c1c27" strokeWidth={1} />
            })}
            {rows.map((row, i) => {
              const x = padL + i * (barW + 2)
              const hPrincipal = (row.principal / maxVal) * usableH
              const hInterest  = (row.interest  / maxVal) * usableH
              const showLabel  = i % 12 === 0
              return (
                <g key={row.month}>
                  <rect x={x} y={padT + usableH - hPrincipal - hInterest} width={barW / 2} height={hPrincipal} rx={1} fill="oklch(65% 0.18 148)" fillOpacity={0.85} />
                  <rect x={x + barW / 2} y={padT + usableH - hInterest} width={barW / 2} height={hInterest} rx={1} fill="oklch(62% 0.20 25)" fillOpacity={0.85} />
                  {showLabel && <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={8} fill="#636385" fontFamily="Inter, sans-serif">M{row.month}</text>}
                </g>
              )
            })}
          </svg>
        )
      })()}
      <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'oklch(65% 0.18 148)', display: 'inline-block', borderRadius: 2 }} />Capital</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'oklch(62% 0.20 25)', display: 'inline-block', borderRadius: 2 }} />Intérêts</span>
      </div>
    </div>
  )
}

function CompoundCalc() {
  const [f, setF] = useState({ initial: 1000, monthly: 200, rate: 7, years: 20 })

  const points = Array.from({ length: f.years + 1 }, (_, i) => {
    const r = f.rate / 100 / 12
    const n = i * 12
    const futureInitial = f.initial * Math.pow(1 + r, n)
    const futureMonthly = r > 0 ? f.monthly * ((Math.pow(1 + r, n) - 1) / r) : f.monthly * n
    return { year: i, total: futureInitial + futureMonthly, invested: f.initial + f.monthly * n }
  })

  const last = points[points.length - 1]
  const gain = last.total - last.invested
  const maxVal = last.total

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Capital initial (€)', key: 'initial', step: 100, min: 0 },
          { label: 'Versement mensuel (€)', key: 'monthly', step: 50, min: 0 },
          { label: 'Taux annuel (%)', key: 'rate', step: 0.5, min: 0 },
          { label: 'Durée (ans)', key: 'years', step: 1, min: 1 },
        ].map(field => (
          <div key={field.key}>
            <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>{field.label}</label>
            <input type="number" step={field.step} min={field.min} value={f[field.key as keyof typeof f]}
              onChange={e => setF(x => ({ ...x, [field.key]: parseFloat(e.target.value) || 0 }))} style={inputCss} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Capital final', val: last.total, color: 'oklch(65% 0.18 148)' },
          { label: 'Investi',       val: last.invested, color: '#636385' },
          { label: 'Intérêts composés', val: gain, color: 'oklch(63% 0.19 250)' },
        ].map(k => (
          <div key={k.label} style={{ background: '#1c1c27', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#636385', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{fmt(k.val)}</div>
          </div>
        ))}
      </div>
      {(() => {
        const cW = 600, cH = 180, padL = 8, padR = 8, padT = 12, padB = 28
        const usableH = cH - padT - padB
        const barW = Math.max(4, Math.floor((cW - padL - padR) / points.length) - 3)
        return (
          <svg viewBox={`0 0 ${cW} ${cH}`} style={{ width: '100%', display: 'block' }}>
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = padT + (1 - f) * usableH
              return (
                <g key={f}>
                  <line x1={padL} y1={y} x2={cW - padR} y2={y} stroke="#1c1c27" strokeWidth={1} />
                  <text x={padL} y={y - 3} fontSize={7} fill="#3a3a50" fontFamily="Inter, sans-serif">{fmt(f * maxVal)}</text>
                </g>
              )
            })}
            {points.map((p, i) => {
              const x = padL + i * (barW + 3)
              const hTotal    = (p.total    / maxVal) * usableH
              const hInvested = (p.invested / maxVal) * usableH
              const hGain     = hTotal - hInvested
              return (
                <g key={p.year}>
                  {/* Partie investie */}
                  <rect x={x} y={padT + usableH - hInvested} width={barW} height={hInvested} fill="oklch(63% 0.19 250)" fillOpacity={0.7} rx={2} />
                  {/* Partie intérêts composés par-dessus */}
                  <rect x={x} y={padT + usableH - hTotal} width={barW} height={hGain} fill="oklch(65% 0.18 148)" fillOpacity={0.9} rx={2} />
                  {i % Math.max(1, Math.floor(f.years / 10)) === 0 && (
                    <text x={x + barW / 2} y={cH - 8} textAnchor="middle" fontSize={8} fill="#636385" fontFamily="Inter, sans-serif">
                      {p.year > 0 ? `${p.year}a` : '0'}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )
      })()}
      <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'oklch(63% 0.19 250)', display: 'inline-block', borderRadius: 2 }} />Investi</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'oklch(65% 0.18 148)', display: 'inline-block', borderRadius: 2 }} />Intérêts composés</span>
      </div>
    </div>
  )
}

function BudgetSim() {
  const [income, setIncome] = useState(3000)
  const savings50 = income * 0.5, savings30 = income * 0.3, savings20 = income * 0.2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ fontSize: 11, color: '#636385', display: 'block', marginBottom: 4 }}>Revenu mensuel net (€)</label>
        <input type="number" step={100} min={0} value={income} onChange={e => setIncome(parseFloat(e.target.value) || 0)} style={inputCss} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: 'Besoins (50%)',         val: savings50, color: 'oklch(62% 0.20 25)',  desc: 'Logement, alimentation, transport, santé' },
          { label: 'Envies (30%)',           val: savings30, color: 'oklch(68% 0.17 55)',  desc: 'Loisirs, restaurants, voyages, shopping' },
          { label: 'Épargne / Invest (20%)', val: savings20, color: 'oklch(65% 0.18 148)', desc: 'Épargne, investissements, remboursement dettes' },
        ].map(item => (
          <div key={item.label} style={{ background: '#1c1c27', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#e8e8f2', fontWeight: 600 }}>{item.label}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{fmt(item.val)}</span>
            </div>
            <div style={{ height: 6, background: '#252535', borderRadius: 3, marginBottom: 6 }}>
              <div style={{ height: '100%', background: item.color, borderRadius: 3, transition: 'width 0.3s',
                width: income > 0 ? `${(item.val / income) * 100}%` : '0%' }} />
            </div>
            <div style={{ fontSize: 11, color: '#636385' }}>{item.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#636385', background: '#1c1c27', borderRadius: 10, padding: '12px 16px' }}>
        La règle 50/30/20 est un guide général. Adaptez selon votre situation personnelle.
      </div>
    </div>
  )
}

export default function OutilsPage() {
  const [tool, setTool] = useState<Tool>('loan')
  const TOOLS: { key: Tool; label: string }[] = [
    { key: 'loan',     label: '🏦 Crédit immobilier' },
    { key: 'compound', label: '📈 Intérêts composés'  },
    { key: 'sim',      label: '💰 Règle 50/30/20'     },
  ]

  return (
    <div className="page-pad" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f2' }}>Outils</h1>

      <div style={{ display: 'flex', gap: 8 }}>
        {TOOLS.map(t => (
          <button key={t.key} onClick={() => setTool(t.key)} style={{
            padding: '8px 16px', borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter', fontWeight: tool === t.key ? 600 : 400,
            background: tool === t.key ? 'oklch(63% 0.19 250)' : '#1c1c27',
            border: `1px solid ${tool === t.key ? 'oklch(63% 0.19 250)' : '#252535'}`,
            color: tool === t.key ? '#fff' : '#636385',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={cardCss}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e8f2', marginBottom: 20 }}>
          {TOOLS.find(t => t.key === tool)?.label}
        </div>
        {tool === 'loan'     && <LoanCalc />}
        {tool === 'compound' && <CompoundCalc />}
        {tool === 'sim'      && <BudgetSim />}
      </div>
    </div>
  )
}
