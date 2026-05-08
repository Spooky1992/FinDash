export interface Income {
  id: string; label: string; amount: number; color: string
}
export interface ExpenseItem {
  id?: string; label: string; amount: number; color: string
}
export interface ExpenseCategory {
  id?: string; label: string; items: ExpenseItem[]
}
export interface Saving {
  id: string; label: string; amount: number; color: string
}
export interface Budget {
  incomes: Income[]; expenses: ExpenseCategory[]; savings: Saving[]
}
export interface MonthPlan {
  incomes?: Income[]; expenses?: ExpenseCategory[]; savings?: Saving[]
}
export interface Transaction {
  id: string; date: string; label: string
  category: string | null; amount: number
  type: 'income' | 'expense' | 'saving' | 'invest'
}
export interface CompteHistorique {
  key: string; label: string
  avant: number; apres: number
  revenus: number; depenses: number; epargne: number; delta: number
}
export interface Position {
  id: string; ticker: string; quantity: number; costPerUnit: number
  price?: number; name?: string; symbol?: string
}
export interface Livret {
  id: string; name: string; rate: number; solde: number
}
export interface ImmoMortgage {
  totalCapital: number; monthly: number; rate: number; insurance: number
  paidInstallments: number; remainingInstallments: number; endDate: string
}
export interface Immo {
  id: string; name: string; value: number; mortgage?: ImmoMortgage
}
export interface Portfolio {
  pea: { positions: Position[] }
  crypto: { positions: Position[] }
  livrets: { accounts: Livret[] }
  immo: { properties: Immo[] }
}
export interface AppData {
  budget: Budget
  monthPlans: Record<string, MonthPlan>
  transactions: Transaction[]
  compte: { solde: number; derniereMaj: string | null; historique: CompteHistorique[] }
  portfolio: Portfolio
  loading: boolean
}
