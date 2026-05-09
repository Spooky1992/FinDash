export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}

// Retourne le taux EUR/USD (1 EUR = X USD) à une date donnée via Yahoo Finance EUR=X
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  const ts = Math.floor(new Date(date).getTime() / 1000)
  // Fenêtre de ±3 jours pour couvrir week-ends et jours fériés
  const period1 = ts - 3 * 86400
  const period2 = ts + 3 * 86400

  for (const host of ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']) {
    try {
      const url = `${host}/v8/finance/chart/EUR%3DX?period1=${period1}&period2=${period2}&interval=1d`
      const res = await fetch(url, { headers: HEADERS, next: { revalidate: 86400 } })
      if (!res.ok) continue
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (!result) continue

      const timestamps: number[] = result.timestamp ?? []
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []

      // Trouver le point le plus proche de la date demandée
      let best = -1, bestDiff = Infinity
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] == null) continue
        const diff = Math.abs(timestamps[i] - ts)
        if (diff < bestDiff) { bestDiff = diff; best = i }
      }

      if (best === -1) continue
      // EUR=X donne le prix de 1 EUR en USD → c'est directement le taux EUR/USD
      const eurUsd = closes[best] as number
      return NextResponse.json({ date, eurUsd, day: new Date(timestamps[best] * 1000).toISOString().slice(0, 10) })
    } catch {}
  }

  return NextResponse.json({ error: 'Taux introuvable pour cette date' }, { status: 404 })
}
