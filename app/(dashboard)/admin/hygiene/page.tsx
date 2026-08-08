// app/(dashboard)/admin/hygiene/page.tsx
// Data Hygiene — reconciles what was SCHEDULED (calendar) against what teachers
// SUBMITTED (session logs) for a month, per teacher, and flags payroll risks.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const TZ = 'Africa/Cairo'
function cairoDate(iso: string): string {
  const p: any = {}
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))) p[x.type] = x.value
  return `${p.year}-${p.month}-${p.day}`
}

export default async function HygienePage({ searchParams }: { searchParams: { month?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin') redirect('/dashboard')

  const month = searchParams.month || monthKey(new Date())
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString()
  const end   = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString()
  const dFrom = `${month}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const dTo = `${month}-${String(lastDay).padStart(2, '0')}`

  const [{ data: teacherRows }, { data: cal }, { data: logs }] = await Promise.all([
    supabase.from('teachers').select('id, profile:profiles!teachers_user_id_fkey(name)'),
    supabase.from('calendar_sessions')
      .select('id, teacher_id, student_id, student_name, start_at, duration_minutes, status, google_event_id')
      .gte('start_at', start).lt('start_at', end).neq('status', 'cancelled'),
    supabase.from('sessions')
      .select('id, teacher_id, student_id, session_date, duration, attendance_status, session_type, student:students(name)')
      .gte('session_date', dFrom).lte('session_date', dTo).eq('attendance_status', 'attended'),
  ])

  const tName = new Map((teacherRows ?? []).map((t: any) => [t.id, (t.profile as any)?.name ?? 'Unknown']))
  const calRows = (cal ?? []) as any[]
  const logRows = (logs ?? []) as any[]

  // Index calendar bookings by teacher|student|cairoDate
  const calKeys = new Set<string>()
  const calDayCount = new Map<string, number>()
  for (const c of calRows) {
    const k = `${c.teacher_id}|${c.student_id ?? ''}|${cairoDate(c.start_at)}`
    calKeys.add(k)
    calDayCount.set(k, (calDayCount.get(k) ?? 0) + 1)
  }
  const logKeys = new Set(logRows.map(l => `${l.teacher_id}|${l.student_id ?? ''}|${l.session_date}`))

  // Per-teacher totals
  type Row = { id: string; name: string; calHrs: number; calN: number; logHrs: number; logN: number; unmatchedN: number; unmatchedHrs: number; missingN: number }
  const byT = new Map<string, Row>()
  const get = (id: string): Row => {
    if (!byT.has(id)) byT.set(id, { id, name: tName.get(id) ?? 'Unknown', calHrs: 0, calN: 0, logHrs: 0, logN: 0, unmatchedN: 0, unmatchedHrs: 0, missingN: 0 })
    return byT.get(id)!
  }
  for (const c of calRows) {
    const r = get(c.teacher_id); r.calHrs += (c.duration_minutes ?? 0) / 60; r.calN++
    const k = `${c.teacher_id}|${c.student_id ?? ''}|${cairoDate(c.start_at)}`
    if (!logKeys.has(k)) r.missingN++
  }
  const unmatchedList: { teacher: string; student: string; date: string; hrs: number; type: string }[] = []
  for (const l of logRows) {
    const r = get(l.teacher_id); r.logHrs += (l.duration ?? 0) / 60; r.logN++
    const k = `${l.teacher_id}|${l.student_id ?? ''}|${l.session_date}`
    if (!calKeys.has(k)) {
      r.unmatchedN++; r.unmatchedHrs += (l.duration ?? 0) / 60
      unmatchedList.push({ teacher: r.name, student: (l.student as any)?.name ?? '—', date: l.session_date, hrs: (l.duration ?? 0) / 60, type: l.session_type })
    }
  }
  const rows = Array.from(byT.values()).filter(r => r.calN > 0 || r.logN > 0)
    .sort((a, b) => Math.abs(b.logHrs - b.calHrs) - Math.abs(a.logHrs - a.calHrs))
  unmatchedList.sort((a, b) => a.date.localeCompare(b.date))

  // Duplicate bookings (same teacher+student+day booked more than once)
  const dupSlots = Array.from(calDayCount.entries()).filter(([, n]) => n > 1)
  const dupExtra = dupSlots.reduce((s, [, n]) => s + (n - 1), 0)

  // Google coverage: recurring occurrences share one master event
  const evCount = new Map<string, number>()
  for (const c of calRows) if (c.google_event_id) evCount.set(c.google_event_id, (evCount.get(c.google_event_id) ?? 0) + 1)
  const sharedRows = Array.from(evCount.values()).filter(n => n > 1).reduce((s, n) => s + n, 0)
  const noGoogle = calRows.filter(c => !c.google_event_id).length

  const tot = rows.reduce((a, r) => ({
    calHrs: a.calHrs + r.calHrs, logHrs: a.logHrs + r.logHrs,
    unmatchedHrs: a.unmatchedHrs + r.unmatchedHrs, unmatchedN: a.unmatchedN + r.unmatchedN, missingN: a.missingN + r.missingN,
  }), { calHrs: 0, logHrs: 0, unmatchedHrs: 0, unmatchedN: 0, missingN: 0 })

  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))

  const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }
  const h1 = (n: number) => n.toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>🧪 Data Hygiene — Scheduled vs Submitted</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
          Compares what was booked on the CRM calendar against the hours teachers submitted, so payroll matches reality.
        </p>
      </div>

      <form method="GET" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select name="month" defaultValue={month} style={{ padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', background: '#fff' }}>
          {months.map(mm => <option key={mm} value={mm}>{new Date(mm + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>)}
        </select>
        <button type="submit" style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Check</button>
      </form>

      {/* Headline numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' }}>
        {[
          { label: 'Scheduled (calendar)', value: `${h1(tot.calHrs)} h`, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Submitted (logged)', value: `${h1(tot.logHrs)} h`, color: '#059669', bg: '#ECFDF5' },
          { label: 'Difference', value: `${tot.logHrs >= tot.calHrs ? '+' : ''}${h1(tot.logHrs - tot.calHrs)} h`, color: tot.logHrs > tot.calHrs ? '#DC2626' : '#475569', bg: tot.logHrs > tot.calHrs ? '#FEF2F2' : '#F8FAFC' },
          { label: 'Logged w/o booking', value: `${tot.unmatchedN} (${h1(tot.unmatchedHrs)} h)`, color: tot.unmatchedN ? '#DC2626' : '#059669', bg: tot.unmatchedN ? '#FEF2F2' : '#ECFDF5' },
          { label: 'Booked, never logged', value: `${tot.missingN}`, color: '#D97706', bg: '#FFFBEB' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '10px', color: k.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, marginTop: '3px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Per teacher */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', background: '#0D1B2A' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>👩‍🏫 Per teacher — scheduled vs submitted</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Teacher', 'Scheduled', 'Submitted', 'Diff', 'Logged w/o booking', 'Booked, never logged'].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const diff = r.logHrs - r.calHrs
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{r.name}</td>
                    <td style={td}>{h1(r.calHrs)} h <span style={{ color: '#94A3B8', fontSize: '11px' }}>({r.calN})</span></td>
                    <td style={td}>{h1(r.logHrs)} h <span style={{ color: '#94A3B8', fontSize: '11px' }}>({r.logN})</span></td>
                    <td style={{ ...td, fontWeight: 700, color: diff > 0.01 ? '#DC2626' : diff < -0.01 ? '#D97706' : '#059669' }}>
                      {diff >= 0 ? '+' : ''}{h1(diff)} h
                    </td>
                    <td style={{ ...td, fontWeight: r.unmatchedN ? 700 : 400, color: r.unmatchedN ? '#DC2626' : '#94A3B8' }}>
                      {r.unmatchedN ? `${r.unmatchedN} (${h1(r.unmatchedHrs)} h)` : '—'}
                    </td>
                    <td style={{ ...td, color: r.missingN ? '#D97706' : '#94A3B8' }}>{r.missingN || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payroll risk detail */}
      <div style={{ background: '#fff', border: `1px solid ${unmatchedList.length ? '#FECACA' : '#E5E7EB'}`, borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', background: unmatchedList.length ? '#FEF2F2' : '#F8FAFC', fontWeight: 700, fontSize: '15px', color: unmatchedList.length ? '#DC2626' : '#475569' }}>
          ⚠️ Submitted with no calendar booking ({unmatchedList.length}) — review before paying
        </div>
        {unmatchedList.length === 0 ? (
          <div style={{ padding: '20px', color: '#059669', fontSize: '14px', textAlign: 'center' }}>None — every submitted session matches a booking ✅</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>{['Date', 'Teacher', 'Student', 'Type', 'Hours'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {unmatchedList.map((u, i) => (
                  <tr key={i}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(u.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{u.teacher}</td>
                    <td style={td}>{u.student}</td>
                    <td style={td}>{u.type}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{h1(u.hrs)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Calendar hygiene */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '18px 20px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A', marginBottom: '10px' }}>📅 Calendar hygiene</div>
        <ul style={{ margin: 0, paddingLeft: '18px', color: '#475569', fontSize: '13px', lineHeight: 1.9 }}>
          <li><strong>{dupExtra}</strong> duplicate booking{dupExtra === 1 ? '' : 's'} (same teacher + student booked twice on one day){dupExtra ? ' — likely double-counted' : ''}</li>
          <li><strong>{noGoogle}</strong> booking{noGoogle === 1 ? '' : 's'} with no Google Calendar event</li>
          <li><strong>{sharedRows}</strong> booking{sharedRows === 1 ? '' : 's'} are recurring occurrences that share a single Google event — these show far fewer entries in Google Calendar than in the CRM, so <em>Google&apos;s hour totals under-count recurring classes</em>. Use the CRM figures above for payroll.</li>
        </ul>
      </div>

      <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
        Matching is by teacher + student + Cairo date. &quot;Submitted&quot; counts only sessions marked attended. <Link href="/admin/sessions" style={{ color: '#2563EB' }}>Sessions</Link> lets you correct any wrong log.
      </p>
    </div>
  )
}
