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
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const caller = await verifyAdmin()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (params.id === caller.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const id = params.id

  // Clean up all foreign key references before deleting
  // Nullify sales references on students
  await adminClient.from('students').update({ added_by_sales_id: null }).eq('added_by_sales_id', id)
  // Nullify confirmed_by on payments
  await adminClient.from('payments').update({ confirmed_by: null }).eq('confirmed_by', id)
  await adminClient.from('payments').update({ added_by: null }).eq('added_by', id)
  // Delete commissions for this user
  await adminClient.from('commissions').delete().eq('sales_user_id', id)
  // Delete sales_config for this user
  await adminClient.from('sales_config').delete().eq('sales_user_id', id)
  // If teacher: nullify assigned_teacher_id on students, delete sessions, delete teacher record
  const { data: teacher } = await adminClient.from('teachers').select('id').eq('user_id', id).single()
  if (teacher) {
    await adminClient.from('students').update({ assigned_teacher_id: null }).eq('assigned_teacher_id', teacher.id)
    await adminClient.from('sessions').delete().eq('teacher_id', teacher.id)
    await adminClient.from('teachers').delete().eq('id', teacher.id)
  }
  // If supervisor: nullify supervisor_id on teachers
  await adminClient.from('teachers').update({ supervisor_id: null }).eq('supervisor_id', id)
  // Delete the profile (will cascade from auth delete, but do it explicitly first)
  await adminClient.from('profiles').delete().eq('id', id)
  // Finally delete the auth user
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
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
