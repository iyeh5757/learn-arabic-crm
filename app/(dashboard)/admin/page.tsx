// app/(dashboard)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/dashboard/StatCard'
import MonthPicker from '@/components/dashboard/MonthPicker'
import Link from 'next/link'
import { Users, BookOpen, DollarSign, TrendingUp, Bell } from 'lucide-react'

// Helper: get month range from optional ?month=YYYY-MM param
function getMonthRange(monthParam?: string | null) {
  const now = new Date()
  const base = monthParam ? new Date(`${monthParam}-01`) : new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end   = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  }
}

export default async function AdminDashboard({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { start, end, label } = getMonthRange(searchParams.month)

  const [
    { data: allStudents },
    { data: monthPayments },
    { data: teacherSessions },
    { data: lowStudents },
    { data: todayReminders },
  ] = await Promise.all([
    supabase.from('students').select('id, student_status'),
    supabase.from('payments').select('amount, currency, number_of_classes').eq('status', 'paid')
      .gte('payment_date', start).lte('payment_date', end),
    supabase.from('sessions').select('teacher_id, duration, session_type, attendance_status, teacher:teachers(id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name))')
      .eq('session_type', 'paid').eq('attendance_status', 'attended')
      .gte('session_date', start).lte('session_date', end),
    supabase.from('students').select('id, name, total_paid_classes, consumed_classes').neq('student_status', 'inactive').lte('total_paid_classes', 2),
    supabase.from('students').select('id, name').eq('reminder_date', new Date().toISOString().split('T')[0]),
  ])

  // Revenue by currency
  const rev = { USD: 0, GBP: 0, EUR: 0, AED: 0 } as Record<string, number>
  monthPayments?.forEach(p => { rev[p.currency] = (rev[p.currency] || 0) + Number(p.amount) })

  // EGP rate (fetch live)
  let egpRate = 50
  try {
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { next: { revalidate: 3600 } })
    const d = await r.json()
    egpRate = d.rates?.EGP ?? 50
  } catch {}

  const totalEGP = rev.USD * egpRate + rev.GBP * egpRate * 1.27 + rev.EUR * egpRate * 1.09 + rev.AED * egpRate * 0.27

  // Teacher earnings
  const teacherMap = new Map<string, { name: string; sessions: number; usd: number }>()
  teacherSessions?.forEach((s: any) => {
    const t = s.teacher
    if (!t) return
    const existing = teacherMap.get(t.id) ?? { name: t.profile?.name ?? '?', sessions: 0, usd: 0 }
    existing.sessions++
    existing.usd += Number(t.rate_per_session_usd)
    teacherMap.set(t.id, existing)
  })
  const teacherEarnings = Array.from(teacherMap.values()).sort((a, b) => b.usd - a.usd)

  const needsRenewal = (lowStudents ?? []).filter(s => (s.total_paid_classes - s.consumed_classes) <= 2)
  const activeCount  = allStudents?.filter(s => s.student_status === 'active').length ?? 0
  const trialCount   = allStudents?.filter(s => s.student_status === 'trial').length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Admin Dashboard</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Revenue & operations for {label}</p>
        </div>
        <MonthPicker />
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        <StatCard label="Active Students" value={activeCount} icon={Users} color="green" />
        <StatCard label="Trial Students"  value={trialCount}  icon={Users} color="blue" />
        <StatCard label="Paid Sessions"   value={teacherSessions?.length ?? 0} icon={BookOpen} color="blue" />
        <StatCard label="Revenue EGP"     value={`EGP ${Math.round(totalEGP).toLocaleString()}`} icon={DollarSign} color="gold" />
        <StatCard label="Needs Renewal"   value={needsRenewal.length} icon={Bell} color="red" />
      </div>

      {/* Revenue by currency */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827', display: 'flex', justifyContent: 'space-between' }}>
          <span>💰 Revenue — {label}</span>
          <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: '400' }}>Rate: 1 USD = {egpRate.toFixed(1)} EGP</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 0 }}>
          {[
            { currency: 'USD', symbol: '$',   value: rev.USD },
            { currency: 'GBP', symbol: '£',   value: rev.GBP },
            { currency: 'EUR', symbol: '€',   value: rev.EUR },
            { currency: 'AED', symbol: 'AED', value: rev.AED },
          ].map(r => (
            <div key={r.currency} style={{ padding: '20px', borderRight: '1px solid #F3F4F6' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{r.currency}</p>
              <p style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>{r.symbol}{r.value.toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 22px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB' }}>
          <span style={{ fontSize: '14px', color: '#6B7280' }}>Total in EGP: </span>
          <span style={{ fontSize: '18px', fontWeight: '700', color: '#059669' }}>EGP {Math.round(totalEGP).toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Teacher earnings */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827' }}>👩‍🏫 Teacher Earnings — {label}</div>
          {teacherEarnings.length === 0
            ? <p style={{ padding: '24px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>No paid sessions this month</p>
            : <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {teacherEarnings.map(t => (
                  <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 22px', borderBottom: '1px solid #F9FAFB' }}>
                    <div>
                      <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{t.name}</p>
                      <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '2px 0 0 0' }}>{t.sessions} sessions</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: '700', color: '#059669', margin: 0 }}>${t.usd.toFixed(2)}</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>EGP {Math.round(t.usd * egpRate).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Renewal alerts */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🔔 Needs Renewal</span>
            <Link href="/admin/reminders" style={{ fontSize: '12px', color: '#C9A84C', textDecoration: 'none', fontWeight: '500' }}>View all →</Link>
          </div>
          {needsRenewal.length === 0
            ? <p style={{ padding: '24px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>🎉 All students have classes</p>
            : <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {needsRenewal.slice(0, 10).map(s => {
                  const rem = s.total_paid_classes - s.consumed_classes
                  return (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 22px', borderBottom: '1px solid #F9FAFB' }}>
                      <Link href={`/admin/students/${s.id}/edit`} style={{ fontWeight: '600', color: '#111827', textDecoration: 'none', fontSize: '14px' }}>{s.name}</Link>
                      <span style={{ fontWeight: '700', fontSize: '15px', color: rem <= 0 ? '#DC2626' : rem === 1 ? '#EA580C' : '#D97706' }}>{rem} left</span>
                    </div>
                  )
                })}
              </div>
          }
        </div>
      </div>

      {(todayReminders?.length ?? 0) > 0 && (
        <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontWeight: '700', color: '#1E40AF', margin: '0 0 8px 0' }}>🔔 {todayReminders?.length} reminder(s) set for today</p>
          <Link href="/admin/reminders" style={{ color: '#2563EB', fontSize: '14px', fontWeight: '500' }}>View Reminders →</Link>
        </div>
      )}
    </div>
  )
}
