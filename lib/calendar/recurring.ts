// lib/calendar/recurring.ts
// Rolling generation for recurring schedules. Keeps every active rule topped up
// with sessions ~8 weeks ahead, so "never-ending" series never run out. Fixed
// series stop at their until_date.

import { createAdminClient } from '@/lib/supabase/admin'
import { isGoogleConfigured } from './google'

const TZ = 'Africa/Cairo'
const HORIZON_WEEKS = 8

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
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function topUpRecurringRules(): Promise<{ rules: number; created: number }> {
  const supabase = createAdminClient()
  const { data: rules } = await supabase.from('recurring_rules').select('*').eq('is_active', true)
  let created = 0
  for (const rule of rules ?? []) {
    try { created += await topUpOne(supabase, rule) } catch (e: any) { console.error('[Recurring] top-up failed:', e?.message) }
  }
  return { rules: (rules ?? []).length, created }
}

async function topUpOne(supabase: any, rule: any): Promise<number> {
  // Clone future occurrences from the most recent session of this rule
  const { data: tmpl } = await supabase
    .from('calendar_sessions').select('*')
    .eq('recurring_rule_id', rule.id).order('start_at', { ascending: false }).limit(1).maybeSingle()
  if (!tmpl) return 0

  // Horizon: 8 weeks out, capped by until_date (null = never-ending)
  let endCap = new Date(Date.now() + HORIZON_WEEKS * 7 * 86400000)
  if (rule.until_date) {
    const u = new Date(rule.until_date + 'T23:59:59')
    if (u < endCap) endCap = u
  }

  const { data: existing } = await supabase
    .from('calendar_sessions').select('start_at').eq('recurring_rule_id', rule.id)
  const existingTimes = new Set((existing ?? []).map((e: any) => new Date(e.start_at).getTime()))

  const days: number[] = rule.days_of_week ?? []
  const timeHHmm = (rule.start_time ?? '00:00').slice(0, 5)

  let created = 0
  const cursor = new Date(tmpl.start_at); cursor.setHours(0, 0, 0, 0); cursor.setDate(cursor.getDate() + 1)
  for (let guard = 0; cursor <= endCap && guard < 130; guard++, cursor.setDate(cursor.getDate() + 1)) {
    if (!days.includes(cursor.getDay())) continue
    const start = cairoToUtc(fmtDate(cursor), timeHHmm)
    if (start.getTime() < Date.now()) continue
    if (existingTimes.has(start.getTime())) continue
    const end = new Date(start.getTime() + rule.duration_minutes * 60000)

    // No new Calendar API call here: the native recurring Google event already
    // covers all future dates. We just link each CRM row to that master event
    // (tmpl.google_event_id) and carry the shared Meet link so single-occurrence
    // cancel / reschedule can target the right instance.
    await supabase.from('calendar_sessions').insert({
      session_type_id: tmpl.session_type_id, teacher_id: tmpl.teacher_id, student_id: tmpl.student_id,
      student_name: tmpl.student_name, student_email: tmpl.student_email, student_phone: tmpl.student_phone,
      start_at: start.toISOString(), end_at: end.toISOString(), duration_minutes: rule.duration_minutes,
      notes: tmpl.notes, recurring_rule_id: rule.id,
      google_event_id: tmpl.google_event_id ?? null, google_meet_link: tmpl.google_meet_link,
      google_synced_at: tmpl.google_event_id ? new Date().toISOString() : null,
      created_by: tmpl.created_by,
    })
    existingTimes.add(start.getTime())
    created++
  }
  return created
}
