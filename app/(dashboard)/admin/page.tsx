// app/(dashboard)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/dashboard/StatCard'
import Link from 'next/link'


function getMonthRange(monthParam?: string | null) {
  const now = new Date()
  const base = monthParam ? new Date(`${monthParam}-01`) : new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end   = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    param: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2,'0')}`,
    isCurrentMonth: base.getFullYear() === now.getFullYear() && base.getMonth() === now.getMonth(),
  }
}

export default async function AdminDashboard({ searchParams }: { searchParams?: { month?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { start, end, label, param, isCurrentMonth } = getMonthRange(searchParams?.month)

  // Previous / next month params
  const base = new Date(`${param}-01`)
  const prevDate = new Date(base.getFullYear(), base.getMonth() - 1, 1)
  const nextDate = new Date(base.getFullYear(), base.getMonth() + 1, 1)
  const prevParam = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2,'0')}`
  const nextParam = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2,'0')}`

  const [
    { data: allStudents },
    { data: monthPayments },
    { data: teacherSessions },
    { data: lowStudents },
    { data: todayReminders },
  ] = await Promise.all([
    supabase.from('students').select('id, student_status'),
    supabase.from('payments').select('amount, currency').eq('status', 'paid').gte('payment_date', start).lte('payment_date', end),
    supabase.from('sessions')
      .select('teacher_id, duration, teacher:teachers(id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name))')
      .eq('session_type', 'paid').eq('attendance_status', 'attended')
      .gte('session_date', start).lte('session_date', end),
    supabase.from('students').select('id, name, total_paid_classes, consumed_classes').neq('student_status', 'inactive'),
    supabase.from('students').select('id, name').eq('reminder_date', new Date().toISOString().split('T')[0]),
  ])

  // Revenue by currency
  const rev: Record<string, number> = { USD: 0, GBP: 0, EUR: 0, AED: 0 }
  monthPayments?.forEach(p => { rev[p.currency] = (rev[p.currency] || 0) + Number(p.amount) })

  // EGP rate — safe fetch with fallback
  let egpRate = 50
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: controller.signal,
      next: { revalidate: 3600 },
    })
    clearTimeout(timeout)
    if (r.ok) {
      const d = await r.json()
      egpRate = Number(d?.rates?.EGP) || 50
    }
  } catch { /* use fallback 50 */ }

  const totalEGP = rev.USD * egpRate + rev.GBP * egpRate * 1.27 + rev.EUR * egpRate * 1.09 + rev.AED * egpRate * 0.27

  // Teacher earnings map
  const teacherMap = new Map<string, { name: string; sessions: number; usd: number }>()
  teacherSessions?.forEach((s: any) => {
    const t = s.teacher
    if (!t) return
    const existing = teacherMap.get(t.id) ?? { name: t.profile?.name ?? '?', sessions: 0, usd: 0 }
    existing.sessions++
    existing.usd += Number(t.rate_per_session_usd) * ((s.duration ?? 60) / 60)
    teacherMap.set(t.id, existing)
  })
  const teacherEarnings = Array.from(teacherMap.values()).sort((a, b) => b.usd - a.usd)

  const needsRenewal = (lowStudents ?? []).filter(s => (s.total_paid_classes - s.consumed_classes) <= 2)
  const activeCount  = (allStudents ?? []).filter(s => s.student_status === 'active').length
  const trialCount   = (allStudents ?? []).filter(s => s.student_status === 'trial').length

  const card  = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
  const cardH = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Admin Dashboard</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{label}</p>
        </div>
        {/* Inline month navigator — no client component needed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '6px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <Link href={`/admin?month=${prevParam}`} style={{ textDecoration: 'none', color: '#6B7280', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>‹</Link>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827', minWidth: '130px', textAlign: 'center' }}>{label}</span>
          <Link href={isCurrentMonth ? '/admin' : `/admin?month=${nextParam}`} style={{ textDecoration: 'none', color: isCurrentMonth ? '#D1D5DB' : '#6B7280', fontSize: '18px', lineHeight: 1, padding: '2px 6px', pointerEvents: isCurrentMonth ? 'none' : 'auto' }}>›</Link>
          {!isCurrentMonth && (
            <Link href="/admin" style={{ fontSize: '11px', fontWeight: '600', color: '#C9A84C', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '3px 8px', borderRadius: '6px', textDecoration: 'none', marginLeft: '4px', whiteSpace: 'nowrap' }}>Today</Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        <StatCard label="Active Students" value={activeCount} emoji="👨‍🎓" color="green" />
        <StatCard label="Trial Students" value={trialCount} emoji="🎯" color="blue" />
        <StatCard label="Paid Sessions" value={teacherSessions?.length ?? 0} emoji="📅" color="blue" />
        <StatCard label="Revenue EGP"     value={`EGP ${Math.round(totalEGP).toLocaleString()}`} emoji="💰" color="gold" />
        <StatCard label="Needs Renewal" value={needsRenewal.length} emoji="🔔" color="red" />
      </div>

      {/* Revenue by currency */}
      <div style={card}>
        <div style={cardH}>
          <span>💰 Revenue — {label}</span>
          <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: '400' }}>1 USD ≈ {egpRate.toFixed(1)} EGP</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {[{ c: 'USD', s: '$' }, { c: 'GBP', s: '£' }, { c: 'EUR', s: '€' }, { c: 'AED', s: 'AED ' }].map(({ c, s }) => (
            <div key={c} style={{ padding: '20px', borderRight: '1px solid #F3F4F6' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px 0' }}>{c}</p>
              <p style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>{s}{(rev[c] || 0).toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #F3F4F6', background: '#F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#6B7280' }}>Total in EGP</span>
          <span style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>EGP {Math.round(totalEGP).toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Teacher earnings */}
        <div style={card}>
          <div style={cardH}><span>👩‍🏫 Teacher Earnings</span></div>
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
                      <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>≈ EGP {Math.round(t.usd * egpRate).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Renewal alerts */}
        <div style={card}>
          <div style={cardH}>
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
        <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: '600', color: '#1E40AF', margin: 0 }}>🔔 {todayReminders?.length} reminder(s) set for today</p>
          <Link href="/admin/reminders" style={{ color: '#2563EB', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>View →</Link>
        </div>
      )}
    </div>
  )
}
