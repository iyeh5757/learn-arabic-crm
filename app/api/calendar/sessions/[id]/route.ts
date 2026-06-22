// app/api/calendar/sessions/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { deleteCalendarEvent } from '@/lib/calendar/google'

export const runtime = 'nodejs'

// PATCH — update a session (e.g. cancel, mark no-show, reschedule)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, start_at, end_at, notes } = body

  const { data: existing } = await supabase
    .from('calendar_sessions')
    .select('*')
    .eq('id', params.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const update: Record<string, any> = { updated_by: user.id, updated_at: new Date().toISOString() }
  if (status)    update.status   = status
  if (start_at)  update.start_at = start_at
  if (end_at)    update.end_at   = end_at
  if (notes !== undefined) update.notes = notes

  const { data, error } = await supabase
    .from('calendar_sessions')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // If cancelled, remove the Google Calendar event (notifies attendees)
  if (status === 'cancelled' && existing.google_event_id) {
    try { await deleteCalendarEvent(existing.google_event_id) }
    catch (e: any) { console.error('[Calendar] Google cancel failed:', e?.message) }
  }

  await supabase.from('calendar_audit_log').insert({
    event_id:     params.id,
    action:       status === 'cancelled' ? 'cancelled' : status === 'rescheduled' ? 'rescheduled' : 'updated',
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
