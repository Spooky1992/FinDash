import type { CSSProperties } from 'react'
import { Budget, MonthPlan, Portfolio } from './types'

export const COLORS: Record<string, string> = {
  blue:   'oklch(63% 0.19 250)',
  purple: 'oklch(63% 0.19 290)',
  violet: 'oklch(63% 0.19 310)',
  teal:   'oklch(65% 0.16 185)',
  green:  'oklch(65% 0.18 148)',
  mint:   'oklch(75% 0.14 165)',
  amber:  'oklch(78% 0.16 80)',
  orange: 'oklch(68% 0.17 55)',
  coral:  'oklch(66% 0.18 30)',
  pink:   'oklch(65% 0.18 355)',
  rose:   'oklch(65% 0.19 340)',
}
export const COLOR_LIST = Object.values(COLORS)

export const TX_TYPES = [
  { value: 'income',  label: 'Revenu',        color: 'oklch(65% 0.18 148)' },
  { value: 'expense', label: 'Dépense',        color: 'oklch(62% 0.20 25)'  },
  { value: 'saving',  label: 'Épargne',        color: 'oklch(63% 0.19 250)' },
  { value: 'invest',  label: 'Investissement', color: 'oklch(63% 0.19 290)' },
]

export const TX_CATEGORIES = [
  'Alimentation', 'Transport', 'Logement', 'Santé', 'Loisirs',
  'Vêtements', 'Éducation', 'Voyages', 'Restauration', 'Abonnements',
  'Épargne', 'Investissement', 'Revenu', 'Salaire', 'Autre',
]

export function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function fmtPct(n: number): string {
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  return `${months[parseInt(m) - 1]} ${y}`
}

export function resolveBudget(base: Budget, plans: Record<string, MonthPlan>, key: string): Budget {
  const plan = plans[key]
  if (!plan) return base
  return {
    incomes:  plan.incomes  ?? base.incomes,
    expenses: plan.expenses ?? base.expenses,
    savings:  plan.savings  ?? base.savings,
  }
}

export function calcSurplus(budget: Budget): number {
  const rev = budget.incomes.reduce((s, i) => s + i.amount, 0)
  const dep = budget.expenses.reduce((s, cat) => s + cat.items.reduce((ss, i) => ss + i.amount, 0), 0)
  const epa = budget.savings.reduce((s, i) => s + i.amount, 0)
  return rev - dep - epa
}

export function uid(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const DEFAULT_PORTFOLIO: Portfolio = {
  pea:     { positions: [] },
  crypto:  { positions: [] },
  livrets: { accounts:  [] },
  immo:    { properties: [] },
}

export const DEFAULT_BUDGET: Budget = { incomes: [], expenses: [], savings: [] }

export const inputCss: CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: '#1c1c27', border: '1px solid #252535',
  borderRadius: 8, color: '#e8e8f2', fontSize: 13,
  fontFamily: 'Inter, sans-serif',
}

export const btnCss = (color = 'oklch(63% 0.19 250)', full = true): CSSProperties => ({
  padding: full ? '8px 18px' : '6px 14px',
  background: color, border: 'none', borderRadius: 8,
  color: '#fff', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})

export const cardCss: CSSProperties = {
  background: '#13131b', border: '1px solid #252535',
  borderRadius: 14, padding: '20px 22px',
}
