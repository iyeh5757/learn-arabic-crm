// Plain presentational table for supervisor/teacher metrics (server-rendered).
import type { MetricRow } from '@/lib/analytics/supervisor'

const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }

function pct(v: number) {
  const bg = v >= 60 ? '#ECFDF5' : v >= 35 ? '#FFFBEB' : '#FEF2F2'
  const c  = v >= 60 ? '#059669' : v >= 35 ? '#D97706' : '#DC2626'
  return <span style={{ background: bg, color: c, padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>{v}%</span>
}

export default function MetricsTable({
  title, rows, level, variant,
}: {
  title: string
  rows: MetricRow[]
  level: 'supervisor' | 'teacher'
  variant: 'performance' | 'money'
}) {
  const isSup = level === 'supervisor'
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
                {variant === 'performance' ? (
                  <>
                    <th style={th}>Trial Conversion</th>
                    <th style={th}>Renewal Rate</th>
                    <th style={th}>Total Students</th>
                    <th style={th}>Inactive</th>
                  </>
                ) : (
                  <>
                    <th style={th}>Students</th>
                    <th style={th}>Revenue (USD)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 600, color: '#111827' }}>{r.name}</td>
                  {isSup && <td style={td}>{r.teacherCount ?? 0}</td>}
                  {variant === 'performance' ? (
                    <>
                      <td style={td}>{pct(r.convRate)} <span style={{ color: '#94A3B8', fontSize: '11px' }}>({r.converted}/{r.trials})</span></td>
                      <td style={td}>{pct(r.renewalRate)} <span style={{ color: '#94A3B8', fontSize: '11px' }}>({r.renewed}/{r.payers})</span></td>
                      <td style={{ ...td, fontWeight: 600 }}>{r.students}</td>
                      <td style={{ ...td, color: r.inactive > 0 ? '#B45309' : '#374151' }}>{r.inactive}</td>
                    </>
                  ) : (
                    <>
                      <td style={td}>{r.students}</td>
                      <td style={{ ...td, fontWeight: 700, color: '#059669' }}>${r.revenue.toLocaleString()}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
