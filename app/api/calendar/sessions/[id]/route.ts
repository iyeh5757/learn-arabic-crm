// app/api/calendar/sessions/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { deleteCalendarEvent, updateCalendarEventTime } from '@/lib/calendar/google'

export const runtime = 'nodejs'

// PATCH — update a session (cancel, mark no-show, or reschedule to a new time)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, start_at, end_at, duration_minutes, notes } = body

  const { data: existing } = await supabase
    .from('calendar_sessions')
    .select('*')
    .eq('id', params.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const isReschedule = !!start_at && start_at !== existing.start_at

  const update: Record<string, any> = { updated_by: user.id, updated_at: new Date().toISOString() }
  if (status)    update.status   = status
  if (start_at)  update.start_at = start_at
  if (end_at)    update.end_at   = end_at
  if (duration_minutes) update.duration_minutes = duration_minutes
  if (notes !== undefined) update.notes = notes

  // On reschedule: keep it active, and reset reminders so they fire for the new time
  if (isReschedule) {
    update.status            = 'scheduled'
    update.reminder_24h_sent = false
    update.reminder_12h_sent = false
    update.reminder_1h_sent  = false
  }

  const { data, error } = await supabase
    .from('calendar_sessions')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Sync the change to Google Calendar (notifies attendees)
  if (existing.google_event_id) {
    try {
      if (status === 'cancelled') {
        await deleteCalendarEvent(existing.google_event_id)
      } else if (isReschedule) {
        await updateCalendarEventTime(existing.google_event_id, start_at, end_at, 'Africa/Cairo')
      }
    } catch (e: any) { console.error('[Calendar] Google sync failed:', e?.message) }
  }

  await supabase.from('calendar_audit_log').insert({
    event_id:     params.id,
    action:       status === 'cancelled' ? 'cancelled' : isReschedule ? 'rescheduled' : 'updated',
    performed_by: user.id,
    old_data:     existing,
    new_data:     data,
    source:       'crm',
  })

  return NextResponse.json(data)
}

// DELETE — permanently remove a session
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase
    .from('calendar_sessions')
    .select('*')
    .eq('id', params.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  // Remove Google Calendar event first (notifies attendees)
  if (existing.google_event_id) {
    try { await deleteCalendarEvent(existing.google_event_id) }
    catch (e: any) { console.error('[Calendar] Google delete failed:', e?.message) }
  }

  const { error } = await supabase.from('calendar_sessions').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('calendar_audit_log').insert({
    event_id:     params.id,
    action:       'deleted',
    performed_by: user.id,
    old_data:     existing,
    source:       'crm',
  })

  return NextResponse.json({ ok: true })
}
