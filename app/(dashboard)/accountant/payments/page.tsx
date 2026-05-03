// app/(dashboard)/accountant/payments/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AccountantPaymentsPage() {
  const supabase = createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('*, student:students(name, currency, phone), added_by_profile:profiles!payments_added_by_fkey(name)')
    .order('created_at', { ascending: false })

  const statusColor: Record<string, { bg: string; text: string }> = {
    paid:     { bg: '#ECFDF5', text: '#059669' },
    pending:  { bg: '#FFFBEB', text: '#D97706' },
    declined: { bg: '#FEF2F2', text: '#DC2626' },
  }

  const totals: Record<string, number> = {}
  payments?.filter(p => p.status === 'paid').forEach((p: any) => {
    totals[p.currency] = (totals[p.currency] || 0) + Number(p.amount)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>All Payments</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{payments?.length ?? 0} records</p>
        </div>
        <Link href="/accountant/payments/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>+ Add Payment</Link>
      </div>

      {Object.keys(totals).length > 0 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {Object.entries(totals).map(([cur, amt]) => (
            <div key={cur} style={{ background: '#0D1B2A', borderRadius: '12px', padding: '14px 20px' }}>
              <p style={{ color: '#9CA3AF', fontSize: '11px', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Total Paid ({cur})</p>
              <p style={{ color: '#E8C97A', fontSize: '20px', fontWeight: '700', margin: 0 }}>
                {cur === 'USD' ? '$' : cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : 'AED '}{amt.toLocaleString('en', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date', 'Student', 'Classes', 'Amount', 'Method', 'Status', 'Added By', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p: any) => {
                const sc = statusColor[p.status] || { bg: '#F3F4F6', text: '#374151' }
                const sym = p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : p.currency === 'EUR' ? '€' : 'AED '
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F3F4F6', background: p.status === 'pending' ? '#FFFBEB33' : 'transparent' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{p.student?.name}</p>
                      {p.student?.phone && <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{p.student.phone}</p>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>{p.number_of_classes}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#111827' }}>{sym}{Number(p.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{p.payment_method}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: sc.bg, color: sc.text, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{p.status}</span></td>
                    <td style={{ padding: '12px 16px', color: '#9CA3AF', fontSize: '12px' }}>{p.added_by_profile?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/accountant/payments/${p.id}/edit`} style={{ background: p.status === 'pending' ? '#059669' : '#0D1B2A', color: '#fff', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>
                        {p.status === 'pending' ? '✓ Mark Paid' : 'Edit'}
                      </Link>
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
