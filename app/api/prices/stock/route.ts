export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

async function fetchYahoo(ticker: string, range: string, interval: string) {
  const path = `/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`
  // Try query1, then query2 as fallback
  for (const host of ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com']) {
    try {
      const res = await fetch(`${host}${path}`, { headers: HEADERS, next: { revalidate: 300 } })
      if (!res.ok) continue
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (result) return result
    } catch {}
  }
  return null
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ticker   = searchParams.get('ticker') ?? ''
  const range    = searchParams.get('range') ?? '1mo'
  const interval = searchParams.get('interval') ?? '1d'

  if (!ticker) return NextResponse.json({ error: 'Missing ticker' }, { status: 400 })

  try {
    const result = await fetchYahoo(ticker, range, interval)
    if (!result) return NextResponse.json({ error: 'Ticker non trouvé' }, { status: 404 })

    const meta        = result.meta
    const closes      = result.indicators?.quote?.[0]?.close ?? []
    const timestamps  = result.timestamp ?? []
    const validPrices = closes.filter((v: number | null) => v != null)

    return NextResponse.json({
      ticker,
      price:    meta.regularMarketPrice ?? validPrices[validPrices.length - 1] ?? 0,
      high52:   meta.fiftyTwoWeekHigh ?? (validPrices.length ? Math.max(...validPrices) : 0),
      low52:    meta.fiftyTwoWeekLow  ?? (validPrices.length ? Math.min(...validPrices) : 0),
      longName: meta.longName ?? meta.shortName ?? null,
      exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
      currency: meta.currency ?? null,
      prices:   validPrices,
      timestamps,
    })
  } catch {
    return NextResponse.json({ error: 'Erreur lors de la récupération du cours' }, { status: 500 })
  }
}
