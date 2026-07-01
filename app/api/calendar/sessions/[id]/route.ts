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
// Returns whether the Google side is in sync, with a warning message if not.
async function googleSyncRemoval(base: any, scope: string): Promise<{ synced: boolean; warning?: string }> {
  const eid = base.google_event_id
  if (!eid) return { synced: true }   // nothing linked in Google — nothing to remove
  try {
    if (!base.recurring_rule_id || scope === 'all') {
      await deleteCalendarEvent(eid)                          // single event, or whole series
    } else if (scope === 'future') {
      await truncateRecurringSeries(eid, base.start_at)       // this occurrence onward
    } else {
      await cancelRecurringInstance(eid, base.start_at)       // just this occurrence
    }
    return { synced: true }
  } catch (e: any) {
    console.error('[Calendar] removal sync:', e?.message)
    return { synced: false, warning: `Removed in the CRM, but Google Calendar could not be updated: ${e?.message ?? 'unknown error'}. Please remove it manually in Google.` }
  }
}

// PATCH — cancel / reschedule (single, or scoped across a recurring series)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, start_at, end_at, duration_minutes, notes, teacher_id, teacher_scope = 'one', scope = 'one' } = body

  const { data: existing } = await supabase.from('calendar_sessions').select('*').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const isReschedule    = !!start_at && start_at !== existing.start_at
  const isDurationChange = !!duration_minutes && duration_minutes !== existing.duration_minutes
  const isTeacherChange = !!teacher_id && teacher_id !== existing.teacher_id

  // Edit: change time/duration (this occurrence) and/or reassign the teacher
  // (optionally across the whole future series). Time change stays single-occurrence.
  if (status !== 'cancelled' && (isReschedule || isDurationChange || isTeacherChange)) {
    const update: Record<string, any> = { updated_by: user.id, updated_at: new Date().toISOString() }
    if (isReschedule) {
      update.status = 'scheduled'; update.start_at = start_at; update.end_at = end_at
      update.reminder_24h_sent = false; update.reminder_12h_sent = false; update.reminder_1h_sent = false
    } else if (isDurationChange && end_at) {
      update.end_at = end_at
    }
    if (duration_minutes) update.duration_minutes = duration_minutes
    if (isTeacherChange)  update.teacher_id = teacher_id
    if (notes !== undefined) update.notes = notes

    const { data, error } = await supabase.from('calendar_sessions').update(update).eq('id', params.id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Reassign the teacher across all upcoming sessions in the series when asked
    if (isTeacherChange && teacher_scope === 'future' && existing.recurring_rule_id) {
      await supabase.from('calendar_sessions')
        .update({ teacher_id, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq('recurring_rule_id', existing.recurring_rule_id)
        .gte('start_at', existing.start_at)
        .neq('id', params.id)
    }

    // Google time sync (this occurrence only)
    if (isReschedule && existing.google_event_id) {
      try {
        if (existing.recurring_rule_id) {
          await rescheduleRecurringInstance(existing.google_event_id, existing.start_at, start_at, end_at, 'Africa/Cairo')
        } else {
          await updateCalendarEventTime(existing.google_event_id, start_at, end_at, 'Africa/Cairo')
        }
      } catch (e: any) { console.error('[Calendar] Google reschedule failed:', e?.message) }
    }

    await supabase.from('calendar_audit_log').insert({ event_id: params.id, action: 'edited', performed_by: user.id, old_data: existing, new_data: data, source: 'crm' })
    return NextResponse.json(data)
  }

  // Cancel (optionally scoped across the recurring series)
  if (status === 'cancelled') {
    const rows = await targetSessions(supabase, existing, scope)
    const sync = await googleSyncRemoval(existing, scope)
    const ids = rows.map((r: any) => r.id)
    await supabase.from('calendar_sessions').update({ status: 'cancelled', updated_by: user.id, updated_at: new Date().toISOString() }).in('id', ids)
    // Stop a recurring series from generating more when cancelling future/all
    if (existing.recurring_rule_id && scope !== 'one') {
      await supabase.from('recurring_rules').update({ is_active: false }).eq('id', existing.recurring_rule_id)
    }
    await supabase.from('calendar_audit_log').insert({ event_id: params.id, action: 'cancelled', performed_by: user.id, old_data: existing, source: 'crm' })
    return NextResponse.json({ ok: true, affected: ids.length, googleSynced: sync.synced, warning: sync.warning })
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
  const sync = await googleSyncRemoval(existing, scope)
  const ids = rows.map((r: any) => r.id)
  const { error } = await supabase.from('calendar_sessions').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Stop a recurring series from generating more when deleting future/all
  if (existing.recurring_rule_id && scope !== 'one') {
    await supabase.from('recurring_rules').update({ is_active: false }).eq('id', existing.recurring_rule_id)
  }

  await supabase.from('calendar_audit_log').insert({ event_id: params.id, action: 'deleted', performed_by: user.id, old_data: existing, source: 'crm' })
  return NextResponse.json({ ok: true, affected: ids.length, googleSynced: sync.synced, warning: sync.warning })
}
