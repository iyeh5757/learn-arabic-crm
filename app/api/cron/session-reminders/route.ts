// app/api/cron/session-reminders/route.ts
// Hourly job: (1) send 24h/12h/1h WhatsApp reminders, (2) pull changes from Google.
// Triggered by Vercel Cron or any external scheduler that sends the CRON_SECRET.

import { NextResponse } from 'next/server'
import { processSessionReminders } from '@/lib/calendar/reminders'
import { syncFromGoogle } from '@/lib/calendar/sync'
import { topUpRecurringRules } from '@/lib/calendar/recurring'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: Request) {
  // Accept either Vercel Cron's auth header or a ?secret= query param (for external crons)
  const authHeader = req.headers.get('authorization')
  const urlSecret  = new URL(req.url).searchParams.get('secret')
  const ok = authHeader === `Bearer ${process.env.CRON_SECRET}` || urlSecret === process.env.CRON_SECRET
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron] Job started', new Date().toISOString())

  try {
    const reminders = await processSessionReminders()
    let googleSync: any = { skipped: 'google not configured' }
    try { googleSync = await syncFromGoogle() }
    catch (e: any) { googleSync = { error: e?.message } }
    let recurring: any = {}
    try { recurring = await topUpRecurringRules() }
    catch (e: any) { recurring = { error: e?.message } }

    console.log('[Cron] Done:', { reminders, googleSync, recurring })
    return NextResponse.json({ ok: true, reminders, googleSync, recurring })
  } catch (err: any) {
    console.error('[Cron] Fatal error:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
