// app/(dashboard)/admin/teachers/breakdown/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function getMonthRange(param?: string | null) {
  const now = new Date()
  const base = param ? new Date(`${param}-01`) : new Date(now.getFullYear(), now.getMonth(), 1)
  const start = new Date(base.getFullYear(), base.getMonth(), 1)
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: `${end.toISOString().split('T')[0]}T23:59:59`,
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    param: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`,
    prevParam: (() => { const d = new Date(base.getFullYear(), base.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })(),
    nextParam: (() => { const d = new Date(base.getFullYear(), base.getMonth() + 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })(),
  }
}

export default async function TeachersBreakdownPage({
  searchParams
}: { searchParams?: { month?: string; tab?: string } }) {
  const supabase = createClient()
  const { start, end, label, param, prevParam, nextParam } = getMonthRange(searchParams?.month)
  const activeTab = searchParams?.tab ?? 'paid'

  const { data: teachers } = await supabase
    .from('teachers')
    .select(`
      id, rate_per_session_usd, user_id,
      profile:profiles!teachers_user_id_fkey(name),
      sessions(
        id, session_type, attendance_status, session_date,
        duration, trial_status,
        student:students(id, name, email, student_status, currency)
      )
    `)
    .eq('is_active', true)
    .order('id')

  type SessionRow = { id: string; session_type: string; attendance_status: string; session_date: string; duration: number; trial_status: string; student: any }
  type TeacherRow = { id: string; rate_per_session_usd: number; profile: any; sessions: SessionRow[] }

  const rows = (teachers ?? []).map((t: any) => {
    const allS: SessionRow[] = (t.sessions ?? []).filter((s: SessionRow) =>
      s.session_date >= start && s.session_date <= end.split('T')[0]
    )

    const paidSessions = allS.filter(s =>
      s.session_type === 'paid' && (s.attendance_status === 'attended' || s.attendance_status === 'no-show')
    )
    const trialSessions = allS.filter(s =>
      s.session_type === 'trial' && (s.attendance_status === 'attended' || s.attendance_status === 'no-show')
    )
    const convertedTrials = trialSessions.filter(s => s.student?.student_status === 'active')
    const pendingTrials = trialSessions.filter(s => s.student?.student_status === 'trial')
    const cancelledSessions = allS.filter(s => s.attendance_status === 'cancelled')
    const scheduledSessions = allS.filter(s => s.attendance_status === 'scheduled')

    const paidEarnings = paidSessions.reduce((acc, s) =>
      acc + Number(t.rate_per_session_usd) * ((s.duration ?? 60) / 60), 0)
    const trialEarnings = convertedTrials.reduce((acc, s) =>
      acc + ((s.duration ?? 60) >= 60 ? 5 : 3), 0)
    const totalEarnings = paidEarnings + trialEarnings

    return {
      id: t.id,
      name: t.profile?.name ?? '—',
      rate: Number(t.rate_per_session_usd),
      paidSessions,
      trialSessions,
      convertedTrials,
      pendingTrials,
      cancelledSessions,
      scheduledSessions,
      paidEarnings,
      trialEarnings,
      totalEarnings,
    }
  }).filter(t => t.paidSessions.length + t.trialSessions.length + t.cancelledSessions.length + t.scheduledSessions.length > 0)
  .sort((a, b) => b.totalEarnings - a.totalEarnings)

  const TABS = [
    { key: 'paid',      label: 'Paid Sessions' },
    { key: 'trials',    label: 'All Trials' },
    { key: 'converted', label: 'Converted Trials' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'scheduled', label: 'Upcoming' },
  ]

  const cell = { padding: '10px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }
  const hdr  = { padding: '10px 14px', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB', whiteSpace: 'nowrap' as const }

  function SessionsTable({ sessions, rate }: { sessions: SessionRow[]; rate: number }) {
    if (!sessions.length) return <p style={{ padding: '20px', color: '#9CA3AF', textAlign: 'center' }}>No sessions this month</p>
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date', 'Student', 'Status', 'Duration', 'Type', 'Student Status', 'Earnings'].map(h => (
                <th key={h} style={hdr}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.sort((a, b) => b.session_date.localeCompare(a.session_date)).map(s => {
              const earn = s.session_type === 'trial'
                ? (s.student?.student_status === 'active' ? ((s.duration ?? 60) >= 60 ? 5 : 3) : 0)
                : rate * ((s.duration ?? 60) / 60)
              return (
                <tr key={s.id}>
                  <td style={cell}>{new Date(s.session_date).toLocaleDateString('en-GB')}</td>
                  <td style={{ ...cell, fontWeight: '600', color: '#111827' }}>{s.student?.name ?? '—'}</td>
                  <td style={cell}>
                    <span style={{ background: s.attendance_status === 'attended' ? '#ECFDF5' : s.attendance_status === 'no-show' ? '#FEF2F2' : s.attendance_status === 'cancelled' ? '#F3F4F6' : '#EFF6FF', color: s.attendance_status === 'attended' ? '#059669' : s.attendance_status === 'no-show' ? '#DC2626' : s.attendance_status === 'cancelled' ? '#6B7280' : '#2563EB', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {s.attendance_status}
                    </span>
                  </td>
                  <td style={cell}>{s.duration ?? 60} min</td>
                  <td style={cell}>
                    <span style={{ background: s.session_type === 'trial' ? '#FFF7ED' : '#F0FDF4', color: s.session_type === 'trial' ? '#C2410C' : '#16A34A', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {s.session_type}
                    </span>
                  </td>
                  <td style={cell}>
                    <span style={{ background: s.student?.student_status === 'active' ? '#ECFDF5' : '#FFF7ED', color: s.student?.student_status === 'active' ? '#059669' : '#C2410C', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {s.student?.student_status ?? '—'}
                    </span>
                  </td>
                  <td style={{ ...cell, fontWeight: '700', color: earn > 0 ? '#059669' : '#9CA3AF' }}>
                    {earn > 0 ? `$${earn.toFixed(2)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header + Month Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/admin/teachers" style={{ color: '#6B7280', textDecoration: 'none', fontSize: '13px' }}>← Teachers</Link>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Teacher Breakdown</h1>
          </div>
          <p style={{ color: '#6B7280', fontSize: '13px', marginTop: '4px' }}>Detailed session breakdown per teacher</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '6px 10px' }}>
          <Link href={`?month=${prevParam}`} style={{ padding: '6px 12px', background: '#F3F4F6', borderRadius: '8px', textDecoration: 'none', color: '#374151', fontWeight: '600', fontSize: '13px' }}>‹</Link>
          <span style={{ fontWeight: '700', color: '#111827', fontSize: '14px', minWidth: '130px', textAlign: 'center' }}>{label}</span>
          <Link href={`?month=${nextParam}`} style={{ padding: '6px 12px', background: '#F3F4F6', borderRadius: '8px', textDecoration: 'none', color: '#374151', fontWeight: '600', fontSize: '13px' }}>›</Link>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Active Teachers', value: rows.length, color: '#2563EB' },
          { label: 'Paid Sessions', value: rows.reduce((a, t) => a + t.paidSessions.length, 0), color: '#059669' },
          { label: 'Trials Total', value: rows.reduce((a, t) => a + t.trialSessions.length, 0), color: '#D97706' },
          { label: 'Converted Trials', value: rows.reduce((a, t) => a + t.convertedTrials.length, 0), color: '#0891B2' },
          { label: 'Total Earnings', value: `$${rows.reduce((a, t) => a + t.totalEarnings, 0).toFixed(2)}`, color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Per-teacher breakdown */}
      {rows.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#9CA3AF' }}>No sessions found for {label}</div>
      ) : (
        rows.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            {/* Teacher header */}
            <div style={{ background: '#0D1B2A', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontWeight: '700', fontSize: '14px' }}>
                  {t.name[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '700', fontSize: '15px' }}>{t.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>${t.rate}/hr rate</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Paid', value: t.paidSessions.length, color: '#A7F3D0', bg: 'rgba(5,150,105,0.2)' },
                  { label: 'Trials', value: t.trialSessions.length, color: '#FDE68A', bg: 'rgba(217,119,6,0.2)' },
                  { label: 'Converted', value: t.convertedTrials.length, color: '#BAE6FD', bg: 'rgba(8,145,178,0.2)' },
                  { label: 'Cancelled', value: t.cancelledSessions.length, color: '#E5E7EB', bg: 'rgba(107,114,128,0.2)' },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: '8px', padding: '6px 12px', textAlign: 'center' }}>
                    <div style={{ color: s.color, fontWeight: '700', fontSize: '16px' }}>{s.value}</div>
                    <div style={{ color: s.color, fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  </div>
                ))}
                <div style={{ background: 'rgba(201,168,76,0.2)', borderRadius: '8px', padding: '6px 16px', textAlign: 'center' }}>
                  <div style={{ color: '#E8C97A', fontWeight: '700', fontSize: '16px' }}>${t.totalEarnings.toFixed(2)}</div>
                  <div style={{ color: '#E8C97A', fontSize: '10px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earnings</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
              {TABS.map(tab => (
                <Link key={tab.key}
                  href={`?month=${param}&tab=${tab.key}`}
                  style={{ padding: '10px 18px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap', borderBottom: activeTab === tab.key ? '2px solid #0D1B2A' : '2px solid transparent', color: activeTab === tab.key ? '#0D1B2A' : '#6B7280', background: activeTab === tab.key ? '#F9FAFB' : 'transparent' }}>
                  {tab.label}
                  <span style={{ marginLeft: '6px', background: '#F3F4F6', color: '#374151', padding: '1px 7px', borderRadius: '20px', fontSize: '11px' }}>
                    {tab.key === 'paid' ? t.paidSessions.length
                     : tab.key === 'trials' ? t.trialSessions.length
                     : tab.key === 'converted' ? t.convertedTrials.length
                     : tab.key === 'cancelled' ? t.cancelledSessions.length
                     : t.scheduledSessions.length}
                  </span>
                </Link>
              ))}
            </div>

            {/* Tab content */}
            <div>
              <SessionsTable
                sessions={
                  activeTab === 'paid' ? t.paidSessions
                  : activeTab === 'trials' ? t.trialSessions
                  : activeTab === 'converted' ? t.convertedTrials
                  : activeTab === 'cancelled' ? t.cancelledSessions
                  : t.scheduledSessions
                }
                rate={t.rate}
              />
              {activeTab === 'converted' && t.convertedTrials.length > 0 && (
                <div style={{ padding: '10px 16px', background: '#F0FDF4', borderTop: '1px solid #BBF7D0', fontSize: '13px', color: '#059669', fontWeight: '600' }}>
                  Trial earnings this month: ${t.trialEarnings.toFixed(2)} ({t.convertedTrials.length} session{t.convertedTrials.length !== 1 ? 's' : ''} × fixed rate)
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
