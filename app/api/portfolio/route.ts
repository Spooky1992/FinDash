export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { portfolio } from '@/lib/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  const [row] = await db.select().from(portfolio).where(eq(portfolio.userId, userId))
  return NextResponse.json(row?.data ?? [])
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  const data = await req.json()
  await db.update(portfolio)
    .set({ data, updatedAt: new Date() })
    .where(eq(portfolio.userId, userId))

  return NextResponse.json({ ok: true })
}
