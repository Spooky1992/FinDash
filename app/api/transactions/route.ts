export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { transactions } from '@/lib/schema'
import { eq, desc, and } from 'drizzle-orm'
import crypto from 'crypto'

const VALID_TYPES = new Set(['income', 'expense', 'saving', 'invest'])
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)
  const db = getDb()

  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.date))

  return NextResponse.json(rows.map(r => ({
    id:       r.id,
    date:     r.date,
    label:    r.label,
    category: r.category,
    amount:   parseFloat(r.amount),
    type:     r.type,
  })))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)
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

  const id = `tx-${crypto.randomBytes(8).toString('hex')}`

  const [row] = await db.insert(transactions).values({
    id,
    userId,
    date:     body.date,
    label:    body.label.trim(),
    category: body.category ?? null,
    amount:   String(amount),
    type:     body.type,
  }).returning()

  return NextResponse.json({ ok: true, id: row.id })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)
  const db = getDb()

  const { id } = await req.json()
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)))

  return NextResponse.json({ ok: true })
}
