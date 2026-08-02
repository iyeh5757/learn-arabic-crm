// app/(dashboard)/admin/rereach/page.tsx
// Trial Re-reach: every customer who trialed but never paid — including
// inactive ones — so the team can contact them again.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FollowupsButton, MarkInactiveButton, ReactivateButton } from '../reminders/RetentionActions'

export default async function RereachPage({
  searchParams,
}: { searchParams: { rep?: string; status?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const repFilter = searchParams.rep || ''
  const statusFilter = searchParams.status || ''

  const [{ data: students }, { data: paidRows }, { data: trialSessions }, { data: reps }] = await Promise.all([
    supabase.from('students')
      .select('id, name, email, phone, country, student_status, payment_status, created_at, recontact_date, inactive_reason, added_by_sales_id, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name)), added_by_sales:profiles!students_added_by_sales_id_fkey(name)')
      .neq('payment_status', 'paid'),
    supabase.from('payments').select('student_id').eq('status', 'paid'),
    supabase.from('sessions').select('student_id, session_date').eq('session_type', 'trial').order('session_date'),
    supabase.from('profiles').select('id, name').eq('role', 'sales').order('name'),
  ])

  const paidIds = new Set((paidRows ?? []).map((p: any) => p.student_id))

  // Latest trial date per student (they may have had several)
  const trialDate = new Map<string, string>()
  for (const s of (trialSessions ?? []) as any[]) trialDate.set(s.student_id, s.session_date)

  let list = (students ?? []).filter((s: any) => !paidIds.has(s.id))
  if (repFilter) list = list.filter((s: any) => s.added_by_sales_id === repFilter)
  if (statusFilter) list = list.filter((s: any) => s.student_status === statusFilter)

  // Most recent trials first; students without a logged trial at the end
  list.sort((a: any, b: any) => (trialDate.get(b.id) ?? '').localeCompare(trialDate.get(a.id) ?? ''))

  const counts = {
    total: list.length,
    trial: list.filter((s: any) => s.student_status === 'trial').length,
    inactive: list.filter((s: any) => s.student_status === 'inactive').length,
  }

  const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }
  const inp: React.CSSProperties = { padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', background: '#fff' }
  const badge = (s: string) => {
    const map: Record<string, { bg: string; c: string }> = {
      trial: { bg: '#FFF7ED', c: '#C2410C' }, inactive: { bg: '#F1F5F9', c: '#475569' }, active: { bg: '#ECFDF5', c: '#059669' },
    }
    const m = map[s] ?? { bg: '#F3F4F6', c: '#374151' }
    return <span style={{ background: m.bg, color: m.c, padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize' }}>{s}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>🔁 Trial Re-reach</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
          Everyone who trialed but never paid — including inactive students — sorted by most recent trial. Reach out and win them back.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
        {[
          { label: 'To re-reach', value: counts.total, color: '#0F172A', bg: '#F8FAFC' },
          { label: 'Still marked trial', value: counts.trial, color: '#C2410C', bg: '#FFF7ED' },
          { label: 'Marked inactive', value: counts.inactive, color: '#475569', bg: '#F1F5F9' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '18px', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '11px', color: k.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, marginTop: '2px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="GET" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select name="rep" defaultValue={repFilter} style={{ ...inp, minWidth: '180px' }}>
          <option value="">All sales reps</option>
          {(reps ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter} style={inp}>
          <option value="">All statuses</option>
          <option value="trial">Trial</option>
          <option value="inactive">Inactive</option>
          <option value="active">Active (unpaid)</option>
        </select>
        <button type="submit" style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Apply</button>
        {(repFilter || statusFilter) && (
          <Link href="/admin/rereach" style={{ background: '#F1F5F9', color: '#475569', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>Clear</Link>
        )}
      </form>

      {/* List */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: '40px', color: '#9CA3AF', fontSize: '14px', textAlign: 'center' }}>No one to re-reach 🎉</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Student', 'Trial Date', 'Status', 'Phone', 'Country', 'Teacher', 'Sales', 'Recontact', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((s: any) => {
                  const t = trialDate.get(s.id)
                  const phoneDigits = (s.phone ?? '').replace(/\D/g, '')
                  return (
                    <tr key={s.id}>
                      <td style={{ ...td, fontWeight: 600, color: '#111827' }}>
                        {s.name}
                        {s.email && <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 400 }}>{s.email}</div>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : <span style={{ color: '#CBD5E1' }}>no trial logged</span>}
                      </td>
                      <td style={td}>{badge(s.student_status)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {s.phone ?? '—'}
                        {phoneDigits && (
                          <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', textDecoration: 'none', fontSize: '12px' }} title="Open WhatsApp chat">💬</a>
                        )}
                      </td>
                      <td style={td}>{s.country ?? '—'}</td>
                      <td style={td}>{(s.assigned_teacher as any)?.profile?.name ?? '—'}</td>
                      <td style={td}>{(s.added_by_sales as any)?.name ?? '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: s.recontact_date && s.recontact_date <= new Date().toISOString().slice(0, 10) ? '#B45309' : '#374151' }}>
                        {s.recontact_date ? new Date(s.recontact_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td style={td}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <Link href={`/admin/students/${s.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>Edit</Link>
                          <FollowupsButton studentId={s.id} name={s.name} />
                          {s.student_status === 'inactive'
                            ? <ReactivateButton studentId={s.id} />
                            : <MarkInactiveButton studentId={s.id} name={s.name} />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
