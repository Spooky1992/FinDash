export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { capitalMoves } from '@/lib/schema'
import { eq, desc, and } from 'drizzle-orm'
import crypto from 'crypto'

const VALID_TYPES    = new Set(['deposit', 'withdrawal', 'buy', 'sell'])
const VALID_ACCOUNTS = new Set(['PEA', 'CTO', 'Crypto'])
const DATE_RE        = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TICKER_RE      = /^[A-Z0-9=^._%-]{1,30}$/i

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)
  const db = getDb()

  const rows = await db
    .select()
    .from(capitalMoves)
    .where(eq(capitalMoves.userId, userId))
    .orderBy(desc(capitalMoves.date))

  return NextResponse.json(rows.map(r => ({
    id:        r.id,
    date:      r.date,
    type:      r.type,
    account:   r.account,
    ticker:    r.ticker ?? null,
    label:     r.label,
    quantity:  r.quantity  != null ? parseFloat(r.quantity)  : null,
    priceUnit: r.priceUnit != null ? parseFloat(r.priceUnit) : null,
    amount:    parseFloat(r.amount),
    currency:  r.currency,
    pnl:       r.pnl != null ? parseFloat(r.pnl) : null,
    notes:     r.notes ?? null,
  })))
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)
  const db = getDb()

  const body = await req.json()

  if (!VALID_TYPES.has(body.type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (!VALID_ACCOUNTS.has(body.account))
    return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
  if (!DATE_RE.test(body.date))
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  if (!body.label || typeof body.label !== 'string' || body.label.length > 200)
    return NextResponse.json({ error: 'Invalid label' }, { status: 400 })

  const amount = parseFloat(body.amount)
  if (isNaN(amount) || !isFinite(amount) || amount <= 0 || amount > 999_999_999)
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

  if (body.ticker && !TICKER_RE.test(body.ticker))
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })

  const quantity  = body.quantity  != null ? parseFloat(body.quantity)  : null
  const priceUnit = body.priceUnit != null ? parseFloat(body.priceUnit) : null
  const pnl       = body.pnl       != null ? parseFloat(body.pnl)       : null

  if (quantity  != null && (isNaN(quantity)  || quantity  <= 0)) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
  if (priceUnit != null && (isNaN(priceUnit) || priceUnit <= 0)) return NextResponse.json({ error: 'Invalid priceUnit' }, { status: 400 })
  if (pnl != null && (isNaN(pnl) || !isFinite(pnl)))           return NextResponse.json({ error: 'Invalid pnl' }, { status: 400 })

  const id = `cm-${crypto.randomBytes(8).toString('hex')}`

  const [row] = await db.insert(capitalMoves).values({
    id,
    userId,
    date:      body.date,
    type:      body.type,
    account:   body.account,
    ticker:    body.ticker?.trim().toUpperCase() ?? null,
    label:     body.label.trim(),
    quantity:  quantity  != null ? String(quantity)  : null,
    priceUnit: priceUnit != null ? String(priceUnit) : null,
    amount:    String(amount),
    currency:  body.currency === 'USD' ? 'USD' : 'EUR',
    pnl:       pnl != null ? String(pnl) : null,
    notes:     body.notes?.trim() ?? null,
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

  await db.delete(capitalMoves).where(and(eq(capitalMoves.id, id), eq(capitalMoves.userId, userId)))

  return NextResponse.json({ ok: true })
}
