// app/api/exchange-rate/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 3600 } // cache 1 hour
    })
    const data = await res.json()
    return NextResponse.json({
      EGP: data?.rates?.EGP ?? 48.5,
      GBP: data?.rates?.GBP ?? 0.79,
      EUR: data?.rates?.EUR ?? 0.92,
      AED: data?.rates?.AED ?? 3.67,
      timestamp: data?.time_last_update_utc,
    })
  } catch {
    return NextResponse.json({ EGP: 48.5, GBP: 0.79, EUR: 0.92, AED: 3.67 })
  }
}
