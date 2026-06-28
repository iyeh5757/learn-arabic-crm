// app/api/calendar/sessions/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  deleteCalendarEvent, updateCalendarEventTime,
  cancelRecurringInstance, rescheduleRecurringInstance, truncateRecurringSeries,
} from '@/lib/calendar/google'

export const runtime = 'nodejs'
export const maxDuration = 120

// Collect the sessions a scoped operation targets (one / future / all in a series)
async function targetSessions(supabase: any, base: any, scope: string) {
  if (scope === 'one' || !base.recurring_rule_id) {
    return [base]
  }
  let q = supabase.from('calendar_sessions').select('*').eq('recurring_rule_id', base.recurring_rule_id)
  if (scope === 'future') q = q.gte('start_at', base.start_at)
  const { data } = await q
  return data ?? [base]
}

// Sync a cancel/delete to Google. Recurring rows all share one master event ID,
// so we act on the master (delete whole series), the series tail (truncate), or a
// single instance — depending on scope — instead of deleting the master N times.
async function googleSyncRemoval(base: any, scope: string) {
  const eid = base.google_event_id
  if (!eid) return
  try {
    if (!base.recurring_rule_id || scope === 'all') {
      await deleteCalendarEvent(eid)                          // single event, or whole series
    } else if (scope === 'future') {
      await truncateRecurringSeries(eid, base.start_at)       // this occurrence onward
    } else {
      await cancelRecurringInstance(eid, base.start_at)       // just this occurrence
    }
  } catch (e: any) { console.error('[Calendar] removal sync:', e?.message) }
}

// PATCH — cancel / reschedule (single, or scoped across a recurring series)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, start_at, end_at, duration_minutes, notes, scope = 'one' } = body

  const { data: existing } = await supabase.from('calendar_sessions').select('*').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const isReschedule = !!start_at && start_at !== existing.start_at

  // Reschedule only ever affects the single occurrence
  if (isReschedule) {
    const update: Record<string, any> = {
      status: 'scheduled', start_at, end_at, updated_by: user.id, updated_at: new Date().toISOString(),
      reminder_24h_sent: false, reminder_12h_sent: false, reminder_1h_sent: false,
    }
    if (duration_minutes) update.duration_minutes = duration_minutes
    if (notes !== undefined) update.notes = notes
    const { data, error } = await supabase.from('calendar_sessions').update(update).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (existing.google_event_id) {
      try {
        if (existing.recurring_rule_id) {
          // Move just this occurrence of the series, not the whole series
          await rescheduleRecurringInstance(existing.google_event_id, existing.start_at, start_at, end_at, 'Africa/Cairo')
        } else {
          await updateCalendarEventTime(existing.google_event_id, start_at, end_at, 'Africa/Cairo')
        }
      } catch (e: any) { console.error('[Calendar] Google reschedule failed:', e?.message) }
    }
    await supabase.from('calendar_audit_log').insert({ event_id: params.id, action: 'rescheduled', performed_by: user.id, old_data: existing, new_data: data, source: 'crm' })
    return NextResponse.json(data)
  }

  // Cancel (optionally scoped across the recurring series)
  if (status === 'cancelled') {
    const rows = await targetSessions(supabase, existing, scope)
    await googleSyncRemoval(existing, scope)
    const ids = rows.map((r: any) => r.id)
    await supabase.from('calendar_sessions').update({ status: 'cancelled', updated_by: user.id, updated_at: new Date().toISOString() }).in('id', ids)
    // Stop a recurring series from generating more when cancelling future/all
    if (existing.recurring_rule_id && scope !== 'one') {
      await supabase.from('recurring_rules').update({ is_active: false }).eq('id', existing.recurring_rule_id)
    }
    await supabase.from('calendar_audit_log').insert({ event_id: params.id, action: 'cancelled', performed_by: user.id, old_data: existing, source: 'crm' })
    return NextResponse.json({ ok: true, affected: ids.length })
  }

  // Plain field update (notes / status other than cancel)
  const update: Record<string, any> = { updated_by: user.id, updated_at: new Date().toISOString() }
  if (status) update.status = status
  if (notes !== undefined) update.notes = notes
  const { data, error } = await supabase.from('calendar_sessions').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE — permanently remove (single, or scoped across a recurring series)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = new URL(req.url).searchParams.get('scope') ?? 'one'

  const { data: existing } = await supabase.from('calendar_sessions').select('*').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const rows = await targetSessions(supabase, existing, scope)
  await googleSyncRemoval(existing, scope)
  const ids = rows.map((r: any) => r.id)
  const { error } = await supabase.from('calendar_sessions').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Stop a recurring series from generating more when deleting future/all
  if (existing.recurring_rule_id && scope !== 'one') {
    await supabase.from('recurring_rules').update({ is_active: false }).eq('id', existing.recurring_rule_id)
  }

  await supabase.from('calendar_audit_log').insert({ event_id: params.id, action: 'deleted', performed_by: user.id, old_data: existing, source: 'crm' })
  return NextResponse.json({ ok: true, affected: ids.length })
}
