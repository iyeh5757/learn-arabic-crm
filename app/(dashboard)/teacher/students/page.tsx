// app/(dashboard)/teacher/students/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TeacherStudentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return <div style={{ padding: '24px', color: '#DC2626' }}>Teacher profile not found.</div>

  // Note: deliberately NOT selecting email or phone
  const { data: students } = await supabase
    .from('students')
    .select('id, name, country, student_status, total_paid_classes, consumed_classes, session_duration, currency, notes')
    .eq('assigned_teacher_id', teacher.id)
    .order('name')

  const statusColor: Record<string, { bg: string; text: string }> = {
    active:   { bg: '#ECFDF5', text: '#059669' },
    inactive: { bg: '#F3F4F6', text: '#6B7280' },
    trial:    { bg: '#EFF6FF', text: '#2563EB' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>My Students</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{students?.length ?? 0} students assigned to you</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Name', 'Country', 'Status', 'Currency', 'Duration', 'Classes', 'Remaining', 'Notes'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(students ?? []).length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No students assigned yet</td></tr>
              )}
              {(students ?? []).map(s => {
                const remaining = s.total_paid_classes - s.consumed_classes
                const sc = statusColor[s.student_status] ?? { bg: '#F3F4F6', text: '#374151' }
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{s.name}</td>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{s.country ?? '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: sc.bg, color: sc.text, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.student_status}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{s.currency}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{s.session_duration}min</td>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px', textAlign: 'center' }}>
                      {s.consumed_classes} / {s.total_paid_classes}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '15px', color: remaining <= 0 ? '#DC2626' : remaining <= 2 ? '#D97706' : '#059669' }}>
                        {remaining}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.notes ?? '—'}
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
