'use client'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { AppData, Budget, MonthPlan, Transaction, Portfolio, Compte, CompteHistorique, LivretMove } from '@/lib/types'
import { DEFAULT_PORTFOLIO, DEFAULT_BUDGET, uid } from '@/lib/utils'

const empty: AppData = {
  budget: DEFAULT_BUDGET, monthPlans: {}, transactions: [],
  comptes: [], livretMoves: [],
  portfolio: DEFAULT_PORTFOLIO, loading: true,
}

interface Ctx extends AppData {
  // Helpers dérivés
  defaultCompte: Compte | null
  totalSolde: number
  livrets: Compte[]
  // Budget
  saveBudget(b: Budget): Promise<void>
  saveMonthPlan(key: string, plan: MonthPlan): Promise<void>
  // Transactions
  saveTx(tx: Omit<Transaction, 'id'>): Promise<void>
  deleteTx(id: string): Promise<void>
  // Comptes CRUD
  createCompte(nom: string, type: Compte['type'], solde: number, taux?: number | null): Promise<Compte>
  updateCompte(id: string, updates: Partial<Pick<Compte, 'nom' | 'type' | 'solde' | 'taux' | 'derniereMaj'>>): Promise<void>
  deleteCompte(id: string): Promise<void>
  setDefaultCompte(id: string): Promise<void>
  addHistorique(compteId: string, entry: CompteHistorique): Promise<void>
  deleteHistorique(compteId: string, key: string): Promise<void>
  // Livret moves
  saveLivretMove(move: Omit<LivretMove, 'id'>): Promise<{ newSolde: number }>
  deleteLivretMove(id: string): Promise<void>
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
      fetch('/api/comptes').then(r => r.json()),
      fetch('/api/livret-moves').then(r => r.json()),
      fetch('/api/portfolio').then(r => r.json()),
    ]).then(([b, txs, comptesList, lmoves, port]) => {
      if (cancelled) return
      setData({
        budget:       b.budget     ?? DEFAULT_BUDGET,
        monthPlans:   b.monthPlans ?? {},
        transactions: Array.isArray(txs) ? txs : [],
        comptes:      Array.isArray(comptesList) ? comptesList : [],
        livretMoves:  Array.isArray(lmoves) ? lmoves : [],
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
    const updated = await fetch('/api/comptes').then(r => r.json())
    setData(d => ({
      ...d,
      transactions: [newTx as Transaction, ...d.transactions],
      comptes: Array.isArray(updated) ? updated : d.comptes,
    }))
  }, [])

  const deleteTx = useCallback(async (id: string) => {
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }) })
    const updated = await fetch('/api/comptes').then(r => r.json())
    setData(d => ({
      ...d,
      transactions: d.transactions.filter(t => t.id !== id),
      comptes: Array.isArray(updated) ? updated : d.comptes,
    }))
  }, [])

  const createCompte = useCallback(async (nom: string, type: Compte['type'], solde: number, taux?: number | null): Promise<Compte> => {
    const res = await fetch('/api/comptes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, type, solde, taux: taux ?? null }) })
    const { id } = await res.json()
    const newCompte: Compte = { id, nom, type, solde, isDefault: false, taux: taux ?? null, derniereMaj: null }
    setData(d => ({ ...d, comptes: [...d.comptes, { ...newCompte, historique: [] } as Compte & { historique: CompteHistorique[] }] }))
    return newCompte
  }, [])

  const updateCompte = useCallback(async (id: string, updates: Partial<Pick<Compte, 'nom' | 'type' | 'solde' | 'taux' | 'derniereMaj'>>) => {
    await fetch(`/api/comptes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates) })
    setData(d => ({ ...d, comptes: d.comptes.map(c => c.id === id ? { ...c, ...updates } : c) }))
  }, [])

  const deleteCompte = useCallback(async (id: string) => {
    await fetch(`/api/comptes/${id}`, { method: 'DELETE' })
    setData(d => {
      const remaining = d.comptes.filter(c => c.id !== id)
      if (d.comptes.find(c => c.id === id)?.isDefault && remaining.length > 0) {
        remaining[0] = { ...remaining[0], isDefault: true }
      }
      return { ...d, comptes: remaining }
    })
  }, [])

  const setDefaultCompte = useCallback(async (id: string) => {
    await fetch(`/api/comptes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-default' }) })
    setData(d => ({ ...d, comptes: d.comptes.map(c => ({ ...c, isDefault: c.id === id })) }))
  }, [])

  const addHistorique = useCallback(async (compteId: string, entry: CompteHistorique) => {
    await fetch(`/api/comptes/${compteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry) })
    setData(d => ({
      ...d,
      comptes: d.comptes.map(c => c.id === compteId
        ? { ...c, historique: [entry, ...(c as Compte & { historique: CompteHistorique[] }).historique] }
        : c),
    }))
  }, [])

  const deleteHistorique = useCallback(async (compteId: string, key: string) => {
    await fetch(`/api/comptes/${compteId}/historique`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }) })
    setData(d => ({
      ...d,
      comptes: d.comptes.map(c => c.id === compteId
        ? { ...c, historique: (c as Compte & { historique: CompteHistorique[] }).historique.filter(h => h.key !== key) }
        : c),
    }))
  }, [])

  const saveLivretMove = useCallback(async (move: Omit<LivretMove, 'id'>): Promise<{ newSolde: number }> => {
    const res = await fetch('/api/livret-moves', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(move) })
    const { id, newSolde } = await res.json()
    const newMove: LivretMove = { ...move, id }
    setData(d => ({
      ...d,
      livretMoves: [newMove, ...d.livretMoves],
      comptes: d.comptes.map(c => c.id === move.livretId ? { ...c, solde: newSolde } : c),
    }))
    return { newSolde }
  }, [])

  const deleteLivretMove = useCallback(async (id: string) => {
    await fetch('/api/livret-moves', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }) })
    const updated = await fetch('/api/comptes').then(r => r.json())
    setData(d => ({
      ...d,
      livretMoves: d.livretMoves.filter(m => m.id !== id),
      comptes: Array.isArray(updated) ? updated : d.comptes,
    }))
  }, [])

  const savePortfolio = useCallback(async (p: Portfolio) => {
    await fetch('/api/portfolio', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p) })
    setData(d => ({ ...d, portfolio: p }))
  }, [])

  const defaultCompte = data.comptes.find(c => c.isDefault) ?? data.comptes[0] ?? null
  const totalSolde = data.comptes.reduce((s, c) => s + (c.solde ?? 0), 0)
  const livrets = data.comptes.filter(c => c.type === 'livret')

  return (
    <AppCtx.Provider value={{
      ...data,
      defaultCompte,
      totalSolde,
      livrets,
      reload,
      saveBudget, saveMonthPlan,
      saveTx, deleteTx,
      createCompte, updateCompte, deleteCompte, setDefaultCompte,
      addHistorique, deleteHistorique,
      saveLivretMove, deleteLivretMove,
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
