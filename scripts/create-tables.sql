-- FinDash — Création des tables
-- Colle ce SQL dans l'éditeur SQL de ton dashboard Neon

CREATE TABLE IF NOT EXISTS "users" (
  "id"            SERIAL PRIMARY KEY,
  "email"         VARCHAR(255) NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "created_at"    TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transactions" (
  "id"         VARCHAR(64) PRIMARY KEY,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id"),
  "date"       DATE NOT NULL,
  "label"      TEXT NOT NULL,
  "category"   TEXT,
  "amount"     NUMERIC(12, 2) NOT NULL,
  "type"       VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compte" (
  "id"           SERIAL PRIMARY KEY,
  "user_id"      INTEGER NOT NULL UNIQUE REFERENCES "users"("id"),
  "solde"        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "derniere_maj" VARCHAR(7),
  "updated_at"   TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compte_historique" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id"),
  "key"        VARCHAR(64) NOT NULL,
  "label"      TEXT NOT NULL,
  "avant"      NUMERIC(12, 2) NOT NULL,
  "apres"      NUMERIC(12, 2) NOT NULL,
  "revenus"    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "depenses"   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "epargne"    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  "delta"      NUMERIC(12, 2) NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "budget" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL UNIQUE REFERENCES "users"("id"),
  "incomes"    JSONB NOT NULL DEFAULT '[]',
  "expenses"   JSONB NOT NULL DEFAULT '[]',
  "savings"    JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "month_plans" (
  "id"        SERIAL PRIMARY KEY,
  "user_id"   INTEGER NOT NULL REFERENCES "users"("id"),
  "month_key" VARCHAR(7) NOT NULL,
  "data"      JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS "portfolio" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL UNIQUE REFERENCES "users"("id"),
  "data"       JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);
