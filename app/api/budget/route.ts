import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { budget, monthPlans } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  const [row] = await db.select().from(budget).where(eq(budget.userId, userId))
  const plans = await db.select().from(monthPlans).where(eq(monthPlans.userId, userId))

  const monthPlansMap: Record<string, unknown> = {}
  for (const p of plans) monthPlansMap[p.monthKey] = p.data

  return NextResponse.json({
    budget: {
      incomes:  row?.incomes  ?? [],
      expenses: row?.expenses ?? [],
      savings:  row?.savings  ?? [],
    },
    monthPlans: monthPlansMap,
  })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  const body = await req.json()

  if (body.type === 'budget') {
    await db.update(budget)
      .set({
        incomes:   body.incomes,
        expenses:  body.expenses,
        savings:   body.savings,
        updatedAt: new Date(),
      })
      .where(eq(budget.userId, userId))
  } else if (body.type === 'monthPlan') {
    const existing = await db.select()
      .from(monthPlans)
      .where(and(eq(monthPlans.userId, userId), eq(monthPlans.monthKey, body.monthKey)))

    if (existing.length > 0) {
      await db.update(monthPlans)
        .set({ data: body.data })
        .where(and(eq(monthPlans.userId, userId), eq(monthPlans.monthKey, body.monthKey)))
    } else {
      await db.insert(monthPlans).values({ userId, monthKey: body.monthKey, data: body.data })
    }
  }

  return NextResponse.json({ ok: true })
}
