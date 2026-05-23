export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { comptes, compteHistorique } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'
import crypto from 'crypto'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) return null
  return parseInt(session.user.id)
}

function mapCompte(r: typeof comptes.$inferSelect) {
  return {
    id:          r.id,
    nom:         r.nom,
    type:        r.type,
    solde:       parseFloat(r.solde),
    isDefault:   r.isDefault,
    derniereMaj: r.derniereMaj ?? null,
  }
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()

  const rows = await db.select().from(comptes).where(eq(comptes.userId, userId))

  // Si aucun compte n'existe, créer le compte courant par défaut
  if (rows.length === 0) {
    const id = crypto.randomBytes(8).toString('hex')
    await db.insert(comptes).values({
      id, userId,
      nom: 'Compte courant',
      type: 'courant',
      solde: '0',
      isDefault: true,
    })
    const [created] = await db.select().from(comptes).where(eq(comptes.userId, userId))
    const historique = await db.select().from(compteHistorique)
      .where(eq(compteHistorique.userId, userId))
      .orderBy(desc(compteHistorique.createdAt))
    return NextResponse.json([{ ...mapCompte(created), historique: historique.map(mapHistorique) }])
  }

  // Charger l'historique pour chaque compte
  const historique = await db.select().from(compteHistorique)
    .where(eq(compteHistorique.userId, userId))
    .orderBy(desc(compteHistorique.createdAt))

  return NextResponse.json(rows.map(r => ({
    ...mapCompte(r),
    historique: historique.filter(h => h.compteId === r.id || (!h.compteId && r.isDefault)).map(mapHistorique),
  })))
}

function mapHistorique(h: typeof compteHistorique.$inferSelect) {
  return {
    key:      h.key,
    label:    h.label,
    avant:    parseFloat(h.avant),
    apres:    parseFloat(h.apres),
    revenus:  parseFloat(h.revenus),
    depenses: parseFloat(h.depenses),
    epargne:  parseFloat(h.epargne),
    delta:    parseFloat(h.delta),
  }
}

export async function POST(req: Request) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const body = await req.json()

  const { nom, type, solde } = body
  if (!nom || typeof nom !== 'string' || nom.length > 100)
    return NextResponse.json({ error: 'Invalid nom' }, { status: 400 })
  if (!['courant', 'autre'].includes(type))
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const id = crypto.randomBytes(8).toString('hex')
  await db.insert(comptes).values({
    id, userId,
    nom: nom.trim(),
    type,
    solde: String(parseFloat(solde) || 0),
    isDefault: false,
  })

  return NextResponse.json({ id })
}
