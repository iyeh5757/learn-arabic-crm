// app/api/calendar/sessions/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  deleteCalendarEvent, updateCalendarEventTime,
  cancelRecurringInstance, rescheduleRecurringInstance, truncateRecurringSeries,
} from '@/lib/calendar/google'

export const runtime = 'nodejs'
export const maxDuration = 120

const TZ = 'Africa/Cairo'
function tzOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const m: any = {}; for (const p of dtf.formatToParts(date)) m[p.type] = p.value
  return (Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second) - date.getTime()) / 60000
}
function cairoToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm))
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000)
}
function cairoDate(iso: string): string {
  const p: any = {}; for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))) p[x.type] = x.value
  return `${p.year}-${p.month}-${p.day}`
}

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
  const { status, start_at, end_at, duration_minutes, notes, teacher_id, time, edit_scope = 'one', scope = 'one' } = body

  const { data: existing } = await supabase.from('calendar_sessions').select('*').eq('id', params.id).single()
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const isReschedule    = !!start_at && start_at !== existing.start_at
  const isDurationChange = !!duration_minutes && duration_minutes !== existing.duration_minutes
  const isTeacherChange = !!teacher_id && teacher_id !== existing.teacher_id

  // Edit: change time/duration and/or reassign the teacher — for this occurrence,
  // this & future, or all upcoming in the series (edit_scope), like delete.
  if (status !== 'cancelled' && (isReschedule || isDurationChange || isTeacherChange)) {
    const now = new Date().toISOString()
    const timeChanged = isReschedule || isDurationChange
    const dur = duration_minutes || existing.duration_minutes

    // 1) This occurrence — exact date/time/duration/teacher
    const update: Record<string, any> = { updated_by: user.id, updated_at: now }
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

    // 2) Series-wide edit (future / all) — reassign teacher and/or retime each
    // occurrence to the new time-of-day, keeping each occurrence's own date.
    if (edit_scope !== 'one' && existing.recurring_rule_id) {
      let q = supabase.from('calendar_sessions').select('id, start_at')
        .eq('recurring_rule_id', existing.recurring_rule_id)
        .neq('id', params.id)
        .neq('status', 'cancelled')
      q = edit_scope === 'future'
        ? q.gte('start_at', existing.start_at)
        : q.gte('start_at', now)   // 'all' = every upcoming occurrence
      const { data: targets } = await q

      for (const t of (targets ?? []) as any[]) {
        const rowUpd: Record<string, any> = { updated_by: user.id, updated_at: now }
        if (isTeacherChange) rowUpd.teacher_id = teacher_id
        if (timeChanged && time) {
          const ns = cairoToUtc(cairoDate(t.start_at), time)
          rowUpd.start_at = ns.toISOString()
          rowUpd.end_at = new Date(ns.getTime() + dur * 60000).toISOString()
          rowUpd.duration_minutes = dur
          rowUpd.status = 'scheduled'
          rowUpd.reminder_24h_sent = false; rowUpd.reminder_12h_sent = false; rowUpd.reminder_1h_sent = false
        }
        await supabase.from('calendar_sessions').update(rowUpd).eq('id', t.id)
      }

      // Google: shift the whole recurring series to the new time-of-day (best-effort)
      if (timeChanged && time && existing.google_event_id) {
        try {
          const ns = cairoToUtc(cairoDate(existing.start_at), time)
          await updateCalendarEventTime(existing.google_event_id, ns.toISOString(), new Date(ns.getTime() + dur * 60000).toISOString(), 'Africa/Cairo')
        } catch (e: any) { console.error('[Calendar] Google series retime failed:', e?.message) }
      }
    } else if (isReschedule && existing.google_event_id) {
      // Single-occurrence time change → move just this Google instance
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
