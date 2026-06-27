// app/(dashboard)/admin/supervisor-analysis/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { computeAnalytics, fetchUsdRates } from '@/lib/analytics/supervisor'
import Filters from './Filters'
import MetricsTable from './MetricsTable'
import Charts from './Charts'

export default async function SupervisorAnalysisPage({ searchParams }: { searchParams?: { supervisor?: string; teacher?: string; month?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [
    { data: supRows }, { data: teacherRows }, { data: students }, { data: payments }, { data: salesRows },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('role', 'supervisor').order('name'),
    supabase.from('teachers').select('id, supervisor_id, profile:profiles!teachers_user_id_fkey(name)').order('id'),
    supabase.from('students').select('id, assigned_teacher_id, added_by_sales_id, student_status, payment_status, country, created_at'),
    supabase.from('payments').select('student_id, amount, currency, status, is_renewal, created_at'),
    supabase.from('profiles').select('id, name').eq('role', 'sales').order('name'),
  ])

  const supervisors = (supRows ?? []).map((s: any) => ({ id: s.id, name: s.name }))
  const teachers = (teacherRows ?? []).map((t: any) => ({ id: t.id, name: t.profile?.name ?? 'Unknown', supervisor_id: t.supervisor_id ?? null }))
  const sales = (salesRows ?? []).map((s: any) => ({ id: s.id, name: s.name }))

  // Available months from payments + students
  const months = Array.from(new Set([
    ...(payments ?? []).map((p: any) => (p.created_at ?? '').slice(0, 7)),
    ...(students ?? []).map((s: any) => (s.created_at ?? '').slice(0, 7)),
  ].filter(Boolean))).sort().reverse()

  const filters = {
    month: searchParams?.month || null,
    supervisorId: searchParams?.supervisor || null,
    teacherId: searchParams?.teacher || null,
  }

  const rates = await fetchUsdRates()
  const { supervisorRows, teacherRows: teacherMetrics, byCountry, bySales } = computeAnalytics(
    { supervisors, teachers, students: (students ?? []) as any, payments: (payments ?? []) as any, sales },
    filters, rates,
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: 0 }}>📊 Supervisor & Team Analysis</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>
          Conversion, renewal and revenue by supervisor and teacher. Money shown in USD (live rates).
        </p>
      </div>

      <Filters supervisors={supervisors} teachers={teachers} months={months} />

      <MetricsTable title="🔍 By Supervisor" rows={supervisorRows} level="supervisor" variant="performance" />
      <MetricsTable title="👩‍🏫 By Teacher" rows={teacherMetrics} level="teacher" variant="performance" />

      <MetricsTable title="💰 Revenue by Supervisor's Team" rows={supervisorRows} level="supervisor" variant="money" />
      <MetricsTable title="💵 Revenue by Teacher" rows={teacherMetrics} level="teacher" variant="money" />

      <Charts byCountry={byCountry} bySales={bySales} />

      <div style={{ fontSize: '11px', color: '#94A3B8' }}>
        Active Students / Inactive = current counts in the team. Trial conversion = students who have paid ÷ all students (a trial is "lost" unless that student paid).
        Renewal rate = students who paid again after their first plan (2+ payments) ÷ students who have paid. These are lifetime figures; the month filter scopes revenue only. Currency in USD at live rates.
      </div>
    </div>
  )
}
