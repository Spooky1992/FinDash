'use client'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { AppData, Budget, MonthPlan, Transaction, Portfolio } from '@/lib/types'
import { DEFAULT_PORTFOLIO, DEFAULT_BUDGET, uid } from '@/lib/utils'

const empty: AppData = {
  budget: DEFAULT_BUDGET, monthPlans: {}, transactions: [],
  compte: { solde: 0, derniereMaj: null, historique: [] },
  portfolio: DEFAULT_PORTFOLIO, loading: true,
}

interface Ctx extends AppData {
  // Budget
  saveBudget(b: Budget): Promise<void>
  saveMonthPlan(key: string, plan: MonthPlan): Promise<void>
  // Transactions
  saveTx(tx: Omit<Transaction, 'id'>): Promise<void>
  deleteTx(id: string): Promise<void>
  // Compte
  updateSolde(solde: number, derniereMaj?: string): Promise<void>
  addHistorique(entry: Omit<AppData['compte']['historique'][0], never>): Promise<void>
  deleteHistorique(key: string): Promise<void>
  // Portfolio
  savePortfolio(p: Portfolio): Promise<void>
  reload(): void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(empty)
  const [rev, setRev] = useState(0)
  const reload = useCallback(() => setRev(r => r + 1), [])

  useEffect(() => {
    let cancelled = false
    setData(d => ({ ...d, loading: true }))
    Promise.all([
      fetch('/api/budget').then(r => r.json()),
      fetch('/api/transactions').then(r => r.json()),
      fetch('/api/compte').then(r => r.json()),
      fetch('/api/portfolio').then(r => r.json()),
    ]).then(([b, txs, c, port]) => {
      if (cancelled) return
      setData({
        budget:       b.budget     ?? DEFAULT_BUDGET,
        monthPlans:   b.monthPlans ?? {},
        transactions: Array.isArray(txs) ? txs : [],
        compte: {
          solde:       c.solde       ?? 0,
          derniereMaj: c.derniereMaj ?? null,
          historique:  c.historique  ?? [],
        },
        portfolio: (port && typeof port === 'object' && 'pea' in port)
          ? port as Portfolio
          : DEFAULT_PORTFOLIO,
        loading: false,
      })
    }).catch(() => {
      if (!cancelled) setData(d => ({ ...d, loading: false }))
    })
    return () => { cancelled = true }
  }, [rev])

  const saveBudget = useCallback(async (b: Budget) => {
    await fetch('/api/budget', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'budget', ...b }) })
    setData(d => ({ ...d, budget: b }))
  }, [])

  const saveMonthPlan = useCallback(async (key: string, plan: MonthPlan) => {
    await fetch('/api/budget', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'monthPlan', monthKey: key, data: plan }) })
    setData(d => ({ ...d, monthPlans: { ...d.monthPlans, [key]: plan } }))
  }, [])

  const saveTx = useCallback(async (tx: Omit<Transaction, 'id'>) => {
    const newTx = { ...tx, id: uid() }
    await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTx) })
    setData(d => ({ ...d, transactions: [newTx, ...d.transactions] }))
  }, [])

  const deleteTx = useCallback(async (id: string) => {
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }) })
    setData(d => ({ ...d, transactions: d.transactions.filter(t => t.id !== id) }))
  }, [])

  const updateSolde = useCallback(async (solde: number, derniereMaj?: string) => {
    await fetch('/api/compte', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solde, derniereMaj: derniereMaj ?? data.compte.derniereMaj }) })
    setData(d => ({ ...d, compte: { ...d.compte, solde, ...(derniereMaj ? { derniereMaj } : {}) } }))
  }, [data.compte.derniereMaj])

  const addHistorique = useCallback(async (entry: AppData['compte']['historique'][0]) => {
    await fetch('/api/compte', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry) })
    setData(d => ({ ...d, compte: { ...d.compte, historique: [entry, ...d.compte.historique] } }))
  }, [])

  const deleteHistorique = useCallback(async (key: string) => {
    await fetch('/api/compte', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }) })
    setData(d => ({ ...d, compte: { ...d.compte, historique: d.compte.historique.filter(h => h.key !== key) } }))
  }, [])

  const savePortfolio = useCallback(async (p: Portfolio) => {
    await fetch('/api/portfolio', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p) })
    setData(d => ({ ...d, portfolio: p }))
  }, [])

  return (
    <AppCtx.Provider value={{
      ...data, reload,
      saveBudget, saveMonthPlan,
      saveTx, deleteTx,
      updateSolde, addHistorique, deleteHistorique,
      savePortfolio,
    }}>
      {children}
    </AppCtx.Provider>
  )
}

export function useAppData(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider')
  return ctx
}
