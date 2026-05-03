// app/(dashboard)/admin/users/page.tsx
import { createClient } from '@/lib/supabase/server'

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:      { bg: '#F3E8FF', text: '#7C3AED' },
  teacher:    { bg: '#EFF6FF', text: '#2563EB' },
  supervisor: { bg: '#FFF7ED', text: '#EA580C' },
  sales:      { bg: '#ECFDF5', text: '#059669' },
  accountant: { bg: '#FEF2F2', text: '#DC2626' },
}

export default async function AdminUsersPage() {
  const supabase = createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('role')
    .order('name')

  const { data: teachers } = await supabase
    .from('teachers')
    .select('user_id, rate_per_session_usd, languages, specialties')

  const { data: salesConfigs } = await supabase
    .from('sales_config')
    .select('sales_user_id, commission_amount, commission_currency')

  const teacherMap = Object.fromEntries((teachers ?? []).map(t => [t.user_id, t]))
  const salesMap = Object.fromEntries((salesConfigs ?? []).map(s => [s.sales_user_id, s]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>User Management</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{users?.length ?? 0} users</p>
        </div>
        <a href="/admin/users/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Create User
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {['admin','teacher','supervisor','sales','accountant'].map(role => {
          const count = users?.filter(u => u.role === role).length ?? 0
          const c = ROLE_COLORS[role]
          return (
            <div key={role} style={{ background: c.bg, border: `1px solid ${c.text}33`, borderRadius: '10px', padding: '12px 20px', minWidth: '120px' }}>
              <p style={{ fontSize: '11px', color: c.text, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', margin: '0 0 4px 0' }}>{role}</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: c.text, margin: 0 }}>{count}</p>
            </div>
          )
        })}
      </div>

      {/* Users Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Name', 'Email', 'Role', 'Details', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map(u => {
                const c = ROLE_COLORS[u.role] || { bg: '#F3F4F6', text: '#374151' }
                const teacher = teacherMap[u.id]
                const sales = salesMap[u.id]
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8C97A', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>{u.email}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>{u.role}</span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#6B7280' }}>
                      {u.role === 'teacher' && teacher && (
                        <div>
                          <div>Rate: <strong style={{ color: '#059669' }}>${Number(teacher.rate_per_session_usd).toFixed(2)}/session</strong></div>
                          <div style={{ marginTop: '2px' }}>{(teacher.specialties ?? []).join(', ')}</div>
                          <div style={{ color: '#9CA3AF' }}>{(teacher.languages ?? []).join(', ')}</div>
                        </div>
                      )}
                      {u.role === 'sales' && sales && (
                        <div>Commission: <strong style={{ color: '#059669' }}>{sales.commission_currency} {Number(sales.commission_amount).toFixed(2)}/conversion</strong></div>
                      )}
                      {u.role === 'sales' && !sales && (
                        <span style={{ color: '#F59E0B', fontWeight: '500' }}>⚠️ Commission not set</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ background: u.is_active ? '#ECFDF5' : '#F3F4F6', color: u.is_active ? '#059669' : '#6B7280', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <a href={`/admin/users/${u.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>Edit</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
