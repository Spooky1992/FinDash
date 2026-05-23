export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { livretMoves, comptes } from '@/lib/schema'
import { eq, and, desc } from 'drizzle-orm'
import crypto from 'crypto'

const VALID_TYPES = new Set(['depot', 'retrait', 'interet'])
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

  const rows = await db.select().from(livretMoves)
    .where(eq(livretMoves.userId, userId))
    .orderBy(desc(livretMoves.date), desc(livretMoves.createdAt))

  return NextResponse.json(rows.map(r => ({
    id:         r.id,
    livretId:   r.livretId,
    date:       r.date,
    type:       r.type,
    label:      r.label,
    amount:     parseFloat(r.amount),
    soldeApres: parseFloat(r.soldeApres),
  })))
}

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const body = await req.json()

  if (!body.livretId || typeof body.livretId !== 'string')
    return NextResponse.json({ error: 'Invalid livretId' }, { status: 400 })
  if (!DATE_RE.test(body.date))
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  if (!VALID_TYPES.has(body.type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (!body.label || typeof body.label !== 'string' || body.label.length > 200)
    return NextResponse.json({ error: 'Invalid label' }, { status: 400 })

  const amount = parseFloat(body.amount)
  if (isNaN(amount) || amount <= 0 || amount > 999_999_999)
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

  // Vérifier que le livret appartient à l'user
  const [livret] = await db.select().from(comptes)
    .where(and(eq(comptes.id, body.livretId), eq(comptes.userId, userId)))
  if (!livret) return NextResponse.json({ error: 'Livret not found' }, { status: 404 })

  // Calculer le nouveau solde
  const currentSolde = parseFloat(livret.solde)
  const delta = body.type === 'retrait' ? -amount : amount
  const newSolde = currentSolde + delta

  // Mettre à jour le solde du compte livret
  await db.update(comptes)
    .set({ solde: String(newSolde), updatedAt: new Date() })
    .where(eq(comptes.id, body.livretId))

  // Insérer le mouvement
  const id = `lm-${crypto.randomBytes(8).toString('hex')}`
  await db.insert(livretMoves).values({
    id, userId,
    livretId:   body.livretId,
    date:       body.date,
    type:       body.type,
    label:      body.label.trim(),
    amount:     String(amount),
    soldeApres: String(newSolde),
  })

  return NextResponse.json({ ok: true, id, newSolde })
}

export async function DELETE(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const { id } = await req.json()
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  // Récupérer le mouvement pour reverser le solde
  const [move] = await db.select().from(livretMoves)
    .where(and(eq(livretMoves.id, id), eq(livretMoves.userId, userId)))
  if (!move) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Reverser le delta sur le compte livret
  const [livret] = await db.select().from(comptes).where(eq(comptes.id, move.livretId))
  if (livret) {
    const delta = move.type === 'retrait' ? parseFloat(move.amount) : -parseFloat(move.amount)
    await db.update(comptes)
      .set({ solde: String(parseFloat(livret.solde) + delta), updatedAt: new Date() })
      .where(eq(comptes.id, move.livretId))
  }

  await db.delete(livretMoves)
    .where(and(eq(livretMoves.id, id), eq(livretMoves.userId, userId)))

  return NextResponse.json({ ok: true })
}
