// Script de migration one-shot depuis JSONBin vers Postgres
// Usage: DATABASE_URL=... npx tsx scripts/migrate-from-jsonbin.ts
import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/schema'
import { eq } from 'drizzle-orm'

const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/69f47f84856a682189940856'
const JSONBIN_KEY = process.env.JSONBIN_KEY!
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!
const ADMIN_HASH  = process.env.ADMIN_HASH!   // bcrypt hash du mot de passe

async function run() {
  console.log('Fetching data from JSONBin…')
  const res  = await fetch(`${JSONBIN_URL}/latest`, { headers: { 'X-Master-Key': JSONBIN_KEY } })
  const json = await res.json()
  const data = json.record

  const sql = neon(process.env.DATABASE_URL!)
  const db  = drizzle(sql, { schema })

  // 1. Créer l'utilisateur
  console.log('Creating user…')
  const [user] = await db.insert(schema.users)
    .values({ email: ADMIN_EMAIL, passwordHash: ADMIN_HASH })
    .onConflictDoNothing()
    .returning()

  if (!user) {
    console.log('User already exists, skipping…')
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, ADMIN_EMAIL))
    if (!existing) throw new Error('User not found and could not be created')
    return
  }

  const userId = user.id
  console.log(`User created with id=${userId}`)

  // 2. Budget
  console.log('Migrating budget…')
  await db.insert(schema.budget).values({
    userId,
    incomes:  data.budget?.incomes  ?? [],
    expenses: data.budget?.expenses ?? [],
    savings:  data.budget?.savings  ?? [],
  })

  // 3. Month plans
  if (data.monthPlans) {
    console.log('Migrating month plans…')
    for (const [key, val] of Object.entries(data.monthPlans)) {
      await db.insert(schema.monthPlans).values({ userId, monthKey: key, data: val as object })
    }
  }

  // 4. Compte
  console.log('Migrating compte…')
  const compteData = data.compte ?? { solde: 0, derniereMaj: null, historique: [] }
  await db.insert(schema.compte).values({
    userId,
    solde:       String(compteData.solde ?? 0),
    derniereMaj: compteData.derniereMaj ?? null,
  })

  if (compteData.historique?.length) {
    for (const h of compteData.historique) {
      await db.insert(schema.compteHistorique).values({
        userId,
        key:      h.key,
        label:    h.label,
        avant:    String(h.avant),
        apres:    String(h.apres),
        revenus:  String(h.revenus ?? 0),
        depenses: String(h.depenses ?? 0),
        epargne:  String(h.epargne ?? 0),
        delta:    String(h.delta),
      })
    }
  }

  // 5. Transactions
  if (data.transactions?.length) {
    console.log(`Migrating ${data.transactions.length} transactions…`)
    for (const tx of data.transactions) {
      await db.insert(schema.transactions).values({
        id:       tx.id,
        userId,
        date:     tx.date,
        label:    tx.label,
        category: tx.category ?? null,
        amount:   String(tx.amount),
        type:     tx.type,
      })
    }
  }

  // 6. Portfolio
  console.log('Migrating portfolio…')
  await db.insert(schema.portfolio).values({ userId, data: data.portfolio ?? [] })

  console.log('Migration complete!')
}

run().catch(console.error)
