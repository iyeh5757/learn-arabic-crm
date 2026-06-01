// app/(dashboard)/admin/students/page.tsx
import { createClient } from '@/lib/supabase/server'
import StudentsTable from '@/components/tables/StudentsTable'
import { UserPlus } from 'lucide-react'
import Link from 'next/link'

export default async function AdminStudentsPage({
  searchParams
}: { searchParams: { filter?: string; teacher?: string; status?: string; search?: string } }) {
  const supabase = createClient()
  let query = supabase
    .from('students_with_remaining')
    .select(`
      *, 
      assigned_teacher:teachers(
        id, rate_per_session_usd,
        profile:profiles!teachers_user_id_fkey(name, email)
      ),
      added_by_sales:profiles!students_added_by_sales_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  if (searchParams.filter === 'renewal') query = query.lte('remaining_classes', 2)
  if (searchParams.status)  query = query.eq('student_status', searchParams.status)
  if (searchParams.teacher) query = query.eq('assigned_teacher_id', searchParams.teacher)
  if (searchParams.search) {
    query = query.ilike('name', `%${searchParams.search}%`)
  }

  const { data: students } = await query
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, profile:profiles!teachers_user_id_fkey(name)')
    .eq('is_active', true)

  const hasFilters = !!(searchParams.status || searchParams.teacher || searchParams.search)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm">{students?.length ?? 0} students</p>
        </div>
        <Link href="/admin/students/new" className="btn-primary">
          <UserPlus size={16} /> Add Student
        </Link>
      </div>

      {/* Filters — server form, no JS needed */}
      <form method="GET" className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Status</label>
          <select name="status" className="input w-40" defaultValue={searchParams.status ?? ''}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="label">Teacher</label>
          <select name="teacher" className="input w-48" defaultValue={searchParams.teacher ?? ''}>
            <option value="">All Teachers</option>
            {teachers?.map((t: any) => (
              <option key={t.id} value={t.id}>{t.profile?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Search</label>
          <input
            name="search"
            type="text"
            className="input w-48"
            defaultValue={searchParams.search ?? ''}
            placeholder="Name…"
          />
        </div>
        <button type="submit" className="btn-primary">Apply</button>
        {hasFilters && (
          <Link href="/admin/students" className="btn-secondary">Clear</Link>
        )}
      </form>

      <StudentsTable students={students ?? []} role="admin" />
    </div>
  )
}
