export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ticker   = searchParams.get('ticker') ?? ''
  const range    = searchParams.get('range') ?? '1mo'
  const interval = searchParams.get('interval') ?? '1d'

  if (!ticker) return NextResponse.json({ error: 'Missing ticker' }, { status: 400 })

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    const res = await fetch(proxy, { next: { revalidate: 300 } })
    const json = await res.json()
    const data = JSON.parse(json.contents)

    const result = data?.chart?.result?.[0]
    if (!result) return NextResponse.json({ error: 'Ticker non trouvé' }, { status: 404 })

    const meta   = result.meta
    const closes = result.indicators?.quote?.[0]?.close ?? []
    const timestamps = result.timestamp ?? []
    const validPrices = closes.filter((v: number | null) => v != null)

    return NextResponse.json({
      ticker,
      price:    meta.regularMarketPrice ?? validPrices[validPrices.length - 1] ?? 0,
      high52:   meta.fiftyTwoWeekHigh ?? Math.max(...validPrices),
      low52:    meta.fiftyTwoWeekLow  ?? Math.min(...validPrices),
      longName: meta.longName ?? meta.shortName ?? null,
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
      currency: meta.currency ?? null,
      prices:   validPrices,
      timestamps,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Erreur lors de la récupération du cours' }, { status: 500 })
  }
}
