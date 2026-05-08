export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { users, budget, compte, portfolio } from '@/lib/schema'

export async function POST(req: Request) {
  const db = getDb()
  const existing = await db.select().from(users).limit(1)
  if (existing.length > 0) {
    return NextResponse.json({ error: 'Setup already done' }, { status: 403 })
  }

  const { email, password } = await req.json()
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [user] = await db.insert(users).values({ email, passwordHash }).returning()

  await Promise.all([
    db.insert(budget).values({ userId: user.id, incomes: [], expenses: [], savings: [] }),
    db.insert(compte).values({ userId: user.id, solde: '0' }),
    db.insert(portfolio).values({ userId: user.id, data: [] }),
  ])

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const db = getDb()
  const existing = await db.select({ id: users.id }).from(users).limit(1)
  return NextResponse.json({ configured: existing.length > 0 })
}