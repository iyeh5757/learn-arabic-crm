// app/api/calendar/sessions/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createCalendarEventWithMeet, createMeetSpace, addMeetCoHosts, createCalendarEventWithLink, isGoogleConfigured } from '@/lib/calendar/google'
import { remindSessionIfDue } from '@/lib/calendar/reminders'

export const runtime = 'nodejs'

// GET /api/calendar/sessions?teacher_id=&supervisor_id=&start=&end=&status=
export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const teacherId    = searchParams.get('teacher_id')
  const supervisorId = searchParams.get('supervisor_id')
  const start        = searchParams.get('start')
  const end          = searchParams.get('end')
  const status       = searchParams.get('status')
  const mine         = searchParams.get('mine')   // only sessions I created

  let myId: string | null = null
  if (mine) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json([])
    myId = user.id
  }

  // Supervisor filter → expand to all teachers assigned to that supervisor
  let teacherIdsForSupervisor: string[] | null = null
  if (supervisorId) {
    const { data: ts } = await supabase.from('teachers').select('id').eq('supervisor_id', supervisorId)
    teacherIdsForSupervisor = (ts ?? []).map((t: any) => t.id)
    if (teacherIdsForSupervisor.length === 0) return NextResponse.json([])
  }

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

  if (teacherId)               query = query.eq('teacher_id', teacherId)
  if (teacherIdsForSupervisor) query = query.in('teacher_id', teacherIdsForSupervisor)
  if (myId)                    query = query.eq('created_by', myId)
  if (start)                   query = query.gte('start_at', start)
  if (end)                     query = query.lte('start_at', end)
  if (status)                  query = query.eq('status', status)

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
    open_access, auto_record, cohost_emails,
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

  // Generate a Google Calendar event + Meet link (non-fatal if Google isn't set up)
  let googleEventId: string | null = null
  let googleMeetLink: string | null = null
  const meetDiag: any = {}
  if (isGoogleConfigured()) {
    try {
      // Look up teacher email + session type name for a nicer invite
      const [{ data: teacherRow }, { data: typeRow }] = await Promise.all([
        supabase.from('teachers').select('profile:profiles!teachers_user_id_fkey(name, email)').eq('id', teacher_id).single(),
        session_type_id ? supabase.from('session_type_config').select('name').eq('id', session_type_id).single() : Promise.resolve({ data: null }),
      ])
      const teacherEmail = (teacherRow as any)?.profile?.email ?? ''
      const teacherName  = (teacherRow as any)?.profile?.name ?? 'Teacher'
      const typeName     = (typeRow as any)?.name ?? 'Arabic'
      const eventInput = {
        summary:     `${typeName} — ${student_name ?? 'Student'} with ${teacherName}`,
        description: notes ?? '',
        startIso:    start_at,
        endIso:      end_at,
        timezone:    'Africa/Cairo',
        attendees:   [student_email, teacherEmail].filter(Boolean),
      }

      // Create the Meet through the Meet API so we control its settings,
      // then attach it to a calendar invite. Fall back to a normal Calendar
      // Meet if the Meet API isn't available.
      let madeViaMeetApi = false
      try {
        const space = await createMeetSpace({ openAccess: !!open_access, autoRecord: !!auto_record })
        if (space?.meetUri) {
          // Co-hosts (best-effort)
          const cohosts: string[] = Array.isArray(cohost_emails)
            ? cohost_emails.map((e: any) => String(e).trim()).filter(Boolean)
            : []
          if (cohosts.length) {
            const r = await addMeetCoHosts(space.spaceName, cohosts)
            meetDiag.cohosts = r
            console.log('[Meet] co-hosts:', r)
          }
          const ev = await createCalendarEventWithLink(eventInput, space.meetUri)
          if (ev) { googleEventId = ev.eventId; googleMeetLink = space.meetUri; madeViaMeetApi = true }
          meetDiag.openAccess = !!open_access
          meetDiag.autoRecord = space.recordingApplied
          console.log('[Meet] space created:', { openAccess: !!open_access, autoRecord: space.recordingApplied })
        }
      } catch (e: any) {
        meetDiag.spaceError = e?.message
        console.error('[Meet] space flow failed, falling back to Calendar Meet:', e?.message)
      }

      if (!madeViaMeetApi) {
        const ev = await createCalendarEventWithMeet(eventInput)
        if (ev) { googleEventId = ev.eventId; googleMeetLink = ev.meetLink }
      }
    } catch (e: any) {
      console.error('[Calendar] Google event creation failed:', e?.message)
      // continue without Meet link
    }
  }

  const { data, error } = await supabase
    .from('calendar_sessions')
    .insert({
      session_type_id, teacher_id, student_id, student_name,
      student_email, student_phone, start_at, end_at,
      duration_minutes, notes, sales_notes, supervisor_notes,
      recurring_rule_id,
      google_event_id:  googleEventId,
      google_meet_link: googleMeetLink,
      google_synced_at: googleEventId ? new Date().toISOString() : null,
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

  // If booked within a reminder window (e.g. less than an hour out), fire it now
  await remindSessionIfDue(supabase, data.id)

  return NextResponse.json({ ...data, _meet: meetDiag }, { status: 201 })
}
