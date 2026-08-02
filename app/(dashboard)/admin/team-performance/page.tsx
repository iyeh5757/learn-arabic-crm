// app/(dashboard)/admin/team-performance/page.tsx
// Team Performance — sales salary table. A sales rep earns commission ONCE per
// student: on the student's FIRST paid payment. Renewals never pay commission.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export default async function TeamPerformancePage({
  searchParams,
}: { searchParams: { month?: string; rep?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const month = searchParams.month || monthKey(new Date())
  const repFilter = searchParams.rep || ''

  const [{ data: reps }, { data: cfg }, { data: students }, { data: payments }] = await Promise.all([
    supabase.from('profiles').select('id, name').eq('role', 'sales').order('name'),
    supabase.from('sales_config').select('sales_user_id, commission_amount, commission_currency'),
    supabase.from('students').select('id, name, added_by_sales_id, country'),
    supabase.from('payments').select('student_id, amount, currency, status, payment_date, created_at').eq('status', 'paid'),
  ])

  const cfgByRep = new Map((cfg ?? []).map((c: any) => [c.sales_user_id, c]))
  const repName = new Map((reps ?? []).map((r: any) => [r.id, r.name]))
  const stById = new Map((students ?? []).map((s: any) => [s.id, s]))

  // First paid payment per student (commission is one-time)
  const payDate = (p: any) => p.payment_date ?? (p.created_at ?? '').slice(0, 10)
  const firstPay = new Map<string, any>()
  for (const p of (payments ?? []) as any[]) {
    const cur = firstPay.get(p.student_id)
    if (!cur || payDate(p) < payDate(cur)) firstPay.set(p.student_id, p)
  }

  // Conversions = first payments landing in the selected month
  type Row = { student: string; country: string; repId: string; rep: string; date: string; amount: number; currency: string }
  const rows: Row[] = []
  firstPay.forEach((p, studentId) => {
    const d = payDate(p)
    if (!d?.startsWith(month)) return
    const s = stById.get(studentId)
    if (!s) return
    const repId = s.added_by_sales_id ?? ''
    if (repFilter && repId !== repFilter) return
    rows.push({
      student: s.name, country: s.country ?? '—', repId,
      rep: repId ? (repName.get(repId) ?? 'Unknown') : 'Unassigned',
      date: d, amount: Number(p.amount) || 0, currency: p.currency,
    })
  })
  rows.sort((a, b) => a.date.localeCompare(b.date))

  // Salary summary per rep
  const byRep = new Map<string, { rep: string; conversions: number }>()
  for (const r of rows) {
    const k = r.repId || 'unassigned'
    const e = byRep.get(k) ?? { rep: r.rep, conversions: 0 }
    e.conversions++
    byRep.set(k, e)
  }
  const salary = Array.from(byRep.entries()).map(([repId, e]) => {
    const c: any = cfgByRep.get(repId)
    const rate = c ? Number(c.commission_amount) || 0 : 0
    const currency = c?.commission_currency ?? '—'
    return { repId, rep: e.rep, conversions: e.conversions, rate, currency, total: rate * e.conversions }
  }).sort((a, b) => b.conversions - a.conversions)

  // Month options: last 12
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)))

  const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }
  const inp: React.CSSProperties = { padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>💼 Team Performance — Sales Salary</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
          Conversions = a student&apos;s <strong>first</strong> payment. Commission is paid once per student — renewals don&apos;t count.
        </p>
      </div>

      {/* Filters */}
      <form method="GET" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select name="month" defaultValue={month} style={inp}>
          {months.map(m => (
            <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</option>
          ))}
        </select>
        <select name="rep" defaultValue={repFilter} style={{ ...inp, minWidth: '180px' }}>
          <option value="">All sales reps</option>
          {(reps ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="submit" style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Apply</button>
        {(repFilter || month !== monthKey(new Date())) && (
          <Link href="/admin/team-performance" style={{ background: '#F1F5F9', color: '#475569', padding: '9px 14px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>Reset</Link>
        )}
      </form>

      {/* Salary summary */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', background: '#0D1B2A' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>💵 Salary due — {new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        </div>
        {salary.length === 0 ? (
          <div style={{ padding: '20px', color: '#9CA3AF', fontSize: '14px', textAlign: 'center' }}>No conversions this month.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Sales Rep', 'Conversions', 'Commission / Conversion', 'Total Due'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {salary.map(s => (
                  <tr key={s.repId}>
                    <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{s.rep}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{s.conversions}</td>
                    <td style={td}>{s.rate ? `${s.rate.toLocaleString()} ${s.currency}` : <span style={{ color: '#B45309' }}>rate not set</span>}</td>
                    <td style={{ ...td, fontWeight: 800, color: '#059669' }}>{s.rate ? `${s.total.toLocaleString()} ${s.currency}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conversion detail */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', fontWeight: 700, fontSize: '15px', color: '#111827' }}>
          🎯 Converted students ({rows.length})
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '20px', color: '#9CA3AF', fontSize: '14px', textAlign: 'center' }}>No first payments in this month.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Student', 'Country', 'Sales Rep', 'First Payment Date', 'Payment Amount'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{r.student}</td>
                    <td style={td}>{r.country}</td>
                    <td style={td}>{r.rep}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{r.amount.toLocaleString()} {r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
        Old students whose first payment predates the payment log can&apos;t be dated and are not listed here. Commission rates come from each rep&apos;s profile (Users → edit → Commission Configuration).
      </p>
    </div>
  )
}
