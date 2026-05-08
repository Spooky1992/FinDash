export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') ?? ''

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=eur`
    const res = await fetch(url, { next: { revalidate: 60 } })
    const data = await res.json()
    const price = data[id]?.eur ?? null
    if (price === null) return NextResponse.json({ error: 'Coin non trouvé' }, { status: 404 })
    return NextResponse.json({ id, price })
  } catch {
    return NextResponse.json({ error: 'Erreur CoinGecko' }, { status: 500 })
  }
}
