// app/(dashboard)/admin/analytics/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import FilterBar from './FilterBar'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function inMonth(dateStr: string, key: string) {
  return dateStr.startsWith(key)
}

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: { months?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: students },
    { data: payments },
    { data: sessions },
    { data: teachers },
    { data: commissions },
  ] = await Promise.all([
    supabase.from('students').select('id, name, country, currency, payment_method, student_status, added_by_sales_id, assigned_teacher_id, total_paid_classes, consumed_classes, created_at'),
    supabase.from('payments').select('id, amount, currency, payment_method, status, student_id, created_at, is_renewal, number_of_classes'),
    supabase.from('sessions').select('id, teacher_id, student_id, duration, status, created_at'),
    supabase.from('teachers').select('id, user_id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name)'),
    supabase.from('commissions').select('id, sales_user_id, amount, currency, status, created_at'),
  ])

  const allStudents    = students    ?? []
  const allPayments    = payments    ?? []
  const allSessions    = sessions    ?? []
  const allTeachers    = teachers    ?? []
  const allCommissions = commissions ?? []

  // ── Build available months list (all months that have any data) ─────────
  const now = new Date()
  const availableMonths: string[] = []
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    availableMonths.push(monthKey(d))
  }

  // ── Parse selected months from searchParams ─────────────────────────────
  const selectedMonths = searchParams.months?.split(',').filter(Boolean) ?? []
  const isFiltered = selectedMonths.length > 0

  // Filter helper — apply month filter when active
  function filterByMonths<T extends { created_at: string }>(arr: T[]): T[] {
    if (!isFiltered) return arr
    return arr.filter(r => selectedMonths.some(m => inMonth(r.created_at, m)))
  }

  // For payments/sessions filter by date; students status is always current
  const filteredPayments    = filterByMonths(allPayments)
  const filteredSessions    = filterByMonths(allSessions)
  const filteredCommissions = filterByMonths(allCommissions)
  const filteredNewStudents = filterByMonths(allStudents) // students created in period

  const paidPayments = filteredPayments.filter(p => p.status === 'paid')
  // All-time paid used for teacher conversion (not date-filtered)
  const allPaidPayments = allPayments.filter(p => p.status === 'paid')

  // ── Revenue by currency ─────────────────────────────────────────────────
  const revByCurrency: Record<string, number> = {}
  paidPayments.forEach(p => { revByCurrency[p.currency] = (revByCurrency[p.currency] ?? 0) + Number(p.amount) })

  // ── Revenue by payment method ───────────────────────────────────────────
  const revByMethod: Record<string, number> = {}
  paidPayments.forEach(p => {
    const m = p.payment_method || 'Unknown'
    revByMethod[m] = (revByMethod[m] ?? 0) + Number(p.amount)
  })

  // ── Students by country (all-time, not date-filtered) ───────────────────
  const byCountry: Record<string, number> = {}
  allStudents.forEach(s => { if (s.country) byCountry[s.country] = (byCountry[s.country] ?? 0) + 1 })
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // ── Student status (always all-time snapshot) ───────────────────────────
  const activeStudents   = allStudents.filter(s => s.student_status === 'active').length
  const trialStudents    = allStudents.filter(s => s.student_status === 'trial').length
  const inactiveStudents = allStudents.filter(s => s.student_status === 'inactive').length
  const conversionRate   = allStudents.length > 0 ? Math.round((activeStudents / allStudents.length) * 100) : 0

  // ── Renewals vs new ─────────────────────────────────────────────────────
  const renewalCount = paidPayments.filter(p => p.is_renewal).length
  const newPayCount  = paidPayments.filter(p => !p.is_renewal).length

  // ── Avg classes per payment ─────────────────────────────────────────────
  const avgClasses = paidPayments.length > 0
    ? Math.round(paidPayments.reduce((s, p) => s + (p.number_of_classes ?? 0), 0) / paidPayments.length)
    : 0

  // ── Commissions ─────────────────────────────────────────────────────────
  const pendingCommissions = filteredCommissions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const paidCommissions    = filteredCommissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0)

  // ── Monthly breakdown (for MOM table) ──────────────────────────────────
  // Use selected months if filtered, else last 6
  const momMonths = isFiltered
    ? [...selectedMonths].sort()
    : availableMonths.slice(0, 6).reverse()

  type MonthRow = {
    key: string; label: string
    revenue: number; newStudents: number; payments: number; renewals: number
    avgAmount: number; sessions: number; newPay: number
  }

  const momRows: MonthRow[] = momMonths.map(key => {
    const [y, m] = key.split('-')
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    const mPayments = allPaidPayments.filter(p => inMonth(p.created_at, key))
    const mRevenue  = mPayments.reduce((s, p) => s + Number(p.amount), 0)
    const mSessions = allSessions.filter(s => inMonth(s.created_at, key)).length
    const mNewStudents = allStudents.filter(s => inMonth(s.created_at, key)).length
    const mRenewals = mPayments.filter(p => p.is_renewal).length
    const mNewPay   = mPayments.filter(p => !p.is_renewal).length
    return {
      key, label,
      revenue: mRevenue,
      newStudents: mNewStudents,
      payments: mPayments.length,
      renewals: mRenewals,
      newPay: mNewPay,
      avgAmount: mPayments.length > 0 ? mRevenue / mPayments.length : 0,
      sessions: mSessions,
    }
  })

  // ── Teacher stats (all-time unless sessions filtered) ───────────────────
  const teacherMap: Record<string, { name: string; hours: number; students: number }> = {}
  allTeachers.forEach(t => {
    teacherMap[t.id] = { name: (t.profile as any)?.name ?? 'Unknown', hours: 0, students: 0 }
  })
  filteredSessions.forEach(s => {
    if (teacherMap[s.teacher_id]) teacherMap[s.teacher_id].hours += (s.duration ?? 60) / 60
  })
  allStudents.forEach(s => {
    if (s.assigned_teacher_id && teacherMap[s.assigned_teacher_id]) teacherMap[s.assigned_teacher_id].students++
  })
  const topTeachersByHours = Object.values(teacherMap).sort((a, b) => b.hours - a.hours).slice(0, 8)

  // Teacher trial conversion (all-time)
  const trialSessionsByTeacher: Record<string, number> = {}
  const convertedByTeacher: Record<string, number> = {}
  allSessions.filter(s => s.status === 'trial').forEach(s => {
    trialSessionsByTeacher[s.teacher_id] = (trialSessionsByTeacher[s.teacher_id] ?? 0) + 1
  })
  allStudents.filter(s => s.student_status === 'active' && s.assigned_teacher_id).forEach(s => {
    convertedByTeacher[s.assigned_teacher_id!] = (convertedByTeacher[s.assigned_teacher_id!] ?? 0) + 1
  })
  const teacherConversionData = Object.entries(teacherMap).map(([id, t]) => ({
    name: t.name,
    trials: trialSessionsByTeacher[id] ?? 0,
    converted: convertedByTeacher[id] ?? 0,
  })).filter(t => t.trials > 0 || t.converted > 0).sort((a, b) => b.converted - a.converted).slice(0, 8)

  // ── AI Suggestions ──────────────────────────────────────────────────────
  const suggestions: { emoji: string; title: string; body: string; color: string }[] = []
  if (conversionRate < 50) suggestions.push({ emoji: '🎯', title: 'Low Trial Conversion Rate', body: `Only ${conversionRate}% of students converted from trial to active. Review teacher performance on trial sessions and consider a follow-up process within 24 hours of each trial.`, color: '#DC2626' })
  if (trialStudents > activeStudents * 0.3) suggestions.push({ emoji: '📞', title: 'High Trial Backlog', body: `You have ${trialStudents} students still in trial status. Assign a sales follow-up task to convert these — each unconverted trial is lost revenue.`, color: '#D97706' })
  if (inactiveStudents > activeStudents * 0.2) suggestions.push({ emoji: '🔄', title: 'Re-engagement Opportunity', body: `${inactiveStudents} students are inactive. A win-back campaign with a discounted renewal package could recover a portion of this segment.`, color: '#7C3AED' })
  if (renewalCount > 0 && paidPayments.length > 0 && renewalCount / paidPayments.length < 0.4) suggestions.push({ emoji: '💡', title: 'Improve Renewal Rate', body: `Only ${Math.round((renewalCount / paidPayments.length) * 100)}% of paid payments are renewals. Consider automated reminders 5 days before a student runs out of classes.`, color: '#2563EB' })
  const topMethod = Object.entries(revByMethod).sort((a, b) => b[1] - a[1])[0]
  if (topMethod && Object.keys(revByMethod).length >= 3) {
    const topPct = Math.round((topMethod[1] / Object.values(revByMethod).reduce((s, v) => s + v, 0)) * 100)
    if (topPct > 60) suggestions.push({ emoji: '⚠️', title: 'Payment Method Concentration Risk', body: `${topPct}% of revenue flows through ${topMethod[0]}. Encourage students to register backup payment options.`, color: '#EA580C' })
  }
  if (topCountries.length > 0) suggestions.push({ emoji: '🌍', title: `Strongest Market: ${topCountries[0][0]}`, body: `${topCountries[0][1]} students are from ${topCountries[0][0]}. Double down with targeted content or ads for this market.`, color: '#059669' })
  if (avgClasses > 0 && avgClasses < 10) suggestions.push({ emoji: '📦', title: 'Upsell Larger Packages', body: `Average payment is for ${avgClasses} classes. Promoting 16–20 class bundles with a per-class discount could raise revenue per transaction.`, color: '#0891B2' })
  if (pendingCommissions > 0) suggestions.push({ emoji: '💰', title: `Unpaid Commissions: ${pendingCommissions.toFixed(2)}`, body: `${filteredCommissions.filter(c => c.status === 'pending').length} commissions are pending payout. Keep your sales team motivated by settling these promptly.`, color: '#6B7280' })
  // MOM-specific suggestion
  if (momRows.length >= 2) {
    const last = momRows[momRows.length - 1]
    const prev = momRows[momRows.length - 2]
    if (prev.revenue > 0 && last.revenue < prev.revenue * 0.85) {
      const drop = Math.round(((prev.revenue - last.revenue) / prev.revenue) * 100)
      suggestions.push({ emoji: '📉', title: `Revenue Dropped ${drop}% vs Prior Month`, body: `${last.label} revenue was ${last.revenue.toFixed(0)} vs ${prev.revenue.toFixed(0)} in ${prev.label}. Investigate if renewals slowed down or new conversions dropped.`, color: '#DC2626' })
    }
    if (prev.revenue > 0 && last.revenue > prev.revenue * 1.15) {
      const growth = Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100)
      suggestions.push({ emoji: '🚀', title: `Strong Growth: +${growth}% MOM`, body: `Revenue grew ${growth}% from ${prev.label} to ${last.label}. Identify what drove this and replicate it.`, color: '#059669' })
    }
  }
  if (suggestions.length === 0) suggestions.push({ emoji: '✅', title: 'Business is Healthy', body: 'No major issues detected. Keep monitoring renewal rates and trial conversions as you scale.', color: '#059669' })

  // ── Styles ──────────────────────────────────────────────────────────────
  const card   = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
  const cardH  = (bg = '#F9FAFB', color = '#111827') => ({ padding: '14px 20px', background: bg, borderBottom: '1px solid #E5E7EB', fontWeight: '700' as const, fontSize: '15px', color })
  const cell   = { padding: '12px 16px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }
  const thCell = { ...cell, fontWeight: '600' as const, color: '#6B7280', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: '#F9FAFB' }
  const SYM: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', AED: 'AED ', EGP: 'EGP ' }

  function Bar({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0
    return (
      <div style={{ height: '8px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden', minWidth: '80px', flex: 1 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px' }} />
      </div>
    )
  }

  function MomDelta({ current, previous }: { current: number; previous: number }) {
    if (previous === 0) return <span style={{ color: '#9CA3AF', fontSize: '11px' }}>—</span>
    const pct = Math.round(((current - previous) / previous) * 100)
    const up = pct >= 0
    return (
      <span style={{ fontSize: '11px', fontWeight: '700', color: up ? '#059669' : '#DC2626', background: up ? '#ECFDF5' : '#FEF2F2', padding: '2px 6px', borderRadius: '6px', marginLeft: '4px' }}>
        {up ? '▲' : '▼'} {Math.abs(pct)}%
      </span>
    )
  }

  const maxRevMethod = Math.max(...Object.values(revByMethod), 1)
  const maxCountry   = topCountries[0]?.[1] ?? 1
  const maxTeacherH  = Math.max(...topTeachersByHours.map(t => t.hours), 1)

  const periodLabel = isFiltered
    ? `${selectedMonths.length} month${selectedMonths.length !== 1 ? 's' : ''} selected`
    : 'All Time'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Business Analytics</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
            Showing: <strong style={{ color: '#0D1B2A' }}>{periodLabel}</strong>
            {isFiltered && <span style={{ color: '#6B7280' }}> · student status is always all-time</span>}
          </p>
        </div>
      </div>

      {/* Month filter */}
      <Suspense fallback={<div style={{ height: '80px', background: '#F9FAFB', borderRadius: '14px' }} />}>
        <FilterBar availableMonths={availableMonths} />
      </Suspense>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Students',  value: allStudents.length,    color: '#0D1B2A', bg: '#F9FAFB', emoji: '👥', note: 'all-time' },
          { label: 'Active',          value: activeStudents,         color: '#059669', bg: '#ECFDF5', emoji: '✅', note: 'all-time' },
          { label: 'Trials',          value: trialStudents,          color: '#D97706', bg: '#FFFBEB', emoji: '🎯', note: 'all-time' },
          { label: 'Inactive',        value: inactiveStudents,       color: '#6B7280', bg: '#F3F4F6', emoji: '💤', note: 'all-time' },
          { label: 'Trial → Active',  value: `${conversionRate}%`,   color: conversionRate >= 60 ? '#059669' : '#DC2626', bg: conversionRate >= 60 ? '#ECFDF5' : '#FEF2F2', emoji: '🔄', note: 'all-time' },
          { label: 'Paid Payments',   value: paidPayments.length,    color: '#2563EB', bg: '#EFF6FF', emoji: '💳', note: periodLabel },
          { label: 'Renewals',        value: renewalCount,           color: '#7C3AED', bg: '#F5F3FF', emoji: '🔁', note: periodLabel },
          { label: 'Avg Classes/Pay', value: avgClasses,             color: '#0891B2', bg: '#ECFEFF', emoji: '📦', note: periodLabel },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', marginBottom: '4px' }}>{s.emoji}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: s.color, marginTop: '2px', fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: '0.05em', opacity: 0.75 }}>{s.label}</div>
            <div style={{ fontSize: '9px', color: '#9CA3AF', marginTop: '2px' }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Revenue by currency */}
      <div style={card}>
        <div style={cardH()}>💰 Revenue by Currency · {periodLabel}</div>
        <div style={{ padding: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {Object.entries(revByCurrency).length === 0 && <p style={{ color: '#9CA3AF', margin: 0 }}>No paid payments in this period</p>}
          {Object.entries(revByCurrency).sort((a, b) => b[1] - a[1]).map(([cur, amt]) => (
            <div key={cur} style={{ background: '#0D1B2A', borderRadius: '14px', padding: '20px 28px', textAlign: 'center', minWidth: '140px' }}>
              <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{cur}</p>
              <p style={{ color: '#E8C97A', fontSize: '26px', fontWeight: '700', margin: 0 }}>{SYM[cur] ?? ''}{Number(amt).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
          ))}
        </div>
      </div>

      {/* MOM Analysis table */}
      <div style={card}>
        <div style={cardH('#0D1B2A', '#E8C97A')}>
          📊 Month-over-Month Analysis{isFiltered ? ` · ${selectedMonths.length} months` : ' · Last 6 Months'}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr>
                {['Month', 'Revenue', 'MOM', 'Paid Payments', 'MOM', 'New Students', 'MOM', 'Renewals', 'New Conversions', 'Sessions'].map((h, i) => (
                  <th key={i} style={thCell}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {momRows.map((row, i) => {
                const prev = momRows[i - 1]
                return (
                  <tr key={row.key} style={{ borderBottom: '1px solid #F3F4F6', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ ...cell, fontWeight: '700', color: '#111827', whiteSpace: 'nowrap' as const }}>{row.label}</td>
                    <td style={{ ...cell, fontWeight: '700', color: row.revenue > 0 ? '#059669' : '#9CA3AF' }}>
                      {row.revenue > 0 ? row.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}
                    </td>
                    <td style={cell}>{prev ? <MomDelta current={row.revenue} previous={prev.revenue} /> : <span style={{ color: '#9CA3AF', fontSize: '11px' }}>—</span>}</td>
                    <td style={{ ...cell, fontWeight: '600' }}>{row.payments || '—'}</td>
                    <td style={cell}>{prev ? <MomDelta current={row.payments} previous={prev.payments} /> : <span style={{ color: '#9CA3AF', fontSize: '11px' }}>—</span>}</td>
                    <td style={cell}>{row.newStudents || '—'}</td>
                    <td style={cell}>{prev ? <MomDelta current={row.newStudents} previous={prev.newStudents} /> : <span style={{ color: '#9CA3AF', fontSize: '11px' }}>—</span>}</td>
                    <td style={{ ...cell, color: '#7C3AED' }}>{row.renewals || '—'}</td>
                    <td style={{ ...cell, color: '#2563EB' }}>{row.newPay || '—'}</td>
                    <td style={cell}>{row.sessions || '—'}</td>
                  </tr>
                )
              })}
              {momRows.length === 0 && (
                <tr><td colSpan={10} style={{ ...cell, textAlign: 'center' as const, color: '#9CA3AF' }}>No data for selected period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment method + New vs Renewal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={card}>
          <div style={cardH()}>💳 Revenue by Payment Method · {periodLabel}</div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(revByMethod).sort((a, b) => b[1] - a[1]).map(([method, amt]) => (
              <div key={method} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', minWidth: '120px' }}>{method}</span>
                <Bar value={amt} max={maxRevMethod} color="#0D1B2A" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', minWidth: '70px', textAlign: 'right' as const }}>{amt.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
            {Object.keys(revByMethod).length === 0 && <p style={{ color: '#9CA3AF', margin: 0, fontSize: '13px' }}>No data for this period</p>}
          </div>
        </div>

        <div style={card}>
          <div style={cardH()}>🔁 New vs Renewal Payments · {periodLabel}</div>
          <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
            {[
              { label: 'New Conversions', value: newPayCount,  color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Renewals',        value: renewalCount, color: '#7C3AED', bg: '#F5F3FF' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '12px', padding: '20px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', fontWeight: '700', color: s.color, margin: 0 }}>{s.value}</p>
                <p style={{ fontSize: '12px', color: s.color, margin: '6px 0 0', fontWeight: '600', opacity: 0.75 }}>{s.label}</p>
                {paidPayments.length > 0 && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '4px 0 0' }}>{Math.round((s.value / paidPayments.length) * 100)}% of total</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Countries + Student status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={card}>
          <div style={cardH()}>🌍 Top 10 Countries by Students (All Time)</div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topCountries.map(([country, count]) => (
              <div key={country} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', minWidth: '140px' }}>{country}</span>
                <Bar value={count} max={maxCountry} color="#C9A84C" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', minWidth: '24px', textAlign: 'right' as const }}>{count}</span>
              </div>
            ))}
            {topCountries.length === 0 && <p style={{ color: '#9CA3AF', margin: 0, fontSize: '13px' }}>No country data</p>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={card}>
            <div style={cardH()}>🎓 Student Status (All Time)</div>
            <div style={{ padding: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' as const }}>
              {[
                { label: 'Active',   value: activeStudents,   color: '#059669', bg: '#ECFDF5' },
                { label: 'Trial',    value: trialStudents,    color: '#D97706', bg: '#FFFBEB' },
                { label: 'Inactive', value: inactiveStudents, color: '#6B7280', bg: '#F3F4F6' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '26px', fontWeight: '700', color: s.color, margin: 0 }}>{s.value}</p>
                  <p style={{ fontSize: '11px', color: s.color, margin: '4px 0 0', fontWeight: '600', opacity: 0.75 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={cardH()}>💸 Sales Commissions · {periodLabel}</div>
            <div style={{ padding: '20px', display: 'flex', gap: '12px' }}>
              {[
                { label: 'Pending Payout', value: pendingCommissions, color: '#D97706', bg: '#FFFBEB' },
                { label: 'Paid Out',       value: paidCommissions,    color: '#059669', bg: '#ECFDF5' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', fontWeight: '700', color: s.color, margin: 0 }}>{s.value.toFixed(2)}</p>
                  <p style={{ fontSize: '11px', color: s.color, margin: '4px 0 0', fontWeight: '600', opacity: 0.75 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Teacher stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div style={card}>
          <div style={cardH('#0D1B2A', '#E8C97A')}>🏆 Top Teachers by Hours · {periodLabel}</div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topTeachersByHours.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', minWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{t.name}</span>
                <Bar value={t.hours} max={maxTeacherH} color="#0D1B2A" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', minWidth: '55px', textAlign: 'right' as const }}>{t.hours.toFixed(1)}h</span>
                <span style={{ fontSize: '11px', color: '#6B7280', minWidth: '55px' }}>{t.students} students</span>
              </div>
            ))}
            {topTeachersByHours.length === 0 && <p style={{ color: '#9CA3AF', margin: 0, fontSize: '13px' }}>No session data</p>}
          </div>
        </div>

        <div style={card}>
          <div style={cardH('#0D1B2A', '#E8C97A')}>🎯 Teacher Trial Conversion (All Time)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Teacher','Trials','Converted','Rate'].map(h => <th key={h} style={thCell}>{h}</th>)}</tr></thead>
              <tbody>
                {teacherConversionData.map(t => {
                  const rate = t.trials > 0 ? Math.round((t.converted / t.trials) * 100) : 0
                  return (
                    <tr key={t.name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ ...cell, fontWeight: '600', color: '#111827' }}>{t.name}</td>
                      <td style={cell}>{t.trials}</td>
                      <td style={{ ...cell, color: '#059669', fontWeight: '600' }}>{t.converted}</td>
                      <td style={cell}>
                        <span style={{ background: rate >= 60 ? '#ECFDF5' : rate >= 40 ? '#FFFBEB' : '#FEF2F2', color: rate >= 60 ? '#059669' : rate >= 40 ? '#D97706' : '#DC2626', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {teacherConversionData.length === 0 && (
                  <tr><td colSpan={4} style={{ ...cell, textAlign: 'center' as const, color: '#9CA3AF' }}>No trial data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Suggestions */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '14px' }}>🤖 AI Business Suggestions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
          {suggestions.map((s, i) => (
            <div key={i} style={{ background: '#fff', border: `1.5px solid ${s.color}22`, borderLeft: `4px solid ${s.color}`, borderRadius: '12px', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <p style={{ fontWeight: '700', fontSize: '14px', color: s.color, margin: '0 0 6px 0' }}>{s.emoji} {s.title}</p>
              <p style={{ fontSize: '13px', color: '#374151', margin: 0, lineHeight: '1.6' }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
