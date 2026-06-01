// app/(dashboard)/admin/reports/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

async function getEGPRate(): Promise<number> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 3600 } })
    const data = await res.json()
    return data?.rates?.EGP ?? 48.5
  } catch { return 48.5 }
}

export default async function AdminReportsPage({
  searchParams
}: { searchParams?: { month?: string } }) {
  const supabase = createClient()
  const now = new Date()

  // Month range
  const base = searchParams?.month ? new Date(`${searchParams.month}-01`) : new Date(now.getFullYear(), now.getMonth(), 1)
  const reportStart = new Date(base.getFullYear(), base.getMonth(), 1).toISOString().split('T')[0]
  const reportEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0).toISOString().split('T')[0]
  const reportLabel = base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const reportParam = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`
  const prevParam = (() => { const d = new Date(base.getFullYear(), base.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
  const nextParam = (() => { const d = new Date(base.getFullYear(), base.getMonth() + 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { label: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }), start: d.toISOString().split('T')[0], end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] }
  }).reverse()

  const [
    { data: allPayments },
    { data: allSessions },
    { data: allStudents },
    { data: teachers },
    egpRate,
    { data: commissions },
  ] = await Promise.all([
    supabase.from('payments').select('amount, currency, status, created_at, payment_date').gte('created_at', `${reportStart}T00:00:00`).lte('created_at', `${reportEnd}T23:59:59`),
    supabase.from('sessions').select('id, session_type, attendance_status, session_date, trial_status, duration').gte('session_date', reportStart).lte('session_date', reportEnd),
    supabase.from('students').select('id, name, student_status, created_at, currency, payment_status, total_paid_classes, consumed_classes, added_by_sales:profiles!students_added_by_sales_id_fkey(id, name)'),
    supabase.from('teachers').select('id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name), sessions(id, attendance_status, session_type, session_date, duration, student:students(student_status))').eq('is_active', true).gte('sessions.session_date', reportStart).lte('sessions.session_date', reportEnd),
    getEGPRate(),
    supabase.from('commissions').select('amount, currency, status, created_at, sales_user:profiles!commissions_sales_user_id_fkey(name), student:students(name)').gte('created_at', `${reportStart}T00:00:00`).lte('created_at', `${reportEnd}T23:59:59`).order('created_at', { ascending: false }),
  ])


  const totalStudents = allStudents?.length ?? 0
  const activeStudents = allStudents?.filter(s => s.student_status === 'active').length ?? 0
  const trialStudents = allStudents?.filter(s => s.student_status === 'trial').length ?? 0
  const totalSessions = allSessions?.length ?? 0
  const attendedSessions = allSessions?.filter(s => s.attendance_status === 'attended' || s.attendance_status === 'no-show').length ?? 0
  const noShows = allSessions?.filter(s => s.attendance_status === 'no-show').length ?? 0
  const trialsConverted = allSessions?.filter(s => s.trial_status === 'converted').length ?? 0
  const trialsLost = allSessions?.filter(s => s.trial_status === 'lost').length ?? 0
  const conversionRate = trialsConverted + trialsLost > 0 ? Math.round((trialsConverted / (trialsConverted + trialsLost)) * 100) : 0

  const totalRevenue = { USD: 0, GBP: 0, EUR: 0, AED: 0 }
  allPayments?.filter(p => p.status === 'paid').forEach((p: any) => {
    totalRevenue[p.currency as keyof typeof totalRevenue] = (totalRevenue[p.currency as keyof typeof totalRevenue] || 0) + Number(p.amount)
  })

  const totalTeacherCost = (teachers ?? []).reduce((acc: number, t: any) => {
    return acc + (t.sessions ?? [])
      .filter((s: any) =>
        s.session_date >= reportStart && s.session_date <= reportEnd &&
        (s.attendance_status === 'attended' || s.attendance_status === 'no-show') &&
        (s.session_type === 'paid' || s.session_type === 'trial')
      )
      .reduce((sum: number, s: any) => {
        if (s.session_type === 'trial') {
          if (s.student?.student_status !== 'active' || s.student?.payment_status !== 'paid') return sum
          return sum + ((s.duration ?? 60) >= 60 ? 5 : 3)
        }
        return sum + Number(t.rate_per_session_usd) * ((s.duration ?? 60) / 60)
      }, 0)
  }, 0)


  // Students grouped by sales agent
  const studentsByAgent = (allStudents ?? []).reduce((acc: Record<string, any>, s: any) => {
    const agentId = s.added_by_sales?.id ?? 'unassigned'
    const agentName = s.added_by_sales?.name ?? 'Unassigned'
    if (!acc[agentId]) acc[agentId] = { name: agentName, students: [] }
    acc[agentId].students.push(s)
    return acc
  }, {})
  const agentRows = Object.values(studentsByAgent).sort((a: any, b: any) => b.students.length - a.students.length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Reports & Analytics</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{reportLabel}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '6px 10px' }}>
          <Link href={`?month=${prevParam}`} style={{ padding: '6px 12px', background: '#F3F4F6', borderRadius: '8px', textDecoration: 'none', color: '#374151', fontWeight: '600', fontSize: '13px' }}>‹</Link>
          <span style={{ fontWeight: '700', color: '#111827', fontSize: '14px', minWidth: '130px', textAlign: 'center' }}>{reportLabel}</span>
          <Link href={`?month=${nextParam}`} style={{ padding: '6px 12px', background: '#F3F4F6', borderRadius: '8px', textDecoration: 'none', color: '#374151', fontWeight: '600', fontSize: '13px' }}>›</Link>
        </div>
      </div>

      {/* Student Stats */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#374151', margin: '0 0 12px 0' }}>👥 Students</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Total Students', value: totalStudents, color: '#2563EB', bg: '#EFF6FF' },
            { label: 'Active', value: activeStudents, color: '#059669', bg: '#ECFDF5' },
            { label: 'Trial', value: trialStudents, color: '#D97706', bg: '#FFFBEB' },
            { label: 'Inactive', value: totalStudents - activeStudents - trialStudents, color: '#6B7280', bg: '#F3F4F6' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
              <p style={{ fontSize: '26px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Session Stats */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#374151', margin: '0 0 12px 0' }}>📅 Sessions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Total Sessions', value: totalSessions, color: '#7C3AED', bg: '#F3E8FF' },
            { label: 'Attended', value: attendedSessions, color: '#059669', bg: '#ECFDF5' },
            { label: 'No-Shows', value: noShows, color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Trials Converted', value: trialsConverted, color: '#059669', bg: '#ECFDF5' },
            { label: 'Trials Lost', value: trialsLost, color: '#DC2626', bg: '#FEF2F2' },
            { label: 'Conversion Rate', value: `${conversionRate}%`, color: '#2563EB', bg: '#EFF6FF' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
              <p style={{ fontSize: '26px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#374151', margin: '0 0 12px 0' }}>💰 Revenue (All Time)</h2>
        <div style={{ background: '#0D1B2A', borderRadius: '14px', padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '20px' }}>
            {[
              { cur: 'USD', sym: '$', val: totalRevenue.USD, flag: '🇺🇸' },
              { cur: 'GBP', sym: '£', val: totalRevenue.GBP, flag: '🇬🇧' },
              { cur: 'EUR', sym: '€', val: totalRevenue.EUR, flag: '🇪🇺' },
              { cur: 'AED', sym: 'AED ', val: totalRevenue.AED, flag: '🇦🇪' },
            ].map(r => (
              <div key={r.cur}>
                <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0' }}>{r.flag} {r.cur}</p>
                <p style={{ color: '#E8C97A', fontSize: '22px', fontWeight: '700', margin: 0 }}>{r.sym}{r.val.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '16px', paddingTop: '16px', display: 'flex', gap: '32px' }}>
            <div>
              <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0' }}>Total Teacher Cost (USD)</p>
              <p style={{ color: '#FC8181', fontSize: '18px', fontWeight: '700', margin: 0 }}>−${totalTeacherCost.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '0 0 4px 0' }}>Live EGP Rate</p>
              <p style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 }}>1 USD = {egpRate.toFixed(2)} EGP</p>
            </div>
          </div>
        </div>
      </div>

      {/* Teacher performance */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#374151', margin: '0 0 12px 0' }}>👩‍🏫 Teacher Performance (All Time)</h2>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F9FAFB' }}>
                {['Teacher','Total Sessions','Paid Attended','Trials','Rate/Session','Total Earned (USD)','Total Earned (EGP)'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(teachers ?? []).map((t: any) => {
                  const allS = (t.sessions ?? []).filter((s: any) => s.session_date >= reportStart && s.session_date <= reportEnd)
                  const paidSessionsArr = allS.filter((s: any) => s.session_type === 'paid' && (s.attendance_status === 'attended' || s.attendance_status === 'no-show'))
                  const paid = paidSessionsArr.length
                  const trialSessionsArr = allS.filter((s: any) => s.session_type === 'trial' && (s.attendance_status === 'attended' || s.attendance_status === 'no-show') && s.student?.student_status === 'active' && s.student?.payment_status === 'paid')
                  const trials = trialSessionsArr.length
                  const earned = paidSessionsArr.reduce((sum: number, s: any) => sum + Number(t.rate_per_session_usd) * ((s.duration ?? 60) / 60), 0)
                    + trialSessionsArr.reduce((sum: number, s: any) => sum + ((s.duration ?? 60) >= 60 ? 5 : 3), 0)
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{t.profile?.name}</td>
                      <td style={{ padding: '14px 16px', color: '#374151', textAlign: 'center' }}>{allS.length}</td>
                      <td style={{ padding: '14px 16px', color: '#059669', fontWeight: '700', textAlign: 'center' }}>{paid}</td>
                      <td style={{ padding: '14px 16px', color: '#2563EB', textAlign: 'center' }}>{trials}</td>
                      <td style={{ padding: '14px 16px', color: '#374151' }}>${Number(t.rate_per_session_usd).toFixed(2)}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#111827' }}>${earned.toFixed(2)}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#059669' }}>EGP {Math.round(earned * egpRate).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Students by Sales Agent */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>👥 Students by Sales Agent</h2>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{(allStudents ?? []).length} total students</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {agentRows.map((agent: any) => {
            const active = agent.students.filter((s: any) => s.student_status === 'active').length
            const trial = agent.students.filter((s: any) => s.student_status === 'trial').length
            const inactive = agent.students.filter((s: any) => s.student_status === 'inactive').length
            const pendingPay = agent.students.filter((s: any) => s.payment_status === 'pending').length
            return (
              <details key={agent.name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                <summary style={{ padding: '14px 20px', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '14px', userSelect: 'none' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>
                    {agent.name[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: '700', color: '#111827', fontSize: '14px', flex: 1 }}>{agent.name}</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#ECFDF5', color: '#059669', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{active} active</span>
                    <span style={{ background: '#FFF7ED', color: '#C2410C', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{trial} trial</span>
                    <span style={{ background: '#F3F4F6', color: '#6B7280', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{inactive} inactive</span>
                    {pendingPay > 0 && <span style={{ background: '#FEF2F2', color: '#DC2626', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{pendingPay} pending payment</span>}
                    <span style={{ background: '#F0F9FF', color: '#0369A1', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{agent.students.length} total ▾</span>
                  </div>
                </summary>
                <div style={{ padding: '0 20px 16px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        {['Name', 'Status', 'Payment', 'Classes Remaining', 'Currency', 'Joined'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agent.students.map((s: any) => {
                        const remaining = (s.total_paid_classes ?? 0) - (s.consumed_classes ?? 0)
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#111827' }}>{s.name}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                background: s.student_status === 'active' ? '#ECFDF5' : s.student_status === 'trial' ? '#FFF7ED' : '#F3F4F6',
                                color: s.student_status === 'active' ? '#059669' : s.student_status === 'trial' ? '#C2410C' : '#6B7280',
                                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize'
                              }}>{s.student_status}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{
                                background: s.payment_status === 'pending' ? '#FEF2F2' : '#ECFDF5',
                                color: s.payment_status === 'pending' ? '#DC2626' : '#059669',
                                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize'
                              }}>{s.payment_status ?? '—'}</span>
                            </td>
                            <td style={{ padding: '8px 12px', color: remaining <= 0 ? '#DC2626' : remaining <= 2 ? '#D97706' : '#374151', fontWeight: remaining <= 2 ? '700' : '400' }}>
                              {remaining <= 0 ? '⚠️ 0' : remaining}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#6B7280' }}>{s.currency}</td>
                            <td style={{ padding: '8px 12px', color: '#9CA3AF' }}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </div>
      </div>

      {/* Sales Commissions */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>💰 Sales Commissions</h2>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{(commissions ?? []).length} total records</span>
        </div>
        {(() => {
          const byAgent = (commissions ?? []).reduce((acc: Record<string, any>, c: any) => {
            const name = c.sales_user?.name ?? 'Unknown'
            if (!acc[name]) acc[name] = { name, count: 0, total: 0, currency: c.currency ?? 'USD', pending: 0, paid: 0 }
            acc[name].count++
            acc[name].total += Number(c.amount)
            if (c.status === 'pending') acc[name].pending++
            else acc[name].paid++
            return acc
          }, {})
          const rows = Object.values(byAgent).sort((a: any, b: any) => b.total - a.total)
          if (!rows.length) return <p style={{ padding: '24px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>No commissions this period</p>
            return (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Agent', 'Conversions', 'Commission Earned', 'Paid Out', 'Pending'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '13px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{r.name}</td>
                    <td style={{ padding: '13px 16px', color: '#374151', fontSize: '13px' }}>{r.count}</td>
                    <td style={{ padding: '13px 16px', fontWeight: '700', color: '#059669', fontSize: '14px' }}>{r.currency} {r.total.toFixed(2)}</td>
                    <td style={{ padding: '13px 16px', color: '#059669', fontSize: '13px' }}>{r.paid}</td>
                    <td style={{ padding: '13px 16px' }}>
                      {r.pending > 0
                        ? <span style={{ background: '#FFF7ED', color: '#C2410C', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{r.pending}</span>
                        : <span style={{ color: '#9CA3AF', fontSize: '12px' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </div>
    </div>
  )
}
