// app/(dashboard)/accountant/students/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AccountantStudentsPage() {
  const supabase = createClient()

  const { data: students } = await supabase
    .from('students')
    .select('id, name, email, phone, country, currency, total_paid_classes, consumed_classes, student_status, payment_status, payment_method, reminder_date, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
    .order('name')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>All Students</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{students?.length ?? 0} students</p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Name', 'Status', 'Teacher', 'Currency', 'Classes', 'Remaining', 'Payment', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(students ?? []).map((s: any) => {
                const rem = s.total_paid_classes - s.consumed_classes
                const needsRenewal = rem <= 2 && s.student_status !== 'inactive'
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6', background: needsRenewal ? '#FFFBEB' : 'transparent' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {needsRenewal && <span>⚠️</span>}
                        <div>
                          <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
                          {s.phone && <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{s.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: s.student_status === 'active' ? '#ECFDF5' : s.student_status === 'trial' ? '#EFF6FF' : '#F3F4F6', color: s.student_status === 'active' ? '#059669' : s.student_status === 'trial' ? '#2563EB' : '#6B7280', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{s.student_status}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{(s.assigned_teacher as any)?.profile?.name ?? '—'}</td>
                    <td style={{ padding: '14px 16px' }}><span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{s.currency}</span></td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: '#374151', fontSize: '13px' }}>{s.consumed_classes} / {s.total_paid_classes}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: rem <= 0 ? '#DC2626' : rem <= 2 ? '#D97706' : '#059669' }}>{rem}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: s.payment_status === 'paid' ? '#ECFDF5' : s.payment_status === 'declined' ? '#FEF2F2' : '#FFFBEB', color: s.payment_status === 'paid' ? '#059669' : s.payment_status === 'declined' ? '#DC2626' : '#D97706', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{s.payment_status}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Link href={`/accountant/payments/new?student=${s.id}`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>+ Payment</Link>
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
