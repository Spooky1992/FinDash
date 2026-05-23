export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { comptes, compteHistorique } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) return null
  return parseInt(session.user.id)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const db = getDb()
  const body = await req.json()

  // Action spéciale : définir comme compte par défaut
  if (body.action === 'set-default') {
    // Retirer isDefault de tous les comptes de l'user
    await db.update(comptes).set({ isDefault: false }).where(eq(comptes.userId, userId))
    // Définir celui-ci comme défaut
    await db.update(comptes).set({ isDefault: true })
      .where(and(eq(comptes.id, id), eq(comptes.userId, userId)))
    return NextResponse.json({ ok: true })
  }

  // Mise à jour normale (nom, type, solde, derniereMaj)
  const updates: Partial<typeof comptes.$inferInsert> = {}
  if (body.nom !== undefined) updates.nom = String(body.nom).trim().slice(0, 100)
  if (body.type !== undefined && ['courant', 'autre'].includes(body.type)) updates.type = body.type
  if (body.solde !== undefined) updates.solde = String(parseFloat(body.solde) || 0)
  if (body.derniereMaj !== undefined) updates.derniereMaj = body.derniereMaj
  updates.updatedAt = new Date()

  await db.update(comptes).set(updates)
    .where(and(eq(comptes.id, id), eq(comptes.userId, userId)))

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const db = getDb()

  // Vérifier que ce n'est pas le seul compte
  const all = await db.select().from(comptes).where(eq(comptes.userId, userId))
  if (all.length <= 1) return NextResponse.json({ error: 'Cannot delete last account' }, { status: 400 })

  const target = all.find(c => c.id === id)
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.delete(comptes).where(and(eq(comptes.id, id), eq(comptes.userId, userId)))
  await db.delete(compteHistorique).where(and(eq(compteHistorique.compteId, id), eq(compteHistorique.userId, userId)))

  // Si c'était le compte par défaut, promouvoir le premier restant
  if (target.isDefault) {
    const remaining = all.filter(c => c.id !== id)
    if (remaining.length > 0) {
      await db.update(comptes).set({ isDefault: true })
        .where(and(eq(comptes.id, remaining[0].id), eq(comptes.userId, userId)))
    }
  }

  return NextResponse.json({ ok: true })
}

// POST sur /api/comptes/[id] = ajouter une entrée d'historique pour ce compte
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: compteId } = await params
  const db = getDb()
  const body = await req.json()

  await db.insert(compteHistorique).values({
    userId,
    compteId,
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
