// app/(dashboard)/teacher/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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

  if (!teacher) return (
    <div style={{ textAlign: 'center', padding: '60px' }}>
      <p style={{ color: '#DC2626', fontSize: '16px' }}>Teacher profile not found. Please contact admin.</p>
    </div>
  )

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: myStudents },
    { data: allSessions },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from('students').select('id, name, student_status, total_paid_classes, consumed_classes, session_duration').eq('assigned_teacher_id', teacher.id).order('name'),
    supabase.from('sessions').select('id, attendance_status, session_type, duration, session_date, trial_status').eq('teacher_id', teacher.id),
    supabase.from('sessions').select('*, student:students(name)').eq('teacher_id', teacher.id).order('session_date', { ascending: false }).limit(8),
  ])

  const monthSessions = (allSessions ?? []).filter(s => s.session_date >= monthStart)
  const attendedPaid = monthSessions.filter(s => s.session_type === 'paid' && s.attendance_status === 'attended')
  const totalHours = attendedPaid.reduce((acc, s) => acc + (s.duration / 60), 0)
  const earningsUSD = attendedPaid.reduce((acc: number, s: any) => acc + Number(teacher.rate_per_session_usd) * ((s.duration ?? 60) / 60), 0)
  const trialsConverted = (allSessions ?? []).filter(s => s.trial_status === 'converted').length
  const trialsLost = (allSessions ?? []).filter(s => s.trial_status === 'lost').length
  const activeStudents = (myStudents ?? []).filter(s => s.student_status === 'active').length
  const inactiveStudents = (myStudents ?? []).filter(s => s.student_status === 'inactive').length

  const kpis = [
    { label: 'Active Students', value: activeStudents, color: '#059669', bg: '#ECFDF5' },
    { label: 'Inactive Students', value: inactiveStudents, color: '#6B7280', bg: '#F3F4F6' },
    { label: 'Hours This Month', value: `${totalHours.toFixed(1)}h`, color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Earnings (USD)', value: `$${earningsUSD.toFixed(2)}`, color: '#C9A84C', bg: '#FFFBEB' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>My Dashboard</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/teacher/sessions/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Log Session
        </Link>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Trial stats */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827' }}>Trial Outcomes</div>
          <div style={{ padding: '20px 22px', display: 'flex', gap: '32px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '32px', fontWeight: '700', color: '#059669', margin: 0 }}>{trialsConverted}</p>
              <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0 0' }}>Converted</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '32px', fontWeight: '700', color: '#DC2626', margin: 0 }}>{trialsLost}</p>
              <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0 0' }}>Lost</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '32px', fontWeight: '700', color: '#0D1B2A', margin: 0 }}>
                {trialsConverted + trialsLost > 0 ? Math.round((trialsConverted / (trialsConverted + trialsLost)) * 100) : 0}%
              </p>
              <p style={{ fontSize: '12px', color: '#6B7280', margin: '4px 0 0 0' }}>Conversion</p>
            </div>
          </div>
        </div>

        {/* My students */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>My Students</span>
            <Link href="/teacher/students" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '600' }}>View all →</Link>
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {(myStudents ?? []).slice(0, 8).map(s => {
              const rem = s.total_paid_classes - s.consumed_classes
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 22px', borderBottom: '1px solid #F9FAFB' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{s.name}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: rem <= 2 ? '#D97706' : '#059669' }}>{rem} left</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>Recent Sessions</span>
          <Link href="/teacher/sessions" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '600' }}>View all →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F9FAFB' }}>
              {['Student','Date','Type','Attendance','Duration','Rating'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(recentSessions ?? []).length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF' }}>No sessions yet</td></tr>
              )}
              {(recentSessions ?? []).map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{s.student?.name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '13px' }}>{new Date(s.session_date).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: s.session_type === 'trial' ? '#EFF6FF' : '#ECFDF5', color: s.session_type === 'trial' ? '#2563EB' : '#059669', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.session_type}</span></td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: s.attendance_status === 'attended' ? '#ECFDF5' : '#FEF2F2', color: s.attendance_status === 'attended' ? '#059669' : '#DC2626', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.attendance_status}</span></td>
                  <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '13px' }}>{s.duration}m</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.student_rating ? '⭐'.repeat(s.student_rating) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
