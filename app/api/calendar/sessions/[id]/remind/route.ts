// app/api/calendar/sessions/[id]/remind/route.ts
// Admin-only: send a WhatsApp reminder for one specific session immediately
// (bypasses the time windows) — used to verify the WhatsApp pipeline.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsAppReminder } from '@/lib/notifications/whatsapp'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'sales', 'supervisor'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { data: s } = await supabase
    .from('calendar_sessions')
    .select(`
      id, student_name, student_phone, start_at, duration_minutes, google_meet_link,
      session_type:session_type_config(name),
      teacher:teachers(profile:profiles!teachers_user_id_fkey(name)),
      student:students(country, whatsapp_group_id)
    `)
    .eq('id', params.id)
    .single()

  if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const groupId = (s.student as any)?.whatsapp_group_id ?? undefined
  if (!s.student_phone && !groupId) {
    return NextResponse.json({ error: 'This student has no phone number or WhatsApp group ID saved.' }, { status: 400 })
  }

  const result = await sendWhatsAppReminder(s.student_phone ?? '', {
    studentName:  s.student_name ?? 'Student',
    teacherName:  (s.teacher as any)?.profile?.name ?? 'your teacher',
    sessionType:  (s.session_type as any)?.name ?? 'Arabic',
    startAt:      new Date(s.start_at),
    durationMins: s.duration_minutes,
    meetLink:     s.google_meet_link ?? undefined,
    hoursBeforeLabel: '12 hours',
    studentCountry: (s.student as any)?.country ?? undefined,
    whatsappGroupId: groupId,
  })

  // log it
  await supabase.from('session_reminder_log').insert({
    session_id:   s.id,
    hours_before: 12,
    channel:      'whatsapp',
    sent_to:      groupId ?? s.student_phone,
    status:       result.success ? 'sent' : 'failed',
    error:        result.error ?? null,
  })

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
