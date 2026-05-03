// app/(dashboard)/admin/students/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function StudentsPage() {
  const supabase = createClient()

  const { data: students } = await supabase
    .from('students')
    .select(`
      id, name, email, phone, country, currency,
      total_paid_classes, consumed_classes, payment_status,
      student_status, session_duration, reminder_date,
      assigned_teacher:teachers(id, profile:profiles!teachers_user_id_fkey(name)),
      added_by_sales:profiles!students_added_by_sales_id_fkey(name)
    `)
    .order('created_at', { ascending: false })

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, profile:profiles!teachers_user_id_fkey(name)')
    .eq('is_active', true)

  const statusColor: Record<string, string> = {
    active: '#ECFDF5',
    inactive: '#F3F4F6',
    trial: '#EFF6FF',
  }
  const statusText: Record<string, string> = {
    active: '#059669',
    inactive: '#6B7280',
    trial: '#2563EB',
  }
  const payColor: Record<string, string> = {
    paid: '#ECFDF5',
    pending: '#FFFBEB',
    declined: '#FEF2F2',
  }
  const payText: Record<string, string> = {
    paid: '#059669',
    pending: '#D97706',
    declined: '#DC2626',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Students</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{students?.length ?? 0} total</p>
        </div>
        <Link href="/admin/students/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Add Student
        </Link>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Name', 'Status', 'Teacher', 'Country', 'Currency', 'Classes', 'Remaining', 'Payment', 'Added By', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(students ?? []).length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No students yet. Add your first student!</td></tr>
              )}
              {(students ?? []).map((s: any) => {
                const remaining = s.total_paid_classes - s.consumed_classes
                const needsRenewal = remaining <= 2 && s.student_status !== 'inactive'
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6', background: needsRenewal ? '#FFFBEB' : 'transparent' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {needsRenewal && <span title="Needs renewal">⚠️</span>}
                        <div>
                          <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
                          {s.email && <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '2px 0 0 0' }}>{s.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: statusColor[s.student_status] || '#F3F4F6', color: statusText[s.student_status] || '#6B7280', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                        {s.student_status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{(s.assigned_teacher as any)?.profile?.name ?? '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{s.country ?? '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{s.currency}</span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#374151', fontSize: '13px' }}>{s.consumed_classes} / {s.total_paid_classes}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: remaining <= 0 ? '#DC2626' : remaining <= 2 ? '#D97706' : '#059669' }}>{remaining}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: payColor[s.payment_status] || '#F3F4F6', color: payText[s.payment_status] || '#374151', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                        {s.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#9CA3AF', fontSize: '12px' }}>{(s.added_by_sales as any)?.name ?? '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link href={`/admin/students/${s.id}`} style={{ background: '#F3F4F6', color: '#374151', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>View</Link>
                        <Link href={`/admin/students/${s.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>Edit</Link>
                      </div>
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
