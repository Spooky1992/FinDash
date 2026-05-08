export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { compte, compteHistorique } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  const [row] = await db.select().from(compte).where(eq(compte.userId, userId))
  const historique = await db
    .select()
    .from(compteHistorique)
    .where(eq(compteHistorique.userId, userId))
    .orderBy(desc(compteHistorique.createdAt))

  return NextResponse.json({
    solde:       parseFloat(row?.solde ?? '0'),
    derniereMaj: row?.derniereMaj ?? null,
    historique:  historique.map(h => ({
      key:      h.key,
      label:    h.label,
      avant:    parseFloat(h.avant),
      apres:    parseFloat(h.apres),
      revenus:  parseFloat(h.revenus),
      depenses: parseFloat(h.depenses),
      epargne:  parseFloat(h.epargne),
      delta:    parseFloat(h.delta),
    })),
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  const body = await req.json()
  await db.update(compte)
    .set({
      solde:       String(body.solde),
      derniereMaj: body.derniereMaj ?? null,
      updatedAt:   new Date(),
    })
    .where(eq(compte.userId, userId))

  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  // Ajoute une entrée d'historique
  const body = await req.json()
  await db.insert(compteHistorique).values({
    userId,
    key:      body.key,
    label:    body.label,
    avant:    String(body.avant),
    apres:    String(body.apres),
    revenus:  String(body.revenus ?? 0),
    depenses: String(body.depenses ?? 0),
    epargne:  String(body.epargne ?? 0),
    delta:    String(body.delta),
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = parseInt(session.user.id)

  const { key } = await req.json()
  await db.delete(compteHistorique)
    .where(eq(compteHistorique.key, key))

  return NextResponse.json({ ok: true })
}
