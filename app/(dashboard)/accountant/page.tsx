// app/(dashboard)/accountant/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AccountantDashboard() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const [
    { data: allStudents },
    { data: pendingPayments },
    { data: reminders },
    { data: paidThisMonth },
  ] = await Promise.all([
    supabase.from('students').select('id, name, total_paid_classes, consumed_classes, student_status, currency, phone, email, payment_method, reminder_date, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))').neq('student_status', 'inactive').order('name'),
    supabase.from('payments').select('*, student:students(name, currency, phone)').eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('students').select('id, name, reminder_date, phone, email, notes').eq('reminder_date', today),
    supabase.from('payments').select('amount, currency').eq('status', 'paid').gte('payment_date', monthStart),
  ])

  const needsRenewal = (allStudents ?? []).filter(s => (s.total_paid_classes - s.consumed_classes) <= 2)

  // Revenue this month by currency
  const rev: Record<string, number> = {}
  ;(paidThisMonth ?? []).forEach((p: any) => { rev[p.currency] = (rev[p.currency] || 0) + Number(p.amount) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Accountant Dashboard</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Needs Renewal', value: needsRenewal.length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Pending Payments', value: pendingPayments?.length ?? 0, color: '#EA580C', bg: '#FFF7ED' },
          { label: 'Reminders Today', value: reminders?.length ?? 0, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Active Students', value: allStudents?.length ?? 0, color: '#059669', bg: '#ECFDF5' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue this month */}
      {Object.keys(rev).length > 0 && (
        <div style={{ background: '#0D1B2A', borderRadius: '14px', padding: '18px 24px' }}>
          <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue Collected This Month</p>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {Object.entries(rev).map(([cur, amt]) => {
              const sym = cur === 'USD' ? '$' : cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : 'AED '
              return (
                <div key={cur}>
                  <p style={{ color: '#6B7280', fontSize: '11px', margin: '0 0 2px 0' }}>{cur}</p>
                  <p style={{ color: '#E8C97A', fontSize: '22px', fontWeight: '700', margin: 0 }}>{sym}{amt.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Needs Renewal */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>⚠️ Needs Renewal</span>
            <Link href="/accountant/students" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '600' }}>View all →</Link>
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {needsRenewal.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '14px', padding: '32px' }}>🎉 All students have sufficient classes</p>
            ) : needsRenewal.map((s: any) => {
              const rem = s.total_paid_classes - s.consumed_classes
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 22px', borderBottom: '1px solid #F9FAFB' }}>
                  <div>
                    <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
                    <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{(s.assigned_teacher as any)?.profile?.name ?? '—'} · {s.currency}</p>
                    {s.phone && <p style={{ color: '#6B7280', fontSize: '11px', margin: '1px 0 0 0' }}>{s.phone}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span style={{ background: rem <= 0 ? '#FEF2F2' : '#FFFBEB', color: rem <= 0 ? '#DC2626' : '#D97706', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                      {rem} left
                    </span>
                    <Link href={`/accountant/payments/new?student=${s.id}`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontSize: '11px', fontWeight: '600' }}>
                      + Add Payment
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pending Payments + Reminders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pending payments */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>⏳ Pending Payments</span>
              <Link href="/accountant/payments" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '600' }}>View all →</Link>
            </div>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {(pendingPayments ?? []).length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '14px', padding: '20px' }}>No pending payments</p>
              ) : (pendingPayments ?? []).map((p: any) => {
                const sym = p.currency === 'USD' ? '$' : p.currency === 'GBP' ? '£' : p.currency === 'EUR' ? '€' : 'AED '
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 22px', borderBottom: '1px solid #F9FAFB' }}>
                    <div>
                      <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '13px' }}>{p.student?.name}</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{p.number_of_classes} classes · {sym}{Number(p.amount).toFixed(2)}</p>
                    </div>
                    <Link href={`/accountant/payments/${p.id}/edit`} style={{ background: '#059669', color: '#fff', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontSize: '11px', fontWeight: '600' }}>
                      Mark Paid
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Reminders */}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontWeight: '600', fontSize: '15px', color: '#111827' }}>🔔 Today's Reminders</span>
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {(reminders ?? []).length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '14px', padding: '20px' }}>No reminders today</p>
              ) : (reminders ?? []).map((s: any) => (
                <div key={s.id} style={{ padding: '10px 22px', borderBottom: '1px solid #F9FAFB' }}>
                  <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '13px' }}>{s.name}</p>
                  {s.notes && <p style={{ color: '#6B7280', fontSize: '11px', margin: '2px 0 0 0' }}>{s.notes}</p>}
                  <p style={{ color: '#2563EB', fontSize: '11px', margin: '2px 0 0 0' }}>{s.phone ?? s.email ?? ''}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
