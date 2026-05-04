// app/(dashboard)/sales/commissions/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SalesCommissionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: commissions },
    { data: salesConfig },
  ] = await Promise.all([
    supabase.from('commissions').select('*, student:students(name, currency)').eq('sales_user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('sales_config').select('commission_amount, commission_currency').eq('sales_user_id', user.id).single(),
  ])

  const totalByCurrency: Record<string, number> = {}
  const pendingByCurrency: Record<string, number> = {}
  ;(commissions ?? []).forEach((c: any) => {
    totalByCurrency[c.currency] = (totalByCurrency[c.currency] || 0) + Number(c.amount)
    if (c.status === 'pending') pendingByCurrency[c.currency] = (pendingByCurrency[c.currency] || 0) + Number(c.amount)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>My Commissions</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{commissions?.length ?? 0} commission records</p>
      </div>

      {/* Commission rate */}
      {salesConfig && (
        <div style={{ background: '#0D1B2A', borderRadius: '14px', padding: '20px 24px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Rate</p>
            <p style={{ color: '#E8C97A', fontSize: '22px', fontWeight: '700', margin: 0 }}>{salesConfig.commission_currency} {Number(salesConfig.commission_amount).toFixed(2)} / conversion</p>
          </div>
          {Object.entries(totalByCurrency).map(([cur, amt]) => (
            <div key={cur}>
              <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Earned ({cur})</p>
              <p style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 }}>{cur === 'USD' ? '$' : cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : 'AED '}{amt.toFixed(2)}</p>
            </div>
          ))}
          {Object.entries(pendingByCurrency).map(([cur, amt]) => (
            <div key={`p-${cur}`}>
              <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending ({cur})</p>
              <p style={{ color: '#FCD34D', fontSize: '22px', fontWeight: '700', margin: 0 }}>{cur === 'USD' ? '$' : cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : 'AED '}{amt.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date', 'Student', 'Amount', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(commissions ?? []).length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No commissions yet. Add your first paid student to earn one!</td></tr>
              )}
              {(commissions ?? []).map((c: any) => {
                const sym = c.currency === 'USD' ? '$' : c.currency === 'GBP' ? '£' : c.currency === 'EUR' ? '€' : 'AED '
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{c.student?.name ?? '—'}</td>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#111827', fontSize: '15px' }}>{sym}{Number(c.amount).toFixed(2)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: c.status === 'paid' ? '#ECFDF5' : '#FFFBEB', color: c.status === 'paid' ? '#059669' : '#D97706', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                        {c.status}
                      </span>
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
