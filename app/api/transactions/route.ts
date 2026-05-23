export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { transactions, comptes } from '@/lib/schema'
import { eq, desc, and } from 'drizzle-orm'
import crypto from 'crypto'

const VALID_TYPES = new Set(['income', 'expense', 'saving', 'invest', 'transfer'])
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) return null
  return parseInt(session.user.id)
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))

  return NextResponse.json(rows.map(r => ({
    id:          r.id,
    date:        r.date,
    label:       r.label,
    category:    r.category,
    amount:      parseFloat(r.amount),
    type:        r.type,
    compteId:    r.compteId ?? null,
    toCompteId:  r.toCompteId ?? null,
  })))
}

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const body = await req.json()

  const amount = parseFloat(body.amount)
  if (!body.label || typeof body.label !== 'string' || body.label.length > 200)
    return NextResponse.json({ error: 'Invalid label' }, { status: 400 })
  if (!DATE_RE.test(body.date))
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  if (!VALID_TYPES.has(body.type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (isNaN(amount) || !isFinite(amount) || amount <= 0 || amount > 999_999_999)
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

  // Pour un virement, toCompteId est obligatoire
  if (body.type === 'transfer' && !body.toCompteId)
    return NextResponse.json({ error: 'toCompteId required for transfer' }, { status: 400 })

  const id = `tx-${crypto.randomBytes(8).toString('hex')}`

  await db.insert(transactions).values({
    id, userId,
    date:        body.date,
    label:       body.label.trim(),
    category:    body.category ?? null,
    amount:      String(amount),
    type:        body.type,
    compteId:    body.compteId ?? null,
    toCompteId:  body.toCompteId ?? null,
  })

  // Mettre à jour les soldes des comptes concernés
  if (body.compteId) {
    const [src] = await db.select().from(comptes)
      .where(and(eq(comptes.id, body.compteId), eq(comptes.userId, userId)))
    if (src) {
      const delta = body.type === 'income' ? amount : -amount
      await db.update(comptes).set({ solde: String(parseFloat(src.solde) + delta), updatedAt: new Date() })
        .where(eq(comptes.id, body.compteId))
    }
    // Pour un virement : créditer le compte destinataire
    if (body.type === 'transfer' && body.toCompteId) {
      const [dst] = await db.select().from(comptes)
        .where(and(eq(comptes.id, body.toCompteId), eq(comptes.userId, userId)))
      if (dst) {
        await db.update(comptes).set({ solde: String(parseFloat(dst.solde) + amount), updatedAt: new Date() })
          .where(eq(comptes.id, body.toCompteId))
      }
    }
  }

  return NextResponse.json({ ok: true, id })
}

export async function DELETE(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()

  const { id } = await req.json()
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  // Récupérer la tx avant de la supprimer pour reverser le solde
  const [tx] = await db.select().from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))

  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)))

  // Reverser le solde si la tx était liée à un compte
  if (tx?.compteId) {
    const [src] = await db.select().from(comptes).where(eq(comptes.id, tx.compteId))
    if (src) {
      const delta = tx.type === 'income' ? -parseFloat(tx.amount) : parseFloat(tx.amount)
      await db.update(comptes).set({ solde: String(parseFloat(src.solde) + delta), updatedAt: new Date() })
        .where(eq(comptes.id, tx.compteId))
    }
    if (tx.type === 'transfer' && tx.toCompteId) {
      const [dst] = await db.select().from(comptes).where(eq(comptes.id, tx.toCompteId))
      if (dst) {
        await db.update(comptes).set({ solde: String(parseFloat(dst.solde) - parseFloat(tx.amount)), updatedAt: new Date() })
          .where(eq(comptes.id, tx.toCompteId))
      }
    }
  }

  return NextResponse.json({ ok: true })
}
