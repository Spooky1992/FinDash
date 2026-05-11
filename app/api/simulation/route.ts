export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { simulationPositions } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

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
    .from(simulationPositions)
    .where(eq(simulationPositions.userId, userId))

  return NextResponse.json(rows.map(r => ({
    id:             r.id,
    type:           r.type,
    ticker:         r.ticker,
    name:           r.name,
    quantity:       parseFloat(r.quantity),
    costPerUnit:    parseFloat(r.costPerUnit),
    currency:       r.currency,
    purchaseDate:   r.purchaseDate,
    purchaseEurUsd: r.purchaseEurUsd ? parseFloat(r.purchaseEurUsd) : null,
  })))
}

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const body = await req.json()

  const { type, ticker, name, quantity, costPerUnit, currency, purchaseDate, purchaseEurUsd } = body
  if (!['pea', 'crypto'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (!ticker || quantity == null || costPerUnit == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const id = crypto.randomBytes(8).toString('hex')
  await db.insert(simulationPositions).values({
    id, userId,
    type, ticker: ticker.toUpperCase(),
    name: name || null,
    quantity: String(quantity),
    costPerUnit: String(costPerUnit),
    currency: currency ?? 'EUR',
    purchaseDate: purchaseDate || null,
    purchaseEurUsd: purchaseEurUsd ? String(purchaseEurUsd) : null,
  })

  return NextResponse.json({ id })
}

export async function PATCH(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const body = await req.json()

  const { id, type, ticker, name, quantity, costPerUnit, currency, purchaseDate, purchaseEurUsd } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.update(simulationPositions)
    .set({
      type, ticker: ticker?.toUpperCase(),
      name: name || null,
      quantity: quantity != null ? String(quantity) : undefined,
      costPerUnit: costPerUnit != null ? String(costPerUnit) : undefined,
      currency,
      purchaseDate: purchaseDate || null,
      purchaseEurUsd: purchaseEurUsd ? String(purchaseEurUsd) : null,
    })
    .where(and(eq(simulationPositions.id, id), eq(simulationPositions.userId, userId)))

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.delete(simulationPositions)
    .where(and(eq(simulationPositions.id, id), eq(simulationPositions.userId, userId)))

  return NextResponse.json({ ok: true })
}
