// app/api/leads/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const adminClient = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH — update lead (status, stage, assigned_to, etc.)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { error } = await adminClient.from('leads').update(body).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// POST — add a contact log entry
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.type === 'convert_trial') {
    // Convert lead to trial: create student + session + update lead
    const { teacher_id, trial_date, trial_time, session_duration, currency, notes } = body

    const { data: lead } = await adminClient.from('leads').select('*').eq('id', params.id).single()
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    // Create student
    const { data: student, error: sErr } = await adminClient.from('students').insert({
      name:               lead.name,
      email:              lead.email,
      phone:              lead.phone,
      country:            lead.country,
      currency:           currency || 'USD',
      session_duration:   session_duration || 60,
      assigned_teacher_id: teacher_id || null,
      added_by_sales_id:  user.id,
      student_status:     'trial',
      payment_status:     'pending',
      notes:              notes || null,
      total_paid_classes: 0,
      consumed_classes:   0,
    }).select().single()
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 })

    // Create trial session
    if (teacher_id && trial_date) {
      await adminClient.from('sessions').insert({
        teacher_id,
        student_id:        student.id,
        session_date:      trial_date,
        session_time:      trial_time || null,
        duration:          session_duration || 60,
        session_type:      'trial',
        attendance_status: 'scheduled',
        trial_status:      'pending',
      })
    }

    // Update lead
    await adminClient.from('leads').update({
      status:     'trial_scheduled',
      student_id: student.id,
    }).eq('id', params.id)

    return NextResponse.json({ success: true, student_id: student.id })
  }

  // Regular contact log
  const { attempt_number, call_1, call_2, whatsapp_sent, note, new_status, new_stage } = body

  await adminClient.from('lead_contact_logs').insert({
    lead_id:        params.id,
    attempt_number,
    call_1:         call_1 || 'not_done',
    call_2:         call_2 || 'not_done',
    whatsapp_sent:  whatsapp_sent || false,
    note:           note || null,
    agent_id:       user.id,
  })

  const update: any = {}
  if (new_status) update.status = new_status
  if (new_stage !== undefined) update.pipeline_stage = new_stage
  if (new_status === 'cold') update.cold_since = new Date().toISOString().split('T')[0]
  if (Object.keys(update).length) {
    await adminClient.from('leads').update(update).eq('id', params.id)
  }

  return NextResponse.json({ success: true })
}
