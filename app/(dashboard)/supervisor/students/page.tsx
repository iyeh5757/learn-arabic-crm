// app/(dashboard)/supervisor/students/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudentsTable from '@/components/tables/StudentsTable'
import Link from 'next/link'

export default async function SupervisorStudentsPage({
  searchParams,
}: { searchParams: { teacher?: string; status?: string; search?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'supervisor') redirect('/dashboard')

  // Only this supervisor's own teachers
  const { data: teacherRows } = await supabase
    .from('teachers')
    .select('id, profile:profiles!teachers_user_id_fkey(name)')
    .eq('supervisor_id', user.id)
    .eq('is_active', true)
  const teachers = teacherRows ?? []
  const teacherIds = teachers.map((t: any) => t.id)

  if (teacherIds.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <div className="card p-4 text-sm text-red-700 bg-red-50 border border-red-200">
          No teachers are assigned to you yet. Ask an admin to assign teachers to your account.
        </div>
      </div>
    )
  }

  // Students belonging to this supervisor's teachers only
  let query = supabase
    .from('students_with_remaining')
    .select(`
      *,
      assigned_teacher:teachers(id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name, email)),
      added_by_sales:profiles!students_added_by_sales_id_fkey(name)
    `)
    .in('assigned_teacher_id', teacherIds)
    .order('created_at', { ascending: false })

  if (searchParams.status) query = query.eq('student_status', searchParams.status)
  if (searchParams.teacher && teacherIds.includes(searchParams.teacher)) query = query.eq('assigned_teacher_id', searchParams.teacher)

  const { data: rawStudents } = await query
  const search = searchParams.search?.toLowerCase().trim() ?? ''
  const students = search
    ? (rawStudents ?? []).filter(s => s.name?.toLowerCase().includes(search) || s.email?.toLowerCase().includes(search) || s.phone?.includes(search))
    : (rawStudents ?? [])

  const hasFilters = !!(searchParams.status || searchParams.teacher || searchParams.search)
  const selectedStatus = searchParams.status ?? ''
  const selectedTeacher = searchParams.teacher ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Team&apos;s Students</h1>
          <p className="text-gray-500 text-sm">{students.length} students across your {teachers.length} teacher{teachers.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}</p>
        </div>
      </div>

      <form method="GET" className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Status</label>
          <select name="status" className="input w-40" defaultValue={selectedStatus}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="label">Teacher</label>
          <select name="teacher" className="input w-48" defaultValue={selectedTeacher}>
            <option value="">All my teachers</option>
            {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.profile?.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Search</label>
          <input name="search" type="text" className="input w-48" defaultValue={searchParams.search ?? ''} placeholder="Name, email, phone…" />
        </div>
        <button type="submit" className="btn-primary">Apply</button>
        {hasFilters && <Link href="/supervisor/students" className="btn-secondary">Clear</Link>}
      </form>

      <StudentsTable students={students} role="supervisor" />
    </div>
  )
}
