// app/(dashboard)/sales/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SalesDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: myStudents },
    { data: myCommissions },
    { data: salesConfig },
  ] = await Promise.all([
    supabase.from('students').select('id, name, student_status, payment_status, currency, created_at, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))').eq('added_by_sales_id', user.id).order('created_at', { ascending: false }),
    supabase.from('commissions').select('amount, currency, status, created_at, student:students(name)').eq('sales_user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('sales_config').select('commission_amount, commission_currency').eq('sales_user_id', user.id).single(),
  ])

  const totalAdded = myStudents?.length ?? 0
  const thisMonth = (myStudents ?? []).filter(s => s.created_at >= monthStart).length
  const paidConversions = (myStudents ?? []).filter(s => s.student_status === 'active').length
  const conversionRate = totalAdded > 0 ? Math.round((paidConversions / totalAdded) * 100) : 0

  const commByCurrency: Record<string, number> = {}
  const pendingComm: Record<string, number> = {}
  ;(myCommissions ?? []).forEach((c: any) => {
    commByCurrency[c.currency] = (commByCurrency[c.currency] || 0) + Number(c.amount)
    if (c.status === 'pending') pendingComm[c.currency] = (pendingComm[c.currency] || 0) + Number(c.amount)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Sales Dashboard</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/sales/students/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Add Student
        </Link>
      </div>

      {/* Commission banner */}
      {salesConfig && (
        <div style={{ background: '#0D1B2A', borderRadius: '14px', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0' }}>YOUR COMMISSION RATE</p>
            <p style={{ color: '#E8C97A', fontSize: '24px', fontWeight: '700', margin: 0 }}>
              {salesConfig.commission_currency} {Number(salesConfig.commission_amount).toFixed(2)} per conversion
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0' }}>PENDING COMMISSIONS</p>
            {Object.entries(pendingComm).length > 0
              ? Object.entries(pendingComm).map(([cur, amt]) => (
                <p key={cur} style={{ color: '#E8C97A', fontSize: '18px', fontWeight: '700', margin: 0 }}>{cur} {amt.toFixed(2)}</p>
              ))
              : <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>No pending commissions</p>
            }
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Total Students Added', value: totalAdded, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Added This Month', value: thisMonth, color: '#059669', bg: '#ECFDF5' },
          { label: 'Paid Conversions', value: paidConversions, color: '#EA580C', bg: '#FFF7ED' },
          { label: 'Conversion Rate', value: `${conversionRate}%`, color: '#7C3AED', bg: '#F3E8FF' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Commission breakdown */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827' }}>💰 Total Commissions Earned</div>
          <div style={{ padding: '20px 22px' }}>
            {Object.keys(commByCurrency).length === 0 ? (
              <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>No commissions yet</p>
            ) : Object.entries(commByCurrency).map(([cur, amt]) => (
              <div key={cur} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ color: '#6B7280', fontSize: '14px' }}>{cur}</span>
                <span style={{ fontWeight: '700', color: '#111827', fontSize: '15px' }}>{cur} {amt.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent students */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>My Recent Students</span>
            <Link href="/sales/students" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '600' }}>View all →</Link>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {(myStudents ?? []).slice(0, 8).map((s: any) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 22px', borderBottom: '1px solid #F9FAFB' }}>
                <div>
                  <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{(s.assigned_teacher as any)?.profile?.name ?? 'No teacher'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ background: s.student_status === 'active' ? '#ECFDF5' : s.student_status === 'trial' ? '#EFF6FF' : '#F3F4F6', color: s.student_status === 'active' ? '#059669' : s.student_status === 'trial' ? '#2563EB' : '#6B7280', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.student_status}</span>
                  <span style={{ background: s.payment_status === 'paid' ? '#ECFDF5' : '#FFFBEB', color: s.payment_status === 'paid' ? '#059669' : '#D97706', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.payment_status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
