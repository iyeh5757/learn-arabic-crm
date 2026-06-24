// app/api/calendar/sessions/recurring/route.ts
// Generates real sessions for a recurring schedule: one occurrence per selected
// weekday over N weeks. Shares a single Meet link across the series (same
// student + teacher), creates a calendar event per occurrence, and a CRM row.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createMeetSpace, createCalendarEventWithLink, isGoogleConfigured } from '@/lib/calendar/google'
import { remindSessionIfDue } from '@/lib/calendar/reminders'

export const runtime = 'nodejs'
export const maxDuration = 300

const TZ = 'Africa/Cairo'
const MAX_OCCURRENCES = 60

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

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'sales', 'supervisor'].includes(profile?.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const b = await req.json()
  const {
    session_type_id, teacher_id, student_id, student_name, student_email, student_phone,
    start_date, start_time, duration_minutes, days_of_week, weeks = 8, never_end = false, notes,
    open_access, auto_record,
  } = b

  if (!teacher_id || !start_date || !start_time || !duration_minutes || !Array.isArray(days_of_week) || days_of_week.length === 0) {
    return NextResponse.json({ error: 'Missing required fields for recurring booking' }, { status: 400 })
  }

  // Book up to an 8-week initial horizon now; the hourly cron extends active
  // series further (so "never ends" keeps rolling, and long fixed series fill in).
  const INITIAL_WEEKS = 8
  const genWeeks = never_end ? INITIAL_WEEKS : Math.min(weeks, INITIAL_WEEKS)

  // until_date: null = never-ending; otherwise start_date + weeks
  let untilDate: string | null = null
  if (!never_end) {
    const u = new Date(start_date + 'T00:00:00'); u.setDate(u.getDate() + weeks * 7)
    untilDate = `${u.getFullYear()}-${String(u.getMonth() + 1).padStart(2, '0')}-${String(u.getDate()).padStart(2, '0')}`
  }

  // Compute occurrence dates (Cairo) for selected weekdays over the initial horizon
  const [by, bm, bd] = start_date.split('-').map(Number)
  const occurrences: { startIso: string; endIso: string }[] = []
  const now = Date.now()
  for (let n = 0; n < genWeeks * 7 && occurrences.length < MAX_OCCURRENCES; n++) {
    const day = new Date(by, bm - 1, bd + n)
    if (!days_of_week.includes(day.getDay())) continue
    const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const start = cairoToUtc(ds, start_time)
    if (start.getTime() < now) continue
    occurrences.push({ startIso: start.toISOString(), endIso: new Date(start.getTime() + duration_minutes * 60000).toISOString() })
  }
  if (occurrences.length === 0) return NextResponse.json({ error: 'No upcoming dates to book (all selected dates are in the past)' }, { status: 400 })

  // Create the rule
  const { data: rule } = await supabase.from('recurring_rules').insert({
    teacher_id, student_id: student_id || null, session_type_id: session_type_id || null,
    days_of_week, start_time: start_time + ':00', duration_minutes, until_date: untilDate, created_by: user.id,
  }).select().single()

  // Look up teacher email + type name + one shared Meet link for the whole series
  const [{ data: teacherRow }, { data: typeRow }] = await Promise.all([
    supabase.from('teachers').select('profile:profiles!teachers_user_id_fkey(name, email)').eq('id', teacher_id).single(),
    session_type_id ? supabase.from('session_type_config').select('name').eq('id', session_type_id).single() : Promise.resolve({ data: null }),
  ])
  const teacherEmail = (teacherRow as any)?.profile?.email ?? ''
  const teacherName  = (teacherRow as any)?.profile?.name ?? 'Teacher'
  const typeName     = (typeRow as any)?.name ?? 'Arabic'

  let meetLink: string | null = null
  if (isGoogleConfigured()) {
    try {
      const space = await createMeetSpace({ openAccess: !!open_access, autoRecord: !!auto_record })
      meetLink = space?.meetUri ?? null
    } catch (e: any) { console.error('[Recurring] meet space failed:', e?.message) }
  }

  // Create a session (+ calendar event) per occurrence
  const summary = `${typeName} — ${student_name ?? 'Student'} with ${teacherName}`
  let created = 0
  for (let i = 0; i < occurrences.length; i++) {
    const occ = occurrences[i]
    let googleEventId: string | null = null
    if (meetLink && isGoogleConfigured()) {
      try {
        const ev = await createCalendarEventWithLink(
          { summary, description: notes ?? '', startIso: occ.startIso, endIso: occ.endIso, timezone: TZ, attendees: [student_email, teacherEmail].filter(Boolean) },
          meetLink,
          i === 0 ? 'all' : 'none',   // only the first invite emails the student
        )
        googleEventId = ev?.eventId ?? null
      } catch (e: any) { console.error('[Recurring] calendar event failed:', e?.message) }
    }

    const { data: row, error } = await supabase.from('calendar_sessions').insert({
      session_type_id: session_type_id || null, teacher_id, student_id: student_id || null,
      student_name, student_email, student_phone,
      start_at: occ.startIso, end_at: occ.endIso, duration_minutes, notes: notes ?? null,
      recurring_rule_id: rule?.id ?? null, is_recurring_root: i === 0,
      google_event_id: googleEventId, google_meet_link: meetLink,
      google_synced_at: googleEventId ? new Date().toISOString() : null,
      created_by: user.id,
    }).select('id').single()
    if (!error && row) {
      created++
      try { await remindSessionIfDue(supabase, row.id) } catch {}
    }
  }

  return NextResponse.json({ ok: true, created, total: occurrences.length, meetLink: !!meetLink })
}
