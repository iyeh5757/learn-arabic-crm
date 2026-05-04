// app/(dashboard)/accountant/renewals/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AccountantRenewalsPage() {
  const supabase = createClient()

  const { data: students } = await supabase
    .from('students')
    .select('id, name, phone, email, country, currency, total_paid_classes, consumed_classes, student_status, payment_method, reminder_date, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
    .neq('student_status', 'inactive')
    .order('consumed_classes', { ascending: false })

  const needsRenewal = (students ?? []).filter(s => (s.total_paid_classes - s.consumed_classes) <= 2)
  const urgent = needsRenewal.filter(s => (s.total_paid_classes - s.consumed_classes) <= 0)
  const soon = needsRenewal.filter(s => (s.total_paid_classes - s.consumed_classes) > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Renewal Queue</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{needsRenewal.length} students need attention</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Out of Classes', value: urgent.length, color: '#DC2626', bg: '#FEF2F2' },
          { label: '1-2 Classes Left', value: soon.length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'All Active Students', value: students?.length ?? 0, color: '#059669', bg: '#ECFDF5' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Urgent — out of classes */}
      {urgent.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #FEE2E2', background: '#FEF2F2', fontWeight: '600', fontSize: '15px', color: '#DC2626' }}>
            🚨 Out of Classes ({urgent.length})
          </div>
          <StudentRenewalTable students={urgent} />
        </div>
      )}

      {/* Soon */}
      {soon.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #FEF3C7', background: '#FFFBEB', fontWeight: '600', fontSize: '15px', color: '#D97706' }}>
            ⚠️ 1-2 Classes Remaining ({soon.length})
          </div>
          <StudentRenewalTable students={soon} />
        </div>
      )}

      {needsRenewal.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF', background: '#fff', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '48px', margin: '0 0 12px 0' }}>🎉</p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: '#374151', margin: '0 0 8px 0' }}>All caught up!</p>
          <p style={{ fontSize: '14px', margin: 0 }}>No students need renewal right now.</p>
        </div>
      )}
    </div>
  )
}

function StudentRenewalTable({ students }: { students: any[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F9FAFB' }}>
            {['Student', 'Teacher', 'Country', 'Currency', 'Classes Left', 'Contact', 'Action'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s: any) => {
            const rem = s.total_paid_classes - s.consumed_classes
            return (
              <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <td style={{ padding: '14px 16px' }}>
                  <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
                  {s.email && <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{s.email}</p>}
                </td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{(s.assigned_teacher as any)?.profile?.name ?? '—'}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{s.country ?? '—'}</td>
                <td style={{ padding: '14px 16px' }}><span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{s.currency}</span></td>
                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                  <span style={{ fontWeight: '700', fontSize: '16px', color: rem <= 0 ? '#DC2626' : '#D97706' }}>{rem}</span>
                </td>
                <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '12px' }}>{s.phone ?? s.email ?? '—'}</td>
                <td style={{ padding: '14px 16px' }}>
                  <Link href={`/accountant/payments/new?student=${s.id}`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '6px 14px', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>
                    + Add Payment
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
