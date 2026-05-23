export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { compteHistorique } from '@/lib/schema'
import { eq, and } from 'drizzle-orm'

async function getUserId() {
  const session = await auth()
  if (!session?.user?.id) return null
  return parseInt(session.user.id)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: compteId } = await params
  const db = getDb()
  const { key } = await req.json()
  if (!key || typeof key !== 'string') return NextResponse.json({ error: 'Invalid key' }, { status: 400 })

  await db.delete(compteHistorique)
    .where(and(
      eq(compteHistorique.key, key),
      eq(compteHistorique.compteId, compteId),
      eq(compteHistorique.userId, userId),
    ))

  return NextResponse.json({ ok: true })
}
