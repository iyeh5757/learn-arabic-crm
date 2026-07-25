// app/api/meta/send-now/route.ts
// Admin: push conversion events for a date range to Meta on demand (a manual
// trigger of the same thing the daily cron does).
import { createClient } from '@/lib/supabase/server'
import { collectConversionEvents } from '@/lib/meta/collect'
import { sendCapiEvents } from '@/lib/meta/capi'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { from, to, test_event_code } = await req.json()
  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 })

  const events = await collectConversionEvents(supabase, new Date(from).toISOString(), new Date(to).toISOString())
  const result = await sendCapiEvents(events, test_event_code?.trim() ? { testEventCode: test_event_code.trim() } : undefined)

  if (!result.ok) return NextResponse.json({ error: result.error, collected: events.length, response: result.response }, { status: 502 })
  return NextResponse.json({ ok: true, collected: events.length, sent: result.sent, meta: result.response })
}
