// app/(dashboard)/teacher/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/dashboard/StatCard'
import { BookOpen, Users, DollarSign, TrendingUp, PlusCircle } from 'lucide-react'
import Link from 'next/link'

export default async function TeacherDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, rate_per_session_usd')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return <div className="p-6 text-red-600">Teacher profile not found. Please contact admin.</div>

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: myStudents },
    { data: sessionsThisMonth },
    { data: trialSessions },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from('students').select('id, name, student_status, total_paid_classes, consumed_classes, session_duration')
      .eq('assigned_teacher_id', teacher.id),
    supabase.from('sessions').select('id, attendance_status, session_type, duration')
      .eq('teacher_id', teacher.id).gte('session_date', monthStart),
    supabase.from('sessions').select('id, trial_status, student_id, session_date')
      .eq('teacher_id', teacher.id).eq('session_type', 'trial').not('trial_status', 'is', null),
    supabase.from('sessions')
      .select('*, student:students(name)')
      .eq('teacher_id', teacher.id)
      .order('session_date', { ascending: false })
      .limit(10),
  ])

  const activeStudents = myStudents?.filter(s => s.student_status === 'active').length ?? 0
  const inactiveStudents = myStudents?.filter(s => s.student_status === 'inactive').length ?? 0
  const attendedSessions = sessionsThisMonth?.filter(s => s.session_type === 'paid' && s.attendance_status === 'attended') ?? []
  const totalHours = attendedSessions.reduce((acc, s) => acc + (s.duration / 60), 0)
  const earningsUSD = attendedSessions.length * Number(teacher.rate_per_session_usd)
  const trialsConverted = trialSessions?.filter(s => s.trial_status === 'converted').length ?? 0
  const trialsLost = trialSessions?.filter(s => s.trial_status === 'lost').length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-500 text-sm">{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/teacher/sessions/new" className="btn-primary">
          <PlusCircle size={16} /> Log Session
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Students" value={activeStudents} icon={Users} color="green" />
        <StatCard label="Inactive Students" value={inactiveStudents} icon={Users} color="red" />
        <StatCard label="Hours This Month" value={`${totalHours.toFixed(1)}h`} icon={BookOpen} color="blue" />
        <StatCard label="Earnings (USD)" value={`$${earningsUSD.toFixed(2)}`} icon={DollarSign} color="gold" />
      </div>

      {/* Trial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Trial Outcomes</h3></div>
          <div className="card-body flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{trialsConverted}</p>
              <p className="text-xs text-gray-500 mt-1">Converted</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-500">{trialsLost}</p>
              <p className="text-xs text-gray-500 mt-1">Lost</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-700">
                {trialsConverted + trialsLost > 0
                  ? Math.round((trialsConverted / (trialsConverted + trialsLost)) * 100)
                  : 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Conversion Rate</p>
            </div>
          </div>
        </div>

        {/* My Students */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">My Students</h3>
            <Link href="/teacher/students" className="text-xs text-[#C9A84C] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
            {myStudents?.slice(0,6).map(s => {
              const remaining = s.total_paid_classes - s.consumed_classes
              return (
                <div key={s.id} className="flex items-center justify-between px-6 py-2.5">
                  <span className="text-sm font-medium text-gray-800">{s.name}</span>
                  <span className={`text-xs font-bold ${remaining <= 2 ? 'text-amber-600' : 'text-green-600'}`}>
                    {remaining} left
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold">Recent Sessions</h3>
          <Link href="/teacher/sessions" className="text-xs text-[#C9A84C] hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Student</th>
                <th className="table-header">Date</th>
                <th className="table-header">Type</th>
                <th className="table-header">Attendance</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentSessions?.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{s.student?.name ?? '—'}</td>
                  <td className="table-cell text-gray-600">{new Date(s.session_date).toLocaleDateString('en-GB')}</td>
                  <td className="table-cell">
                    <span className={`badge ${s.session_type === 'trial' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {s.session_type}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${s.attendance_status === 'attended' ? 'bg-green-100 text-green-700' : s.attendance_status === 'no-show' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.attendance_status}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600">{s.duration}m</td>
                  <td className="table-cell">{'⭐'.repeat(s.student_rating ?? 0) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
