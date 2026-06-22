// lib/calendar/reminders.ts
// Catch-up reminder logic. For each upcoming session it sends the most urgent
// reminder that hasn't gone out yet (24h → 12h → 1h). This means a session
// booked late (e.g. 45 min before start) still gets its 1-hour reminder, and
// reminders that became moot (e.g. the 24h mark already passed) are skipped.

import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppReminder } from '@/lib/notifications/whatsapp'

type SessionRow = {
  id: string
  student_name: string | null
  student_phone: string | null
  start_at: string
  duration_minutes: number
  google_meet_link: string | null
  reminder_24h_sent: boolean
  reminder_12h_sent: boolean
  reminder_1h_sent: boolean
  session_type?: { name?: string } | null
  teacher?: { profile?: { name?: string } } | null
}

const SELECT = `
  id, student_name, student_phone, start_at, duration_minutes, google_meet_link,
  reminder_24h_sent, reminder_12h_sent, reminder_1h_sent,
  session_type:session_type_config(name),
  teacher:teachers(profile:profiles!teachers_user_id_fkey(name))
`

// Decide which reminder (if any) is due for a session right now.
// Returns the label + which flags to mark sent (earlier ones are marked too,
// so a late booking doesn't later fire an out-of-date reminder).
function pickReminder(s: SessionRow, now: Date): {
  label: '24 hours' | '12 hours' | '1 hour'
  fields: string[]
} | null {
  const hoursUntil = (new Date(s.start_at).getTime() - now.getTime()) / 3_600_000
  if (hoursUntil <= 0 || hoursUntil > 24.5) return null

  if (hoursUntil <= 1.5 && !s.reminder_1h_sent) {
    return { label: '1 hour', fields: ['reminder_24h_sent', 'reminder_12h_sent', 'reminder_1h_sent'] }
  }
  if (hoursUntil <= 12.5 && !s.reminder_12h_sent) {
    return { label: '12 hours', fields: ['reminder_24h_sent', 'reminder_12h_sent'] }
  }
  if (hoursUntil <= 24.5 && !s.reminder_24h_sent) {
    return { label: '24 hours', fields: ['reminder_24h_sent'] }
  }
  return null
}

// Send the due reminder for a single session. Used by both the cron and the
// booking flow (so a session booked within the hour is reminded immediately).
export async function sendDueReminderForSession(
  supabase: any,
  s: SessionRow,
  now = new Date()
): Promise<'sent' | 'failed' | 'skipped' | 'none'> {
  const due = pickReminder(s, now)
  if (!due) return 'none'
  if (!s.student_phone) return 'skipped'   // no phone — leave flags so it can fire if a phone is added

  const wa = await sendWhatsAppReminder(s.student_phone, {
    studentName:  s.student_name ?? 'Student',
    teacherName:  s.teacher?.profile?.name ?? 'your teacher',
    sessionType:  s.session_type?.name ?? 'Arabic',
    startAt:      new Date(s.start_at),
    durationMins: s.duration_minutes,
    meetLink:     s.google_meet_link ?? undefined,
    hoursBeforeLabel: due.label,
  })

  await supabase.from('session_reminder_log').insert({
    session_id:   s.id,
    hours_before: due.label === '1 hour' ? 1 : due.label === '12 hours' ? 12 : 24,
    channel:      'whatsapp',
    sent_to:      s.student_phone,
    status:       wa.success ? 'sent' : 'failed',
    error:        wa.error ?? null,
  })

  const update: Record<string, boolean> = {}
  for (const f of due.fields) update[f] = true
  await supabase.from('calendar_sessions').update(update).eq('id', s.id)

  return wa.success ? 'sent' : 'failed'
}

// Fire any due reminder for one freshly-booked session (called right after booking).
export async function remindSessionIfDue(supabase: any, sessionId: string): Promise<void> {
  const { data } = await supabase.from('calendar_sessions').select(SELECT).eq('id', sessionId).single()
  if (data) {
    try { await sendDueReminderForSession(supabase, data as SessionRow) }
    catch (e: any) { console.error('[Reminders] immediate send failed:', e?.message) }
  }
}

// Cron entry point — scan all upcoming sessions and send whatever is due.
export async function processSessionReminders(): Promise<{
  processed: number; sent: number; failed: number; skipped: number
}> {
  const supabase = createClient()
  const now = new Date()
  const horizon = new Date(now.getTime() + 25 * 3_600_000).toISOString()

  const { data: sessions, error } = await supabase
    .from('calendar_sessions')
    .select(SELECT)
    .eq('status', 'scheduled')
    .gt('start_at', now.toISOString())
    .lte('start_at', horizon)
    .or('reminder_24h_sent.eq.false,reminder_12h_sent.eq.false,reminder_1h_sent.eq.false')

  if (error) {
    console.error('[Reminders] DB error:', error.message)
    return { processed: 0, sent: 0, failed: 0, skipped: 0 }
  }

  let processed = 0, sent = 0, failed = 0, skipped = 0
  for (const s of (sessions ?? []) as SessionRow[]) {
    processed++
    const r = await sendDueReminderForSession(supabase, s, now)
    if (r === 'sent') sent++
    else if (r === 'failed') failed++
    else if (r === 'skipped') skipped++
  }

  return { processed, sent, failed, skipped }
}
