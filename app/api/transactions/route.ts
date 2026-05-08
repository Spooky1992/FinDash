export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { transactions } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

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
  const [row] = await db.insert(transactions).values({
    id:       body.id,
    userId,
    date:     body.date,
    label:    body.label,
    category: body.category ?? null,
    amount:   String(body.amount),
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
  await db.delete(transactions).where(eq(transactions.id, id))

  return NextResponse.json({ ok: true })
}
