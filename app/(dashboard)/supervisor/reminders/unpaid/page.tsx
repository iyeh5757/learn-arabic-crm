// app/(dashboard)/supervisor/reminders/unpaid/page.tsx
// First-Payment Follow-ups for the supervisor's own team's students.
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { MarkInactiveButton } from '../../../admin/reminders/RetentionActions'

export default async function SupervisorUnpaidPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: myTeachers } = await supabase.from('teachers').select('id').eq('supervisor_id', user.id)
  const teacherIds = myTeachers?.map(t => t.id) ?? []
  const { data: myStudents } = await supabase.from('students').select('id').in('assigned_teacher_id', teacherIds)
  const studentIds = myStudents?.map(s => s.id) ?? []

  const { data: unpaid } = studentIds.length
    ? await supabase
        .from('students')
        .select('id, name, phone, email, country, student_status, created_at, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
        .in('id', studentIds)
        .neq('payment_status', 'paid')
        .neq('student_status', 'inactive')
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const trials = (unpaid ?? []).filter((s: any) => s.student_status === 'trial')
  const others = (unpaid ?? []).filter((s: any) => s.student_status !== 'trial')

  function Table({ rows }: { rows: any[] }) {
    if (rows.length === 0) return <div style={{ padding: '22px', color: '#9CA3AF', fontSize: '14px', textAlign: 'center' }}>None 🎉</div>
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Student', 'Added', 'Teacher', 'Phone', 'Country', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s: any) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '12px 14px' }}>
                  <p style={{ fontWeight: 600, color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
                  {s.email && <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0' }}>{s.email}</p>}
                </td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                  {s.created_at ? new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                </td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{(s.assigned_teacher as any)?.profile?.name ?? '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{s.phone ?? '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{s.country ?? '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link href={`/supervisor/students/${s.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>Edit</Link>
                    <Link href={`/supervisor/payments/new?student_id=${s.id}&student_name=${encodeURIComponent(s.name)}`} style={{ background: '#059669', color: '#fff', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>+ Pay</Link>
                    <MarkInactiveButton studentId={s.id} name={s.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>💳 First-Payment Follow-ups</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>Your team&apos;s customers who haven&apos;t made their first payment</p>
        </div>
        <Link href="/supervisor/reminders" style={{ background: '#F1F5F9', color: '#334155', padding: '9px 16px', borderRadius: '9px', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>← Back to Reminders</Link>
      </div>

      <div style={{ background: '#fff', border: '1px solid #FED7AA', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: '#FFF7ED', fontWeight: 700, fontSize: '15px', color: '#C2410C' }}>
          🎯 Trials — not converted yet ({trials.length})
        </div>
        <Table rows={trials} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #DDD6FE', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: '#F5F3FF', fontWeight: 700, fontSize: '15px', color: '#5B21B6' }}>
          💳 Active but payment pending ({others.length})
        </div>
        <Table rows={others} />
      </div>
    </div>
  )
}
