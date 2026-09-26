// app/api/users/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const adminClient = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verify caller is admin
async function verifyAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user : null
}

// DELETE /api/users/[id] — delete a user
//
// Every foreign key that points at profiles(id) or teachers(id) must be cleared
// first, in the right order, or Supabase Auth fails with the opaque
// "Database error deleting user". The two that previously blocked it were
// calendar_sessions.teacher_id (ON DELETE RESTRICT) and the several
// created_by / updated_by audit columns (ON DELETE NO ACTION).
//
// Errors are surfaced rather than swallowed, so a failure names the table.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (params.id === caller.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const id = params.id
  const step = async (label: string, q: any) => {
    const { error } = await q
    if (error) throw new Error(`${label}: ${error.message}`)
  }

  try {
    const { data: teacher } = await adminClient.from('teachers').select('id').eq('user_id', id).maybeSingle()

    // Refuse while the teacher still has upcoming classes — deleting them would
    // silently remove real bookings from students' calendars.
    if (teacher) {
      const { data: upcoming } = await adminClient
        .from('calendar_sessions')
        .select('id, start_at, student_name')
        .eq('teacher_id', teacher.id)
        .neq('status', 'cancelled')
        .gt('start_at', new Date().toISOString())
        .order('start_at')
      if (upcoming && upcoming.length > 0) {
        const when = new Date(upcoming[0].start_at).toLocaleString('en-GB')
        return NextResponse.json({
          error: `This teacher has ${upcoming.length} upcoming class${upcoming.length === 1 ? '' : 'es'} `
               + `(next: ${upcoming[0].student_name ?? 'student'} on ${when}). `
               + `Reassign or cancel them first, then delete the account.`,
        }, { status: 409 })
      }
    }

    // ── Audit / authorship columns (ON DELETE NO ACTION) — null them, keeping the records
    await step('calendar_sessions.created_by',      adminClient.from('calendar_sessions').update({ created_by: null }).eq('created_by', id))
    await step('calendar_sessions.updated_by',      adminClient.from('calendar_sessions').update({ updated_by: null }).eq('updated_by', id))
    await step('calendar_sessions.force_booked_by', adminClient.from('calendar_sessions').update({ force_booked_by: null }).eq('force_booked_by', id))
    await step('calendar_blocks.created_by',        adminClient.from('calendar_blocks').update({ created_by: null }).eq('created_by', id))
    await step('recurring_rules.created_by',        adminClient.from('recurring_rules').update({ created_by: null }).eq('created_by', id))
    await step('student_followups.created_by',      adminClient.from('student_followups').update({ created_by: null }).eq('created_by', id))
    await step('calendar_audit_log.performed_by',   adminClient.from('calendar_audit_log').update({ performed_by: null }).eq('performed_by', id))

    // ── Sales / finance references
    await step('students.added_by_sales_id', adminClient.from('students').update({ added_by_sales_id: null }).eq('added_by_sales_id', id))
    await step('payments.confirmed_by',      adminClient.from('payments').update({ confirmed_by: null }).eq('confirmed_by', id))
    await step('payments.added_by',          adminClient.from('payments').update({ added_by: null }).eq('added_by', id))
    await step('commissions',                adminClient.from('commissions').delete().eq('sales_user_id', id))
    await step('sales_config',               adminClient.from('sales_config').delete().eq('sales_user_id', id))

    // ── Teacher record: clear what RESTRICTs, then let the rest cascade
    if (teacher) {
      await step('students.assigned_teacher_id', adminClient.from('students').update({ assigned_teacher_id: null }).eq('assigned_teacher_id', teacher.id))
      await step('sessions',                     adminClient.from('sessions').delete().eq('teacher_id', teacher.id))
      // RESTRICT — must go before the teacher row (past bookings only, guarded above)
      await step('calendar_sessions',            adminClient.from('calendar_sessions').delete().eq('teacher_id', teacher.id))
      // calendar_blocks, recurring_rules and teacher_availability cascade automatically
      await step('teachers',                     adminClient.from('teachers').delete().eq('id', teacher.id))
    }

    // ── Supervisor links held on other teachers
    await step('teachers.supervisor_id', adminClient.from('teachers').update({ supervisor_id: null }).eq('supervisor_id', id))

    // ── Finally the profile, then the auth user
    await step('profiles', adminClient.from('profiles').delete().eq('id', id))

    const { error } = await adminClient.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: `Auth delete failed: ${error.message}` }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    // Names the table that blocked, instead of a generic database error
    return NextResponse.json({ error: `Could not delete user — ${e?.message ?? 'unknown error'}` }, { status: 500 })
  }
}

// PATCH /api/users/[id] — set password directly (no email)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { password } = await req.json()
  if (!password || password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  const { error } = await adminClient.auth.admin.updateUserById(params.id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
