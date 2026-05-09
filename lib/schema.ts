import {
  pgTable, serial, text, numeric, date, timestamp,
  jsonb, varchar, integer,
} from 'drizzle-orm/pg-core'

// ── Utilisateur (single-user, mais propre) ─────────────────────
export const users = pgTable('users', {
  id:           serial('id').primaryKey(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

// ── Transactions ───────────────────────────────────────────────
export const transactions = pgTable('transactions', {
  id:        varchar('id', { length: 64 }).primaryKey(),   // format tx-{timestamp}
  userId:    integer('user_id').notNull().references(() => users.id),
  date:      date('date').notNull(),
  label:     text('label').notNull(),
  category:  text('category'),
  amount:    numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type:      varchar('type', { length: 20 }).notNull(),    // income|expense|saving|invest
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Solde & historique compte ──────────────────────────────────
export const compte = pgTable('compte', {
  id:          serial('id').primaryKey(),
  userId:      integer('user_id').notNull().unique().references(() => users.id),
  solde:       numeric('solde', { precision: 12, scale: 2 }).notNull().default('0'),
  derniereMaj: varchar('derniere_maj', { length: 7 }),     // YYYY-MM
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
})

export const compteHistorique = pgTable('compte_historique', {
  id:       serial('id').primaryKey(),
  userId:   integer('user_id').notNull().references(() => users.id),
  key:      varchar('key', { length: 64 }).notNull(),
  label:    text('label').notNull(),
  avant:    numeric('avant', { precision: 12, scale: 2 }).notNull(),
  apres:    numeric('apres', { precision: 12, scale: 2 }).notNull(),
  revenus:  numeric('revenus', { precision: 12, scale: 2 }).notNull().default('0'),
  depenses: numeric('depenses', { precision: 12, scale: 2 }).notNull().default('0'),
  epargne:  numeric('epargne', { precision: 12, scale: 2 }).notNull().default('0'),
  delta:    numeric('delta', { precision: 12, scale: 2 }).notNull(),
  createdAt:timestamp('created_at').defaultNow().notNull(),
})

// ── Budget (structure JSONB — flexible, évite 10 tables) ───────
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
