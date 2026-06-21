// lib/calendar/reminders.ts
// Core reminder logic — called by the hourly cron job

import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppReminder, type SessionReminderData } from '@/lib/notifications/whatsapp'

interface ReminderWindow {
  field:        'reminder_24h_sent' | 'reminder_12h_sent' | 'reminder_1h_sent'
  hoursBeforeLabel: '24 hours' | '12 hours' | '1 hour'
  hoursMin:     number  // window start (hours from now)
  hoursMax:     number  // window end   (hours from now)
  hoursBefore:  24 | 12 | 1
}

const REMINDER_WINDOWS: ReminderWindow[] = [
  { field: 'reminder_24h_sent', hoursBeforeLabel: '24 hours', hoursMin: 23.5, hoursMax: 24.5, hoursBefore: 24 },
  { field: 'reminder_12h_sent', hoursBeforeLabel: '12 hours', hoursMin: 11.5, hoursMax: 12.5, hoursBefore: 12 },
  { field: 'reminder_1h_sent',  hoursBeforeLabel: '1 hour',   hoursMin:  0.5, hoursMax:  1.5, hoursBefore:  1 },
]

export async function processSessionReminders(): Promise<{
  processed: number
  sent: number
  failed: number
  skipped: number
}> {
  const supabase = createClient()
  const now = new Date()

  let processed = 0, sent = 0, failed = 0, skipped = 0

  for (const window of REMINDER_WINDOWS) {
    const windowStart = new Date(now.getTime() + window.hoursMin * 60 * 60 * 1000)
    const windowEnd   = new Date(now.getTime() + window.hoursMax * 60 * 60 * 1000)

    const { data: sessions, error } = await supabase
      .from('calendar_sessions')
      .select(`
        id, student_name, student_email, student_phone,
        start_at, duration_minutes, google_meet_link,
        session_type_id, teacher_id,
        session_type:session_type_config(name),
        teacher:teachers(profile:profiles!teachers_user_id_fkey(name))
      `)
      .eq(window.field, false)
      .eq('status', 'scheduled')
      .gte('start_at', windowStart.toISOString())
      .lte('start_at', windowEnd.toISOString())

    if (error) {
      console.error(`[Reminders] DB error for ${window.field}:`, error.message)
      continue
    }

    for (const session of (sessions ?? [])) {
      processed++

      const teacherName  = (session.teacher as any)?.profile?.name ?? 'your teacher'
      const sessionType  = (session.session_type as any)?.name ?? 'Arabic'
      const studentName  = session.student_name ?? 'Student'
      const studentPhone = session.student_phone

      if (!studentPhone) {
        skipped++
        continue
      }

      const reminderData: SessionReminderData = {
        studentName,
        teacherName,
        sessionType,
        startAt:      new Date(session.start_at),
        durationMins: session.duration_minutes,
        meetLink:     session.google_meet_link ?? undefined,
        hoursBeforeLabel: window.hoursBeforeLabel,
      }

      const wa = await sendWhatsAppReminder(studentPhone, reminderData)
      await logReminder(supabase, session.id, window.hoursBefore, 'whatsapp', studentPhone, wa)
      wa.success ? sent++ : failed++

      // Mark this reminder as sent regardless of individual channel results
      // so we don't retry the same session every hour
      await supabase
        .from('calendar_sessions')
        .update({ [window.field]: true })
        .eq('id', session.id)
    }
  }

  return { processed, sent, failed, skipped }
}

async function logReminder(
  supabase: any,
  sessionId: string,
  hoursBefore: number,
  channel: 'whatsapp',
  sentTo: string,
  result: { success: boolean; error?: string }
) {
  await supabase.from('session_reminder_log').insert({
    session_id:   sessionId,
    hours_before: hoursBefore,
    channel,
    sent_to:  sentTo,
    status:   result.success ? 'sent' : 'failed',
    error:    result.error ?? null,
  })
}
