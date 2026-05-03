// app/(dashboard)/admin/sessions/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SessionsPage() {
  const supabase = createClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, session_date, session_time, duration, session_type,
      attendance_status, homework, student_rating, trial_status, feedback,
      teacher:teachers(id, profile:profiles!teachers_user_id_fkey(name)),
      student:students(id, name)
    `)
    .order('session_date', { ascending: false })
    .limit(100)

  const typeColor: Record<string, { bg: string; text: string }> = {
    paid:  { bg: '#ECFDF5', text: '#059669' },
    trial: { bg: '#EFF6FF', text: '#2563EB' },
  }
  const attColor: Record<string, { bg: string; text: string }> = {
    attended:  { bg: '#ECFDF5', text: '#059669' },
    'no-show': { bg: '#FEF2F2', text: '#DC2626' },
    cancelled: { bg: '#F3F4F6', text: '#6B7280' },
    scheduled: { bg: '#FFFBEB', text: '#D97706' },
  }
  const trialColor: Record<string, { bg: string; text: string }> = {
    converted: { bg: '#ECFDF5', text: '#059669' },
    lost:      { bg: '#FEF2F2', text: '#DC2626' },
    pending:   { bg: '#FFFBEB', text: '#D97706' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Sessions</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{sessions?.length ?? 0} total</p>
        </div>
        <Link href="/admin/sessions/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Log Session
        </Link>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date', 'Student', 'Teacher', 'Type', 'Duration', 'Attendance', 'Trial Status', 'Rating', 'HW', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No sessions yet. Log your first session!</td></tr>
              )}
              {(sessions ?? []).map((s: any) => {
                const tc = typeColor[s.session_type] || { bg: '#F3F4F6', text: '#374151' }
                const ac = attColor[s.attendance_status] || { bg: '#F3F4F6', text: '#374151' }
                const trc = s.trial_status ? (trialColor[s.trial_status] || { bg: '#F3F4F6', text: '#374151' }) : null
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(s.session_date).toLocaleDateString('en-GB')}
                      {s.session_time && <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.session_time.slice(0,5)}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{s.student?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{s.teacher?.profile?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: tc.bg, color: tc.text, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{s.session_type}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{s.duration}m</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: ac.bg, color: ac.text, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{s.attendance_status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {trc ? <span style={{ background: trc.bg, color: trc.text, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{s.trial_status}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.student_rating ? '⭐'.repeat(s.student_rating) : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.homework ? '✅' : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/sessions/${s.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>Edit</Link>
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
