// app/(dashboard)/admin/analytics/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminAnalyticsPage() {
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

  const allStudents  = students  ?? []
  const allPayments  = payments  ?? []
  const allSessions  = sessions  ?? []
  const allTeachers  = teachers  ?? []
  const allCommissions = commissions ?? []

  const paidPayments = allPayments.filter(p => p.status === 'paid')

  // ── Revenue by currency ──────────────────────────────────────────────────
  const revByCurrency: Record<string, number> = {}
  paidPayments.forEach(p => { revByCurrency[p.currency] = (revByCurrency[p.currency] ?? 0) + Number(p.amount) })

  // ── Revenue by payment method ────────────────────────────────────────────
  const revByMethod: Record<string, number> = {}
  paidPayments.forEach(p => {
    const m = p.payment_method || 'Unknown'
    revByMethod[m] = (revByMethod[m] ?? 0) + Number(p.amount)
  })

  // ── Students by country ──────────────────────────────────────────────────
  const byCountry: Record<string, number> = {}
  allStudents.forEach(s => { if (s.country) byCountry[s.country] = (byCountry[s.country] ?? 0) + 1 })
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)

  // ── Student status breakdown ─────────────────────────────────────────────
  const activeStudents = allStudents.filter(s => s.student_status === 'active').length
  const trialStudents  = allStudents.filter(s => s.student_status === 'trial').length
  const inactiveStudents = allStudents.filter(s => s.student_status === 'inactive').length

  // ── Trial conversion rate ────────────────────────────────────────────────
  const everHadTrial = allStudents.length
  const converted    = allStudents.filter(s => s.student_status === 'active').length
  const conversionRate = everHadTrial > 0 ? Math.round((converted / everHadTrial) * 100) : 0

  // ── Monthly revenue trend (last 6 months) ────────────────────────────────
  const now = new Date()
  const monthlyRevenue: { label: string; usd: number; gbp: number; eur: number; aed: number; egp: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleString('en-GB', { month: 'short', year: '2-digit' })
    const monthPaid = paidPayments.filter(p => {
      const pd = new Date(p.created_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    })
    monthlyRevenue.push({
      label,
      usd: monthPaid.filter(p => p.currency === 'USD').reduce((s, p) => s + Number(p.amount), 0),
      gbp: monthPaid.filter(p => p.currency === 'GBP').reduce((s, p) => s + Number(p.amount), 0),
      eur: monthPaid.filter(p => p.currency === 'EUR').reduce((s, p) => s + Number(p.amount), 0),
      aed: monthPaid.filter(p => p.currency === 'AED').reduce((s, p) => s + Number(p.amount), 0),
      egp: monthPaid.filter(p => p.currency === 'EGP').reduce((s, p) => s + Number(p.amount), 0),
    })
  }

  // ── Teacher stats ────────────────────────────────────────────────────────
  const teacherMap: Record<string, { name: string; hours: number; students: number; completedSessions: number }> = {}
  allTeachers.forEach(t => {
    const name = (t.profile as any)?.name ?? 'Unknown'
    teacherMap[t.id] = { name, hours: 0, students: 0, completedSessions: 0 }
  })
  allSessions.forEach(s => {
    if (teacherMap[s.teacher_id]) {
      teacherMap[s.teacher_id].completedSessions++
      teacherMap[s.teacher_id].hours += (s.duration ?? 60) / 60
    }
  })
  // Students per teacher
  allStudents.forEach(s => {
    if (s.assigned_teacher_id && teacherMap[s.assigned_teacher_id]) {
      teacherMap[s.assigned_teacher_id].students++
    }
  })
  const topTeachersByHours = Object.values(teacherMap).sort((a, b) => b.hours - a.hours).slice(0, 8)

  // ── Teacher trial conversion ─────────────────────────────────────────────
  // Trial sessions per teacher (status='trial') → students who became active
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

  // ── New students per month ───────────────────────────────────────────────
  const newStudentsByMonth: Record<string, number> = {}
  allStudents.forEach(s => {
    const d = new Date(s.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    newStudentsByMonth[key] = (newStudentsByMonth[key] ?? 0) + 1
  })

  // ── Renewals vs new payments ─────────────────────────────────────────────
  const renewalCount = paidPayments.filter(p => p.is_renewal).length
  const newPayCount  = paidPayments.filter(p => !p.is_renewal).length

  // ── Average classes per payment ──────────────────────────────────────────
  const avgClasses = paidPayments.length > 0
    ? Math.round(paidPayments.reduce((s, p) => s + (p.number_of_classes ?? 0), 0) / paidPayments.length)
    : 0

  // ── Commission summary ───────────────────────────────────────────────────
  const pendingCommissions = allCommissions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
  const paidCommissions    = allCommissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0)

  // ── AI Suggestions ───────────────────────────────────────────────────────
  const suggestions: { emoji: string; title: string; body: string; color: string }[] = []

  if (conversionRate < 50) suggestions.push({ emoji: '🎯', title: 'Low Trial Conversion Rate', body: `Only ${conversionRate}% of students converted from trial to active. Review teacher performance on trial sessions and consider a follow-up process within 24 hours of each trial.`, color: '#DC2626' })
  if (trialStudents > activeStudents * 0.3) suggestions.push({ emoji: '📞', title: 'High Trial Backlog', body: `You have ${trialStudents} students still in trial status. Assign a sales follow-up task to convert these — each unconverted trial is lost revenue.`, color: '#D97706' })
  if (inactiveStudents > activeStudents * 0.2) suggestions.push({ emoji: '🔄', title: 'Re-engagement Opportunity', body: `${inactiveStudents} students are inactive. A win-back campaign with a discounted renewal package could recover a portion of this segment.`, color: '#7C3AED' })
  if (renewalCount > 0 && renewalCount / paidPayments.length < 0.4) suggestions.push({ emoji: '💡', title: 'Improve Renewal Rate', body: `Only ${Math.round((renewalCount / paidPayments.length) * 100)}% of paid payments are renewals. Consider automated reminders 5 days before a student runs out of classes to prompt re-purchase.`, color: '#2563EB' })

  const topMethod = Object.entries(revByMethod).sort((a, b) => b[1] - a[1])[0]
  if (topMethod && Object.keys(revByMethod).length >= 3) {
    const topPct = Math.round((topMethod[1] / Object.values(revByMethod).reduce((s, v) => s + v, 0)) * 100)
    if (topPct > 60) suggestions.push({ emoji: '⚠️', title: 'Payment Method Concentration Risk', body: `${topPct}% of revenue flows through ${topMethod[0]}. If this method becomes unavailable, it would cause major disruption. Encourage students to add a backup payment option.`, color: '#EA580C' })
  }

  if (topCountries.length > 0) {
    const topCountry = topCountries[0]
    suggestions.push({ emoji: '🌍', title: `Strongest Market: ${topCountry[0]}`, body: `${topCountry[1]} students are from ${topCountry[0]}. Consider targeted Arabic language content or social media ads specifically for this market to accelerate growth where you already have traction.`, color: '#059669' })
  }

  if (avgClasses > 0 && avgClasses < 10) suggestions.push({ emoji: '📦', title: 'Upsell Larger Packages', body: `Average payment is for ${avgClasses} classes. Promoting 16–20 class packages with a per-class discount could increase revenue per transaction and reduce churn between renewals.`, color: '#0891B2' })

  if (pendingCommissions > 0) suggestions.push({ emoji: '💰', title: `Pending Sales Commissions: ${pendingCommissions.toFixed(2)}`, body: `${allCommissions.filter(c => c.status === 'pending').length} commissions worth ${pendingCommissions.toFixed(2)} are unpaid. Mark these as paid in Reports → Commissions to keep your sales team motivated.`, color: '#6B7280' })

  if (suggestions.length === 0) suggestions.push({ emoji: '✅', title: 'Business is Healthy', body: 'No major issues detected. Keep monitoring renewal rates and trial conversions as you scale.', color: '#059669' })

  // ─── Styles ──────────────────────────────────────────────────────────────
  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
  const cardH = (bg = '#F9FAFB', color = '#111827') => ({ padding: '14px 20px', background: bg, borderBottom: '1px solid #E5E7EB', fontWeight: '700' as const, fontSize: '15px', color })
  const cell  = { padding: '12px 16px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }
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

  const maxRevMethod = Math.max(...Object.values(revByMethod), 1)
  const maxCountry   = topCountries[0]?.[1] ?? 1
  const maxTeacherH  = Math.max(...topTeachersByHours.map(t => t.hours), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>Business Analytics</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>Live overview of all business metrics</p>
      </div>

      {/* Top KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Students', value: allStudents.length, color: '#0D1B2A', bg: '#F9FAFB', emoji: '👥' },
          { label: 'Active',         value: activeStudents,    color: '#059669', bg: '#ECFDF5', emoji: '✅' },
          { label: 'Trials',         value: trialStudents,     color: '#D97706', bg: '#FFFBEB', emoji: '🎯' },
          { label: 'Inactive',       value: inactiveStudents,  color: '#6B7280', bg: '#F3F4F6', emoji: '💤' },
          { label: 'Trial → Active', value: `${conversionRate}%`, color: conversionRate >= 60 ? '#059669' : '#DC2626', bg: conversionRate >= 60 ? '#ECFDF5' : '#FEF2F2', emoji: '🔄' },
          { label: 'Total Payments', value: paidPayments.length, color: '#2563EB', bg: '#EFF6FF', emoji: '💳' },
          { label: 'Renewals',       value: renewalCount,      color: '#7C3AED', bg: '#F5F3FF', emoji: '🔁' },
          { label: 'Avg Classes/Pay',value: avgClasses,        color: '#0891B2', bg: '#ECFEFF', emoji: '📦' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.emoji}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: s.color, marginTop: '3px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.75 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue by currency */}
      <div style={card}>
        <div style={cardH()}>💰 Revenue by Currency (Paid Payments)</div>
        <div style={{ padding: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {Object.entries(revByCurrency).length === 0 && <p style={{ color: '#9CA3AF', margin: 0 }}>No paid payments yet</p>}
          {Object.entries(revByCurrency).sort((a, b) => b[1] - a[1]).map(([cur, amt]) => (
            <div key={cur} style={{ background: '#0D1B2A', borderRadius: '14px', padding: '20px 28px', textAlign: 'center', minWidth: '140px' }}>
              <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cur}</p>
              <p style={{ color: '#E8C97A', fontSize: '26px', fontWeight: '700', margin: 0 }}>{SYM[cur] ?? ''}{Number(amt).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly revenue trend + renewals vs new */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Monthly trend */}
        <div style={card}>
          <div style={cardH()}>📈 Monthly Revenue Trend (Last 6 Months)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Month','USD','GBP','EUR','AED','EGP'].map(h => <th key={h} style={thCell}>{h}</th>)}</tr></thead>
              <tbody>
                {monthlyRevenue.map(m => (
                  <tr key={m.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ ...cell, fontWeight: '600', color: '#111827' }}>{m.label}</td>
                    {[m.usd, m.gbp, m.eur, m.aed, m.egp].map((v, i) => (
                      <td key={i} style={{ ...cell, color: v > 0 ? '#059669' : '#9CA3AF' }}>{v > 0 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* New vs renewals + payment mix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={card}>
            <div style={cardH()}>🔁 New vs Renewal Payments</div>
            <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
              {[
                { label: 'New', value: newPayCount, color: '#2563EB', bg: '#EFF6FF' },
                { label: 'Renewal', value: renewalCount, color: '#7C3AED', bg: '#F5F3FF' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: s.color, margin: 0 }}>{s.value}</p>
                  <p style={{ fontSize: '12px', color: s.color, margin: '4px 0 0', fontWeight: '600', opacity: 0.7 }}>{s.label} Payments</p>
                </div>
              ))}
            </div>
          </div>

          <div style={card}>
            <div style={cardH()}>💳 Revenue by Payment Method</div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(revByMethod).sort((a, b) => b[1] - a[1]).map(([method, amt]) => (
                <div key={method} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', minWidth: '120px' }}>{method}</span>
                  <Bar value={amt} max={maxRevMethod} color="#0D1B2A" />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', minWidth: '70px', textAlign: 'right' }}>{amt.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                </div>
              ))}
              {Object.keys(revByMethod).length === 0 && <p style={{ color: '#9CA3AF', margin: 0, fontSize: '13px' }}>No data yet</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Countries + Student status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        <div style={card}>
          <div style={cardH()}>🌍 Top 10 Countries by Students</div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topCountries.map(([country, count]) => (
              <div key={country} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', minWidth: '140px' }}>{country}</span>
                <Bar value={count} max={maxCountry} color="#C9A84C" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', minWidth: '24px', textAlign: 'right' }}>{count}</span>
              </div>
            ))}
            {topCountries.length === 0 && <p style={{ color: '#9CA3AF', margin: 0, fontSize: '13px' }}>No country data</p>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={card}>
            <div style={cardH()}>🎓 Student Status Breakdown</div>
            <div style={{ padding: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
            <div style={cardH()}>💸 Sales Commissions</div>
            <div style={{ padding: '20px', display: 'flex', gap: '12px' }}>
              {[
                { label: 'Pending Payout', value: pendingCommissions, color: '#D97706', bg: '#FFFBEB' },
                { label: 'Total Paid Out', value: paidCommissions,    color: '#059669', bg: '#ECFDF5' },
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
          <div style={cardH('#0D1B2A', '#E8C97A')}>🏆 Top Teachers by Hours Delivered</div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topTeachersByHours.map(t => (
              <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151', minWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <Bar value={t.hours} max={maxTeacherH} color="#0D1B2A" />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827', minWidth: '60px', textAlign: 'right' }}>{t.hours.toFixed(1)}h</span>
                <span style={{ fontSize: '11px', color: '#6B7280', minWidth: '60px' }}>{t.students} students</span>
              </div>
            ))}
            {topTeachersByHours.length === 0 && <p style={{ color: '#9CA3AF', margin: 0, fontSize: '13px' }}>No session data</p>}
          </div>
        </div>

        <div style={card}>
          <div style={cardH('#0D1B2A', '#E8C97A')}>🎯 Teacher Trial Conversion</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Teacher','Trials','Converted','Rate'].map(h => <th key={h} style={thCell}>{h}</th>)}</tr>
              </thead>
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
                  <tr><td colSpan={4} style={{ ...cell, textAlign: 'center', color: '#9CA3AF' }}>No trial data yet</td></tr>
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
