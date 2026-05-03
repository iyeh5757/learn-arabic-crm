// app/(dashboard)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { Users, BookOpen, DollarSign, TrendingUp, AlertCircle, Bell } from 'lucide-react'

async function getEGPRate(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 3600 } })
    const data = await res.json()
    return data?.rates?.EGP ?? 48.5
  } catch {
    return 48.5
  }
}

export default async function AdminDashboard() {
  const supabase = createClient()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const today = now.toISOString().split('T')[0]

  const [
    { count: totalStudents },
    { count: activeStudents },
    { count: trialStudents },
    { count: totalSessions },
    { data: paymentsThisMonth },
    { data: teachers },
    { data: renewalStudents },
    { data: reminderStudents },
    egpRate,
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('student_status', 'active'),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('student_status', 'trial'),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('session_date', monthStart),
    supabase.from('payments').select('amount, currency').eq('status', 'paid').gte('created_at', monthStart + 'T00:00:00'),
    supabase.from('teachers').select('id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name), sessions(id, attendance_status, session_type, session_date, duration)').eq('is_active', true),
    supabase.from('students').select('id, name, total_paid_classes, consumed_classes, student_status, currency, phone, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))').filter('total_paid_classes', 'lte', 'consumed_classes + 2').neq('student_status', 'inactive').order('consumed_classes', { ascending: false }).limit(20),
    supabase.from('students').select('id, name, reminder_date, phone, email').eq('reminder_date', today),
    getEGPRate(),
  ])

  // Revenue by currency
  const rev = { USD: 0, GBP: 0, EUR: 0, AED: 0 }
  paymentsThisMonth?.forEach((p: any) => { rev[p.currency as keyof typeof rev] = (rev[p.currency as keyof typeof rev] || 0) + Number(p.amount) })

  // Total in USD approx
  const totalUSD = rev.USD + rev.GBP * 1.27 + rev.EUR * 1.08 + rev.AED * 0.27

  // Teacher earnings
  const earnings = (teachers ?? []).map((t: any) => {
    const monthSessions = (t.sessions ?? []).filter((s: any) =>
      s.session_type === 'paid' && s.attendance_status === 'attended' && s.session_date >= monthStart
    )
    const usd = monthSessions.length * Number(t.rate_per_session_usd)
    return { name: t.profile?.name ?? '—', sessions: monthSessions.length, usd, egp: Math.round(usd * egpRate), rate: t.rate_per_session_usd }
  }).sort((a: any, b: any) => b.usd - a.usd)

  // Filter renewal students properly
  const needsRenewal = (renewalStudents ?? []).filter((s: any) => (s.total_paid_classes - s.consumed_classes) <= 2)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Admin Dashboard</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
          {now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Alerts */}
      {((needsRenewal.length > 0) || ((reminderStudents?.length ?? 0) > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {needsRenewal.length > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px' }}>
              <AlertCircle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontWeight: '600', color: '#92400E', margin: 0 }}>{needsRenewal.length} student{needsRenewal.length > 1 ? 's' : ''} need renewal</p>
                <p style={{ color: '#B45309', fontSize: '13px', margin: '4px 0 0 0' }}>2 or fewer classes remaining</p>
              </div>
            </div>
          )}
          {(reminderStudents?.length ?? 0) > 0 && (
            <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px' }}>
              <Bell size={20} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontWeight: '600', color: '#1E40AF', margin: 0 }}>{reminderStudents?.length} reminder{(reminderStudents?.length ?? 0) > 1 ? 's' : ''} today</p>
                <p style={{ color: '#1D4ED8', fontSize: '13px', margin: '4px 0 0 0' }}>{reminderStudents?.map((s: any) => s.name).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Total Students', value: totalStudents ?? 0, color: '#3B82F6', bg: '#EFF6FF' },
          { label: 'Active Students', value: activeStudents ?? 0, color: '#10B981', bg: '#ECFDF5' },
          { label: 'Trial Students', value: trialStudents ?? 0, color: '#F59E0B', bg: '#FFFBEB' },
          { label: 'Sessions This Month', value: totalSessions ?? 0, color: '#8B5CF6', bg: '#F5F3FF' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '32px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue + Renewals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Revenue */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={18} color="#C9A84C" />
            <h2 style={{ fontWeight: '700', color: '#111827', margin: 0, fontSize: '15px' }}>Revenue This Month — by Currency</h2>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {[
              { cur: 'USD', symbol: '$', flag: '🇺🇸', val: rev.USD },
              { cur: 'GBP', symbol: '£', flag: '🇬🇧', val: rev.GBP },
              { cur: 'EUR', symbol: '€', flag: '🇪🇺', val: rev.EUR },
              { cur: 'AED', symbol: 'AED', flag: '🇦🇪', val: rev.AED },
            ].map(r => (
              <div key={r.cur} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ color: '#6B7280', fontSize: '14px' }}>{r.flag} {r.cur}</span>
                <span style={{ fontWeight: '700', color: '#111827', fontSize: '15px' }}>{r.symbol} {r.val.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px' }}>
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>≈ Total in USD</span>
              <span style={{ fontWeight: '700', color: '#0D1B2A', fontSize: '15px' }}>$ {totalUSD.toLocaleString('en', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Renewals */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} color="#F59E0B" />
              <h2 style={{ fontWeight: '700', color: '#111827', margin: 0, fontSize: '15px' }}>Needs Renewal</h2>
            </div>
            <a href="/admin/students" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '600' }}>View all →</a>
          </div>
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {needsRenewal.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '14px', padding: '32px' }}>🎉 All students have sufficient classes</p>
            ) : needsRenewal.map((s: any) => {
              const remaining = s.total_paid_classes - s.consumed_classes
              return (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #F9FAFB' }}>
                  <div>
                    <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
                    <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '2px 0 0 0' }}>{s.currency} · {(s.assigned_teacher as any)?.profile?.name ?? 'No teacher'}</p>
                  </div>
                  <span style={{ background: remaining <= 0 ? '#FEE2E2' : '#FEF3C7', color: remaining <= 0 ? '#DC2626' : '#D97706', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                    {remaining} left
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Teacher Earnings */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: '700', color: '#111827', margin: 0, fontSize: '15px' }}>Teacher Earnings This Month</h2>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>1 USD = {egpRate.toFixed(2)} EGP (live rate)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Teacher', 'Sessions This Month', 'Rate / Session', 'Earnings (USD)', 'Earnings (EGP)'].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {earnings.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF', fontSize: '14px' }}>No sessions recorded this month</td></tr>
              ) : earnings.map((e: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '14px 20px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{e.name}</td>
                  <td style={{ padding: '14px 20px', color: '#374151', fontSize: '14px', textAlign: 'center' }}>{e.sessions}</td>
                  <td style={{ padding: '14px 20px', color: '#6B7280', fontSize: '14px' }}>$ {Number(e.rate).toFixed(2)}</td>
                  <td style={{ padding: '14px 20px', fontWeight: '700', color: '#111827', fontSize: '15px' }}>$ {e.usd.toFixed(2)}</td>
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontWeight: '700', color: '#059669', fontSize: '15px' }}>EGP {e.egp.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {[
          { label: '+ Add Student', href: '/admin/students/new', color: '#0D1B2A' },
          { label: '👥 All Students', href: '/admin/students', color: '#1F3352' },
          { label: '📅 Sessions', href: '/admin/sessions', color: '#1F3352' },
          { label: '💰 Payments', href: '/admin/payments', color: '#1F3352' },
          { label: '👤 Users', href: '/admin/users', color: '#1F3352' },
        ].map(l => (
          <a key={l.href} href={l.href} style={{ background: l.color, color: '#E8C97A', padding: '14px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px', textAlign: 'center', display: 'block', transition: 'opacity 0.15s' }}>
            {l.label}
          </a>
        ))}
      </div>
    </div>
  )
}
