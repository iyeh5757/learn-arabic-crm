// app/(dashboard)/supervisor/analysis/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { computeAnalytics, fetchUsdRates } from '@/lib/analytics/supervisor'
import Filters from '../../admin/supervisor-analysis/Filters'
import MetricsTable from '../../admin/supervisor-analysis/MetricsTable'

export default async function SupervisorOwnAnalysisPage({ searchParams }: { searchParams?: { teacher?: string; month?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single()
  if (profile?.role !== 'supervisor') redirect('/dashboard')

  // This supervisor's teachers and their students/payments
  const { data: teacherRows } = await supabase
    .from('teachers').select('id, supervisor_id, profile:profiles!teachers_user_id_fkey(name)')
    .eq('supervisor_id', user.id)
  const teachers = (teacherRows ?? []).map((t: any) => ({ id: t.id, name: t.profile?.name ?? 'Unknown', supervisor_id: t.supervisor_id ?? user.id }))
  const teacherIds = teachers.map(t => t.id)

  const [{ data: students }, { data: payments }] = await Promise.all([
    teacherIds.length
      ? supabase.from('students').select('id, assigned_teacher_id, added_by_sales_id, student_status, payment_status, country, created_at').in('assigned_teacher_id', teacherIds)
      : Promise.resolve({ data: [] as any[] }),
    Promise.resolve({ data: [] as any[] }),
  ])

  // Payments for those students (separate query to respect any FK shapes)
  const studentIds = (students ?? []).map((s: any) => s.id)
  const { data: pay } = studentIds.length
    ? await supabase.from('payments').select('student_id, amount, currency, status, is_renewal, created_at').in('student_id', studentIds)
    : { data: [] as any[] }

  const months = Array.from(new Set([
    ...((pay ?? []) as any[]).map((p: any) => (p.created_at ?? '').slice(0, 7)),
    ...((students ?? []) as any[]).map((s: any) => (s.created_at ?? '').slice(0, 7)),
  ].filter(Boolean))).sort().reverse()

  const supervisors = [{ id: user.id, name: profile?.name ?? 'My team' }]
  const filters = { month: searchParams?.month || null, supervisorId: user.id, teacherId: searchParams?.teacher || null }

  const rates = await fetchUsdRates()
  const { supervisorRows, teacherRows: teacherMetrics } = computeAnalytics(
    { supervisors, teachers, students: (students ?? []) as any, payments: (pay ?? []) as any, sales: [] },
    filters, rates,
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0 }}>📊 My Team Analysis</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Conversion and renewal for your teachers.</p>
      </div>

      <Filters supervisors={supervisors} teachers={teachers} months={months} hideSupervisor />

      <MetricsTable title="🔍 My Team (total)" rows={supervisorRows} level="supervisor" variant="performance" />
      <MetricsTable title="👩‍🏫 By Teacher" rows={teacherMetrics} level="teacher" variant="performance" />

      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
        Active Students / Inactive = current counts. Trial conversion = students who have paid ÷ all students. Renewal rate = students who paid again after their first plan (2+ payments) ÷ students who have paid. Lifetime figures.
      </div>
    </div>
  )
}
