// app/(dashboard)/supervisor/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SupervisorDashboard() {
  const supabase = createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: teachers },
    { data: trialSessions },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from('teachers').select('id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name, email), students:students(id, student_status)').eq('is_active', true),
    supabase.from('sessions').select('*, student:students(name), teacher:teachers(profile:profiles!teachers_user_id_fkey(name))').eq('session_type', 'trial').order('session_date', { ascending: false }).limit(30),
    supabase.from('sessions').select('*, student:students(name), teacher:teachers(profile:profiles!teachers_user_id_fkey(name))').order('session_date', { ascending: false }).limit(20),
  ])

  const pendingTrials = (trialSessions ?? []).filter(s => s.trial_status === 'pending' || !s.trial_status)
  const convertedTrials = (trialSessions ?? []).filter(s => s.trial_status === 'converted')
  const lostTrials = (trialSessions ?? []).filter(s => s.trial_status === 'lost')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Supervisor Dashboard</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Trial Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Pending Trials', value: pendingTrials.length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Converted', value: convertedTrials.length, color: '#059669', bg: '#ECFDF5' },
          { label: 'Lost', value: lostTrials.length, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Total Teachers', value: teachers?.length ?? 0, color: '#2563EB', bg: '#EFF6FF' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Teachers overview */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827' }}>Teachers Overview</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F9FAFB' }}>
              {['Teacher', 'Active Students', 'Trial Students', 'Rate/Session'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(teachers ?? []).map((t: any) => {
                const active = (t.students ?? []).filter((s: any) => s.student_status === 'active').length
                const trial = (t.students ?? []).filter((s: any) => s.student_status === 'trial').length
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{t.profile?.name}</td>
                    <td style={{ padding: '12px 16px', color: '#059669', fontWeight: '700' }}>{active}</td>
                    <td style={{ padding: '12px 16px', color: '#2563EB', fontWeight: '700' }}>{trial}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>${Number(t.rate_per_session_usd).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Trials — needs action */}
      {pendingTrials.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #FEF3C7', fontWeight: '600', fontSize: '15px', color: '#92400E', background: '#FFFBEB' }}>
            ⏳ Trials Awaiting Your Decision ({pendingTrials.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#FFFBEB' }}>
                {['Student', 'Teacher', 'Date', 'Mark Outcome'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#92400E', textTransform: 'uppercase', borderBottom: '1px solid #FEF3C7' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {pendingTrials.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #FEF9C3' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{s.student?.name}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{s.teacher?.profile?.name}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{new Date(s.session_date).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href={`/supervisor/sessions/${s.id}/convert`} style={{ background: '#059669', color: '#fff', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>✅ Converted</Link>
                        <Link href={`/supervisor/sessions/${s.id}/lost`} style={{ background: '#DC2626', color: '#fff', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>❌ Lost</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>Recent Sessions</span>
          <Link href="/supervisor/sessions" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '600' }}>View all →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#F9FAFB' }}>
              {['Student','Teacher','Date','Type','Attendance','Trial Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(recentSessions ?? []).map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{s.student?.name}</td>
                  <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{s.teacher?.profile?.name}</td>
                  <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '13px' }}>{new Date(s.session_date).toLocaleDateString('en-GB')}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: s.session_type === 'trial' ? '#EFF6FF' : '#ECFDF5', color: s.session_type === 'trial' ? '#2563EB' : '#059669', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.session_type}</span></td>
                  <td style={{ padding: '12px 16px' }}><span style={{ background: s.attendance_status === 'attended' ? '#ECFDF5' : '#FEF2F2', color: s.attendance_status === 'attended' ? '#059669' : '#DC2626', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.attendance_status}</span></td>
                  <td style={{ padding: '12px 16px' }}>
                    {s.trial_status ? <span style={{ background: s.trial_status === 'converted' ? '#ECFDF5' : s.trial_status === 'lost' ? '#FEF2F2' : '#FFFBEB', color: s.trial_status === 'converted' ? '#059669' : s.trial_status === 'lost' ? '#DC2626' : '#D97706', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.trial_status}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
