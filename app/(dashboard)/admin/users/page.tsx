'use client'
// app/(dashboard)/admin/users/page.tsx
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  teacher: 'bg-blue-100 text-blue-800',
  supervisor: 'bg-orange-100 text-orange-800',
  sales: 'bg-green-100 text-green-800',
  accountant: 'bg-red-100 text-red-800',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [configMap, setConfigMap] = useState<Record<string, any>>({})
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? '')
    const [{ data: u }, { data: sc }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('sales_config').select('sales_user_id, commission_amount, commission_currency'),
    ])
    setUsers(u ?? [])
    setConfigMap(Object.fromEntries((sc ?? []).map(c => [c.sales_user_id, c])))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete user "${name}"? This cannot be undone and will remove all their data.`)) return
    setDeleting(id)
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const json = await res.json()
    setDeleting(null)
    if (!res.ok) { alert(json.error || 'Delete failed'); return }
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  async function handleResetPassword(email: string) {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    alert(`Password reset email sent to ${email}`)
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <div className="flex gap-3">
          <span className="badge bg-gray-100 text-gray-700">{users.length} users</span>
          <Link href="/admin/users/new" className="btn-primary">+ Add User</Link>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Name', 'Email', 'Role', 'Commission', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontWeight: '700', fontSize: '13px', flexShrink: 0 }}>
                        {u.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>{u.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: '#6B7280' }}>
                    {u.role === 'sales' && configMap[u.id]
                      ? `${configMap[u.id].commission_currency} ${configMap[u.id].commission_amount}`
                      : u.role === 'sales' ? <span style={{ color: '#D97706' }}>Not set</span> : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: u.is_active ? '#ECFDF5' : '#F3F4F6', color: u.is_active ? '#059669' : '#6B7280', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => handleResetPassword(u.email)}
                        style={{ padding: '5px 12px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Reset Password
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          disabled={deleting === u.id}
                          style={{ padding: '5px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', opacity: deleting === u.id ? 0.5 : 1 }}
                        >
                          {deleting === u.id ? '…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
