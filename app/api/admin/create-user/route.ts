export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { users, budget, compte, portfolio } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, password } = await req.json()
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Email et mot de passe requis (min 6 caractères)' }, { status: 400 })
  }

  const db = getDb()
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) return NextResponse.json({ error: 'Un compte avec cet email existe déjà' }, { status: 409 })

  const passwordHash = await bcrypt.hash(password, 12)
  const [user] = await db.insert(users).values({ email, passwordHash }).returning()

  await Promise.all([
    db.insert(budget).values({ userId: user.id, incomes: [], expenses: [], savings: [] }),
    db.insert(compte).values({ userId: user.id, solde: '0' }),
    db.insert(portfolio).values({ userId: user.id, data: [] }),
  ])

  return NextResponse.json({ ok: true, email: user.email })
}
