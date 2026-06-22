// lib/calendar/sync.ts
// Inbound sync: reconcile CRM sessions against their Google Calendar events.
// Detects events deleted/cancelled or moved in Google and updates the CRM.

import { createClient } from '@/lib/supabase/server'
import { getCalendarEvent, isGoogleConfigured } from './google'

export async function syncFromGoogle(): Promise<{
  checked: number
  cancelled: number
  rescheduled: number
  skipped: number
}> {
  if (!isGoogleConfigured()) {
    return { checked: 0, cancelled: 0, rescheduled: 0, skipped: 0 }
  }

  const supabase = createClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: sessions } = await supabase
    .from('calendar_sessions')
    .select('id, google_event_id, start_at, end_at, status')
    .not('google_event_id', 'is', null)
    .in('status', ['scheduled', 'rescheduled'])
    .gte('end_at', cutoff)

  let cancelled = 0, rescheduled = 0, skipped = 0

  for (const s of sessions ?? []) {
    let ev
    try { ev = await getCalendarEvent(s.google_event_id as string) }
    catch { skipped++; continue }
    if (!ev) { skipped++; continue }

    if (ev.cancelled) {
      await supabase.from('calendar_sessions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', s.id)
      await supabase.from('calendar_audit_log').insert({
        event_id: s.id, action: 'cancelled', source: 'google',
      })
      cancelled++
    } else if (ev.startIso && ev.endIso) {
      const newStart = new Date(ev.startIso).toISOString()
      const newEnd   = new Date(ev.endIso).toISOString()
      const curStart = new Date(s.start_at).toISOString()
      const curEnd   = new Date(s.end_at).toISOString()
      if (newStart !== curStart || newEnd !== curEnd) {
        await supabase.from('calendar_sessions')
          .update({ start_at: newStart, end_at: newEnd, status: 'rescheduled', updated_at: new Date().toISOString() })
          .eq('id', s.id)
        await supabase.from('calendar_audit_log').insert({
          event_id: s.id, action: 'rescheduled', source: 'google',
        })
        rescheduled++
      }
    }
  }

  return { checked: (sessions ?? []).length, cancelled, rescheduled, skipped }
}
