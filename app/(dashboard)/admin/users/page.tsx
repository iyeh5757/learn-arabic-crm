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
  const [currentUserId, setCurrentUserId] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
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
    if (!confirm(`Delete user "${name}"?\n\nThis will:\n• Remove their account permanently\n• Unassign their students\n• Delete their sessions and commissions\n\nThis cannot be undone.`)) return
    setDeleting(id)
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    const json = await res.json()
    setDeleting(null)
    if (!res.ok) { alert(json.error || 'Delete failed'); return }
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setResetLoading(true); setResetMsg('')
    const res = await fetch(`/api/users/${resetTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    const json = await res.json()
    setResetLoading(false)
    if (!res.ok) { setResetMsg('❌ ' + (json.error || 'Failed')); return }
    setResetMsg('✅ Password updated successfully!')
    setNewPassword('')
    setTimeout(() => { setResetTarget(null); setResetMsg('') }, 1500)
  }

  if (loading) return <div style={{ padding: '32px', color: '#6B7280' }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Reset Password Modal */}
      {resetTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: '700', fontSize: '18px', color: '#111827', marginBottom: '6px' }}>
              Set Password
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              Setting new password for <strong>{resetTarget.name}</strong>. They can use it immediately — no email required.
            </p>
            <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              {resetMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: resetMsg.startsWith('✅') ? '#ECFDF5' : '#FEF2F2', color: resetMsg.startsWith('✅') ? '#065F46' : '#DC2626', fontSize: '13px', fontWeight: '500' }}>
                  {resetMsg}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={resetLoading}
                  style={{ flex: 1, padding: '10px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  {resetLoading ? 'Saving…' : 'Set Password'}
                </button>
                <button type="button" onClick={() => { setResetTarget(null); setNewPassword(''); setResetMsg('') }}
                  style={{ flex: 1, padding: '10px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>User Management</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ background: '#F3F4F6', color: '#374151', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{users.length} users</span>
          <Link href="/admin/users/new" className="btn-primary">+ Add User</Link>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Name', 'Email', 'Role', 'Commission', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
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
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => { setResetTarget({ id: u.id, name: u.name }); setNewPassword(''); setResetMsg('') }}
                        style={{ padding: '5px 12px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Set Password
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          disabled={deleting === u.id}
                          style={{ padding: '5px 12px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', opacity: deleting === u.id ? 0.5 : 1 }}
                        >
                          {deleting === u.id ? 'Deleting…' : 'Delete'}
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
