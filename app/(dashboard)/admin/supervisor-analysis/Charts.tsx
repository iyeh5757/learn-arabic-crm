'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type Country = { name: string; value: number }
type Sales = { name: string; revenue: number; students: number; renewalRate: number }

const COLORS = ['#2563EB', '#16A34A', '#9333EA', '#EA580C', '#0891B2', '#DB2777', '#CA8A04', '#4F46E5', '#059669', '#DC2626', '#7C3AED', '#0D9488']
const egp = (n: number) => `EGP ${Math.round(n).toLocaleString()}`

const cardBox: React.CSSProperties = { background: '#fff', border: '1px solid #F1F5F9', borderRadius: '14px', padding: '18px' }
const title: React.CSSProperties = { fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }

export default function Charts({ byCountry, bySales }: { byCountry: Country[]; bySales: Sales[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
      <div style={cardBox}>
        <div style={title}>💰 Revenue by country (EGP)</div>
        {byCountry.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={Math.max(160, byCountry.length * 30)}>
            <BarChart data={byCountry} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => egp(v)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {byCountry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={cardBox}>
        <div style={title}>💵 Revenue by sales rep (EGP)</div>
        {bySales.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={Math.max(160, bySales.length * 30)}>
            <BarChart data={bySales} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => egp(v)} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {bySales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ ...cardBox, gridColumn: '1 / -1' }}>
        <div style={title}>👥 Students brought in & renewal rate by sales rep</div>
        {bySales.length === 0 ? <Empty /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Sales rep', 'Students', 'Renewal rate', 'Revenue (EGP)'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bySales.map(s => (
                  <tr key={s.name} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#111827' }}>{s.name}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{s.students}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: s.renewalRate >= 50 ? '#ECFDF5' : s.renewalRate >= 25 ? '#FFFBEB' : '#FEF2F2', color: s.renewalRate >= 50 ? '#059669' : s.renewalRate >= 25 ? '#D97706' : '#DC2626', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>{s.renewalRate}%</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{egp(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Empty() {
  return <div style={{ fontSize: '13px', color: '#94A3B8', padding: '20px 0', textAlign: 'center' }}>No data for this selection.</div>
}
