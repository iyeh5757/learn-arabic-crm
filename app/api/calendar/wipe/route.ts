// app/api/calendar/wipe/route.ts
// Admin-only maintenance: delete ALL calendar sessions (and their Google events)
// plus recurring rules. Intended for clearing test data before going live.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { deleteCalendarEvent, isGoogleConfigured } from '@/lib/calendar/google'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'DELETE') return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })

  const admin = createAdminClient()

  // Delete the Google Calendar events first (we lose the ids once rows are gone)
  let googleDeleted = 0
  if (isGoogleConfigured()) {
    const { data: withEvents } = await admin
      .from('calendar_sessions').select('google_event_id').not('google_event_id', 'is', null)
    for (const s of withEvents ?? []) {
      try { await deleteCalendarEvent(s.google_event_id as string); googleDeleted++ }
      catch (e: any) { console.error('[Wipe] google delete:', e?.message) }
    }
  }

  // Count, then clear the CRM tables
  const { count } = await admin.from('calendar_sessions').select('*', { count: 'exact', head: true })
  await admin.from('calendar_sessions').delete().not('id', 'is', null)
  await admin.from('recurring_rules').delete().not('id', 'is', null)

  return NextResponse.json({ ok: true, sessionsDeleted: count ?? 0, googleDeleted })
}
