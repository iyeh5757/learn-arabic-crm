// app/(dashboard)/supervisor/reminders/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SupervisorRemindersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get teacher IDs under this supervisor
  const { data: myTeachers } = await supabase
    .from('teachers')
    .select('id')
    .eq('supervisor_id', user.id)

  const teacherIds = myTeachers?.map(t => t.id) ?? []

  // Get student IDs assigned to these teachers
  const { data: myStudents } = await supabase
    .from('students')
    .select('id')
    .in('assigned_teacher_id', teacherIds)

  const studentIds = myStudents?.map(s => s.id) ?? []

  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  // Fetch reminders data filtered to supervisor's students
  const [{ data: lowStudents }, { data: todayReminders }, { data: pendingPayments }] = await Promise.all([
    supabase.from('students_with_remaining')
      .select('id, name, phone, email, country, currency, total_paid_classes, consumed_classes, remaining_classes, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
      .in('id', studentIds)
      .neq('student_status', 'inactive')
      .order('remaining_classes', { ascending: true }),
    supabase.from('students')
      .select('id, name, phone, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
      .in('id', studentIds)
      .eq('reminder_date', today),
    supabase.from('students')
      .select('id, name, phone, email, currency, student_status, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
      .in('id', studentIds)
      .eq('payment_status', 'pending')
      .neq('student_status', 'inactive')
      .order('created_at', { ascending: false }),
  ])

  const outOfClasses = (lowStudents ?? []).filter(s => (s.remaining_classes ?? 0) <= 0)
  const oneLast      = (lowStudents ?? []).filter(s => s.remaining_classes === 1)
  const twoLeft      = (lowStudents ?? []).filter(s => s.remaining_classes === 2)

  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }
  const hdrStyle  = (color: string) => ({ padding: '14px 20px', background: color, display: 'flex', alignItems: 'center', justifyContent: 'space-between' })
  const cell      = { padding: '13px 16px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }

  function StudentTable({ students, cols }: { students: any[]; cols: string[] }) {
    if (!students.length) return <p style={{ padding: '20px', color: '#9CA3AF', textAlign: 'center' as const }}>None</p>
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {cols.map(h => <th key={h} style={{ ...cell, fontWeight: '600', color: '#6B7280', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {students.map((s: any) => (
              <tr key={s.id}>
                <td style={{ ...cell, fontWeight: '600', color: '#111827' }}>{s.name}</td>
                <td style={cell}>{s.phone ?? '—'}</td>
                <td style={cell}>{(s.assigned_teacher as any)?.profile?.name ?? '—'}</td>
                {cols.includes('Remaining') && <td style={{ ...cell, fontWeight: '700', color: (s.remaining_classes ?? 0) <= 0 ? '#DC2626' : '#D97706' }}>{s.remaining_classes ?? 0}</td>}
                {cols.includes('Status') && <td style={cell}>{s.student_status}</td>}
                {cols.includes('Currency') && <td style={cell}>{s.currency}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Reminders</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>Students assigned to your teachers</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Pending Payment', value: (pendingPayments ?? []).length, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Out of Classes',  value: outOfClasses.length,            color: '#DC2626', bg: '#FEF2F2' },
          { label: '1 Class Left',    value: oneLast.length,                 color: '#EA580C', bg: '#FFF7ED' },
          { label: '2 Classes Left',  value: twoLeft.length,                 color: '#D97706', bg: '#FFFBEB' },
          { label: "Today's Reminders", value: (todayReminders ?? []).length, color: '#2563EB', bg: '#EFF6FF' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: s.color, marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending Payments */}
      {(pendingPayments ?? []).length > 0 && (
        <div style={cardStyle}>
          <div style={hdrStyle('#7C3AED')}>
            <span style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>💳 Pending Payments ({(pendingPayments ?? []).length})</span>
          </div>
          <StudentTable students={pendingPayments ?? []} cols={['Student', 'Phone', 'Teacher', 'Status', 'Currency']} />
        </div>
      )}

      {/* Out of classes */}
      {outOfClasses.length > 0 && (
        <div style={cardStyle}>
          <div style={hdrStyle('#FEF2F2')}>
            <span style={{ color: '#DC2626', fontWeight: '700', fontSize: '15px' }}>🚨 Out of Classes ({outOfClasses.length})</span>
          </div>
          <StudentTable students={outOfClasses} cols={['Student', 'Phone', 'Teacher', 'Remaining']} />
        </div>
      )}

      {/* 1 class left */}
      {oneLast.length > 0 && (
        <div style={cardStyle}>
          <div style={hdrStyle('#FFF7ED')}>
            <span style={{ color: '#EA580C', fontWeight: '700', fontSize: '15px' }}>⚠️ 1 Class Left ({oneLast.length})</span>
          </div>
          <StudentTable students={oneLast} cols={['Student', 'Phone', 'Teacher', 'Remaining']} />
        </div>
      )}

      {/* 2 classes left */}
      {twoLeft.length > 0 && (
        <div style={cardStyle}>
          <div style={hdrStyle('#FFFBEB')}>
            <span style={{ color: '#D97706', fontWeight: '700', fontSize: '15px' }}>📢 2 Classes Left ({twoLeft.length})</span>
          </div>
          <StudentTable students={twoLeft} cols={['Student', 'Phone', 'Teacher', 'Remaining']} />
        </div>
      )}

      {/* Today's reminders */}
      {(todayReminders ?? []).length > 0 && (
        <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontWeight: '600', color: '#1E40AF', margin: '0 0 10px' }}>📅 Today's Reminders ({(todayReminders ?? []).length})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(todayReminders ?? []).map((s: any) => (
              <span key={s.id} style={{ background: '#fff', border: '1px solid #93C5FD', borderRadius: '8px', padding: '4px 12px', fontSize: '13px', color: '#1E40AF', fontWeight: '600' }}>
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
