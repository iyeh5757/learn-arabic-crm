// app/(dashboard)/teacher/sessions/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TeacherSessionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
  if (!teacher) redirect('/teacher')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, student:students(name)')
    .eq('teacher_id', teacher.id)
    .order('session_date', { ascending: false })

  const attColor: Record<string, { bg: string; text: string }> = {
    attended:  { bg: '#ECFDF5', text: '#059669' },
    'no-show': { bg: '#FEF2F2', text: '#DC2626' },
    cancelled: { bg: '#F3F4F6', text: '#6B7280' },
    scheduled: { bg: '#FFFBEB', text: '#D97706' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>My Sessions</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{sessions?.length ?? 0} total</p>
        </div>
        <Link href="/teacher/sessions/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Log Session
        </Link>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date', 'Student', 'Type', 'Duration', 'Attendance', 'Trial', 'Rating', 'HW', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No sessions logged yet</td></tr>
              )}
              {(sessions ?? []).map((s: any) => {
                const ac = attColor[s.attendance_status] || { bg: '#F3F4F6', text: '#374151' }
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{new Date(s.session_date).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{s.student?.name}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: s.session_type === 'trial' ? '#EFF6FF' : '#ECFDF5', color: s.session_type === 'trial' ? '#2563EB' : '#059669', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.session_type}</span></td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{s.duration}m</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: ac.bg, color: ac.text, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.attendance_status}</span></td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.trial_status ? <span style={{ background: s.trial_status === 'converted' ? '#ECFDF5' : s.trial_status === 'lost' ? '#FEF2F2' : '#FFFBEB', color: s.trial_status === 'converted' ? '#059669' : s.trial_status === 'lost' ? '#DC2626' : '#D97706', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.trial_status}</span> : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.student_rating ? '⭐'.repeat(s.student_rating) : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.homework ? '✅' : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/teacher/sessions/${s.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>Edit</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
