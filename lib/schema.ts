import {
  pgTable, serial, text, numeric, date, timestamp,
  jsonb, varchar, integer, boolean,
} from 'drizzle-orm/pg-core'

// ── Utilisateur (single-user, mais propre) ─────────────────────
export const users = pgTable('users', {
  id:           serial('id').primaryKey(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

// ── Comptes bancaires (multi-comptes par user) ─────────────────
export const comptes = pgTable('comptes', {
  id:          varchar('id', { length: 64 }).primaryKey(),
  userId:      integer('user_id').notNull().references(() => users.id),
  nom:         text('nom').notNull(),
  type:        varchar('type', { length: 20 }).notNull().default('courant'), // courant|autre
  solde:       numeric('solde', { precision: 12, scale: 2 }).notNull().default('0'),
  isDefault:   boolean('is_default').notNull().default(false),
  derniereMaj: varchar('derniere_maj', { length: 7 }),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
})

// ── Transactions ───────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id:        varchar('id', { length: 64 }).primaryKey(),
  userId:    integer('user_id').notNull().references(() => users.id),
  compteId:  varchar('compte_id', { length: 64 }).references(() => comptes.id),  // null = compte par défaut
  date:      date('date').notNull(),
  label:     text('label').notNull(),
  category:  text('category'),
  amount:    numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type:      varchar('type', { length: 20 }).notNull(),    // income|expense|saving|invest|transfer
  toCompteId:varchar('to_compte_id', { length: 64 }).references(() => comptes.id), // pour virements
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Historique mensuel par compte ──────────────────────────────
export const compteHistorique = pgTable('compte_historique', {
  id:        serial('id').primaryKey(),
  userId:    integer('user_id').notNull().references(() => users.id),
  compteId:  varchar('compte_id', { length: 64 }).references(() => comptes.id),
  key:       varchar('key', { length: 64 }).notNull(),
  label:     text('label').notNull(),
  avant:     numeric('avant', { precision: 12, scale: 2 }).notNull(),
  apres:     numeric('apres', { precision: 12, scale: 2 }).notNull(),
  revenus:   numeric('revenus', { precision: 12, scale: 2 }).notNull().default('0'),
  depenses:  numeric('depenses', { precision: 12, scale: 2 }).notNull().default('0'),
  epargne:   numeric('epargne', { precision: 12, scale: 2 }).notNull().default('0'),
  delta:     numeric('delta', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Budget ─────────────────────────────────────────────────────
export const budget = pgTable('budget', {
  id:        serial('id').primaryKey(),
  userId:    integer('user_id').notNull().unique().references(() => users.id),
  incomes:   jsonb('incomes').notNull().default('[]'),
  expenses:  jsonb('expenses').notNull().default('[]'),
  savings:   jsonb('savings').notNull().default('[]'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Plans mensuels (overrides budget par mois) ─────────────────
export const monthPlans = pgTable('month_plans', {
  id:       serial('id').primaryKey(),
  userId:   integer('user_id').notNull().references(() => users.id),
  monthKey: varchar('month_key', { length: 7 }).notNull(),  // YYYY-MM
  data:     jsonb('data').notNull(),
})

// ── Portfolio (JSONB — structure complexe imbriquée) ───────────
export const portfolio = pgTable('portfolio', {
  id:        serial('id').primaryKey(),
  userId:    integer('user_id').notNull().unique().references(() => users.id),
  data:      jsonb('data').notNull().default('[]'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Positions de simulation (sandbox, n'affecte pas le patrimoine) ────────────
export const simulationPositions = pgTable('simulation_positions', {
  id:            varchar('id', { length: 64 }).primaryKey(),
  userId:        integer('user_id').notNull().references(() => users.id),
  type:          varchar('type', { length: 10 }).notNull(),  // pea|crypto
  ticker:        varchar('ticker', { length: 30 }).notNull(),
  name:          text('name'),
  quantity:      numeric('quantity', { precision: 18, scale: 8 }).notNull(),
  costPerUnit:   numeric('cost_per_unit', { precision: 18, scale: 6 }).notNull(),
  currency:      varchar('currency', { length: 5 }).notNull().default('EUR'),
  purchaseDate:  date('purchase_date'),
  purchaseEurUsd:numeric('purchase_eur_usd', { precision: 10, scale: 6 }),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
})

// ── Journal des mouvements de capital ─────────────────────
export const capitalMoves = pgTable('capital_moves', {
  id:        varchar('id', { length: 64 }).primaryKey(),
  userId:    integer('user_id').notNull().references(() => users.id),
  date:      date('date').notNull(),
  type:      varchar('type', { length: 20 }).notNull(),   // deposit|withdrawal|buy|sell
  account:   varchar('account', { length: 20 }).notNull(),// PEA|CTO|Crypto
  ticker:    varchar('ticker', { length: 30 }),
  label:     text('label').notNull(),
  quantity:  numeric('quantity', { precision: 18, scale: 8 }),
  priceUnit: numeric('price_unit', { precision: 18, scale: 6 }),
  amount:    numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency:  varchar('currency', { length: 5 }).notNull().default('EUR'),
  pnl:       numeric('pnl', { precision: 12, scale: 2 }),
  notes:     text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
