// app/api/calendar/sessions/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/calendar/sessions?teacher_id=&start=&end=&status=
export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const teacherId = searchParams.get('teacher_id')
  const start     = searchParams.get('start')
  const end       = searchParams.get('end')
  const status    = searchParams.get('status')

  let query = supabase
    .from('calendar_sessions')
    .select(`
      id, title, start_at, end_at, duration_minutes, status,
      student_name, student_email, student_phone,
      google_meet_link, force_booked, recurring_rule_id,
      reminder_24h_sent, reminder_12h_sent, reminder_1h_sent,
      session_type:session_type_config(id, name, color),
      teacher:teachers(id, profile:profiles!teachers_user_id_fkey(name))
    `)
    .order('start_at')

  if (teacherId) query = query.eq('teacher_id', teacherId)
  if (start)     query = query.gte('start_at', start)
  if (end)       query = query.lte('start_at', end)
  if (status)    query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/calendar/sessions — create session
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    session_type_id, teacher_id, student_id, student_name,
    student_email, student_phone, start_at, end_at,
    duration_minutes, notes, sales_notes, supervisor_notes,
    recurring_rule_id, force_booked, force_booked_reason,
  } = body

  if (!teacher_id || !start_at || !end_at || !duration_minutes) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Conflict check (unless force booking)
  if (!force_booked) {
    const { data: conflicts } = await supabase
      .from('calendar_sessions')
      .select('id')
      .eq('teacher_id', teacher_id)
      .in('status', ['scheduled', 'rescheduled'])
      .lt('start_at', end_at)
      .gt('end_at', start_at)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ conflict: true, message: 'Teacher already has a conflicting session.' }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('calendar_sessions')
    .insert({
      session_type_id, teacher_id, student_id, student_name,
      student_email, student_phone, start_at, end_at,
      duration_minutes, notes, sales_notes, supervisor_notes,
      recurring_rule_id,
      force_booked: !!force_booked,
      force_booked_by:     force_booked ? user.id : null,
      force_booked_reason: force_booked_reason ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Audit log
  await supabase.from('calendar_audit_log').insert({
    event_id:     data.id,
    action:       'created',
    performed_by: user.id,
    new_data:     data,
    source:       'crm',
  })

  return NextResponse.json(data, { status: 201 })
}
