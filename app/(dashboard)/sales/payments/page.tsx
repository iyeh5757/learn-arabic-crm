// app/(dashboard)/sales/payments/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SalesPaymentsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get payments for students added by this sales agent
  const { data: myStudents } = await supabase
    .from('students')
    .select('id')
    .eq('added_by_sales_id', user.id)

  const studentIds = (myStudents ?? []).map(s => s.id)

  const { data: payments } = studentIds.length > 0
    ? await supabase.from('payments')
        .select('*, student:students(name, currency)')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const statusColor: Record<string, { bg: string; text: string }> = {
    paid:     { bg: '#ECFDF5', text: '#059669' },
    pending:  { bg: '#FFFBEB', text: '#D97706' },
    declined: { bg: '#FEF2F2', text: '#DC2626' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Payments</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Payments from your students</p>
        </div>
        <Link href="/sales/payments/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>+ Add Payment</Link>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date', 'Student', 'Classes', 'Amount', 'Method', 'Status', 'Type'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No payments yet</td></tr>
              )}
              {(payments ?? []).map((p: any) => {
                const sc = statusColor[p.status] || { bg: '#F3F4F6', text: '#374151' }
                const sym = p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : p.currency === 'EUR' ? '€' : 'AED '
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{p.student?.name}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>{p.number_of_classes}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#111827' }}>{sym}{Number(p.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{p.payment_method}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: sc.bg, color: sc.text, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{p.status}</span></td>
                    <td style={{ padding: '12px 16px' }}>{p.is_renewal && <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Renewal</span>}</td>
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
