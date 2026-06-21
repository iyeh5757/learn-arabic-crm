// app/api/cron/session-reminders/route.ts
// Called every hour by Vercel Cron. Sends 24h / 12h / 1h reminders.

import { NextResponse } from 'next/server'
import { processSessionReminders } from '@/lib/calendar/reminders'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  // Verify this is a legitimate Vercel Cron request
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron] Session reminders job started', new Date().toISOString())

  try {
    const result = await processSessionReminders()
    console.log('[Cron] Done:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[Cron] Fatal error:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 })
  }
}
