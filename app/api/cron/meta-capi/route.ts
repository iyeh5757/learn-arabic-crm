// app/api/cron/meta-capi/route.ts
// Daily job: push the last ~25h of conversion events (trial / paid / renewal)
// to Meta's Conversions API. Deterministic event_ids let Meta dedupe overlaps.
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { collectConversionEvents } from '@/lib/meta/collect'
import { sendCapiEvents } from '@/lib/meta/capi'
import { refreshFxRates } from '@/lib/fx/refresh'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const urlSecret = new URL(req.url).searchParams.get('secret')
  const ok = authHeader === `Bearer ${process.env.CRON_SECRET}` || urlSecret === process.env.CRON_SECRET
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Refresh cached FX rates first (used by the payment triggers).
  // Fully isolated: a failure here must never stop the Meta send.
  let fx: any = { ok: false, outcome: 'not_run' }
  try { fx = await refreshFxRates() }
  catch (e: any) { fx = { ok: false, outcome: 'threw', error: e?.message ?? 'unknown' } }

  const to = new Date()
  const from = new Date(to.getTime() - 25 * 3600 * 1000)   // slight overlap for safety
  const events = await collectConversionEvents(supabase, from.toISOString(), to.toISOString())
  const result = await sendCapiEvents(events)

  return NextResponse.json({ window: { from: from.toISOString(), to: to.toISOString() }, fx, collected: events.length, ...result })
}
