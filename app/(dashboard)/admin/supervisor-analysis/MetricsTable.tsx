// Plain presentational table for supervisor/teacher metrics (server-rendered).
// One unified table per level: funnel (students → paid → renewed) + revenue,
// with a totals row at the bottom.
import type { MetricRow } from '@/lib/analytics/supervisor'

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }

function pct(v: number) {
  const bg = v >= 60 ? '#ECFDF5' : v >= 35 ? '#FFFBEB' : '#FEF2F2'
  const c  = v >= 60 ? '#059669' : v >= 35 ? '#D97706' : '#DC2626'
  return <span style={{ background: bg, color: c, padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>{v}%</span>
}

export default function MetricsTable({
  title, rows, level,
}: {
  title: string
  rows: MetricRow[]
  level: 'supervisor' | 'teacher'
  variant?: string   // legacy prop, ignored — the table is unified now
}) {
  const isSup = level === 'supervisor'

  // Totals across the rows shown (rates recomputed from the sums)
  const sum = rows.reduce((a, r) => ({
    trials: a.trials + r.trials, converted: a.converted + r.converted,
    students: a.students + r.students, inactive: a.inactive + r.inactive,
    payers: a.payers + r.payers, renewed: a.renewed + r.renewed,
    revenue: a.revenue + r.revenue, teacherCount: a.teacherCount + (r.teacherCount ?? 0),
  }), { trials: 0, converted: 0, students: 0, inactive: 0, payers: 0, renewed: 0, revenue: 0, teacherCount: 0 })
  const totConv  = sum.trials ? Math.round((sum.converted / sum.trials) * 100) : 0
  const totRenew = sum.payers ? Math.round((sum.renewed / sum.payers) * 100) : 0

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', background: '#0D1B2A' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{title}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '20px', color: '#9CA3AF', fontSize: '14px', textAlign: 'center' }}>No data for this selection.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={th}>{isSup ? 'Supervisor' : 'Teacher'}</th>
                {isSup && <th style={th}>Teachers</th>}
                <th style={th}>Students</th>
                <th style={th}>Active</th>
                <th style={th}>Inactive</th>
                <th style={th}>Paid (Conv.)</th>
                <th style={th}>Renewal</th>
                <th style={th}>Revenue (USD)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{r.name}</td>
                  {isSup && <td style={td}>{r.teacherCount ?? 0}</td>}
                  <td style={td}>{r.trials}</td>
                  <td style={{ ...td, fontWeight: 600, color: '#059669' }}>{r.students}</td>
                  <td style={{ ...td, color: r.inactive > 0 ? '#B45309' : '#374151' }}>{r.inactive}</td>
                  <td style={td}>{pct(r.convRate)} <span style={{ color: '#94A3B8', fontSize: '11px' }}>({r.converted}/{r.trials})</span></td>
                  <td style={td}>{pct(r.renewalRate)} <span style={{ color: '#94A3B8', fontSize: '11px' }}>({r.renewed}/{r.payers})</span></td>
                  <td style={{ ...td, fontWeight: 700, color: '#059669' }}>${r.revenue.toLocaleString()}</td>
                </tr>
              ))}
              {rows.length > 1 && (
                <tr style={{ background: '#F8FAFC' }}>
                  <td style={{ ...td, fontWeight: 800, color: '#0F172A' }}>TOTAL</td>
                  {isSup && <td style={{ ...td, fontWeight: 700 }}>{sum.teacherCount}</td>}
                  <td style={{ ...td, fontWeight: 700 }}>{sum.trials}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#059669' }}>{sum.students}</td>
                  <td style={{ ...td, fontWeight: 700, color: sum.inactive > 0 ? '#B45309' : '#374151' }}>{sum.inactive}</td>
                  <td style={td}>{pct(totConv)} <span style={{ color: '#94A3B8', fontSize: '11px' }}>({sum.converted}/{sum.trials})</span></td>
                  <td style={td}>{pct(totRenew)} <span style={{ color: '#94A3B8', fontSize: '11px' }}>({sum.renewed}/{sum.payers})</span></td>
                  <td style={{ ...td, fontWeight: 800, color: '#059669' }}>${sum.revenue.toLocaleString()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
