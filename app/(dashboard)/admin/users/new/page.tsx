'use client'
// app/(dashboard)/admin/users/new/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const LANGUAGES = ['English','German','French','Spanish','Arabic','Italian','Dutch','Turkish','Russian']
const SPECIALTIES = ['Egyptian','Gulf','Levantine','MSA','Quran','Islamic','Children']

export default function NewUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'sales',
    rate_per_session_usd: '', commission_amount: '', commission_currency: 'USD',
    languages: [] as string[], specialties: [] as string[],
  })

  function toggle(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError(''); setSuccess('')

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to create user'); setLoading(false); return }
    setSuccess(`✅ ${form.name} has been created successfully!`)
    setLoading(false)
    setTimeout(() => router.push('/admin/users'), 1500)
  }

  const inp = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }
  const cardH = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827' }
  const grid = { padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Create New User</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Add a new team member to the system</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={card}>
          <div style={cardH}>👤 Account Details</div>
          <div style={grid}>
            <div><label style={lbl}>Full Name *</label><input style={inp} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
            <div><label style={lbl}>Email Address *</label><input type="email" style={inp} value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required /></div>
            <div><label style={lbl}>Temporary Password *</label><input type="password" style={inp} value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} minLength={8} required placeholder="Min 8 characters" /></div>
            <div><label style={lbl}>Role *</label>
              <select style={inp} value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="supervisor">Supervisor</option>
                <option value="sales">Sales / Call Center</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teacher config */}
        {form.role === 'teacher' && (
          <div style={card}>
            <div style={cardH}>👩‍🏫 Teacher Configuration</div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ maxWidth: '260px' }}>
                <label style={lbl}>Rate Per Session (USD) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }}>$</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft: '28px' }} value={form.rate_per_session_usd} onChange={e => setForm(f => ({...f, rate_per_session_usd: e.target.value}))} placeholder="e.g. 8.00" required />
                </div>
              </div>
              <div>
                <label style={lbl}>Languages They Teach In</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {LANGUAGES.map(l => (
                    <button key={l} type="button" onClick={() => setForm(f => ({...f, languages: toggle(f.languages, l)}))}
                      style={{ padding: '6px 14px', borderRadius: '20px', border: `1.5px solid ${form.languages.includes(l) ? '#0D1B2A' : '#E5E7EB'}`, background: form.languages.includes(l) ? '#0D1B2A' : '#fff', color: form.languages.includes(l) ? '#E8C97A' : '#6B7280', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>Programmes / Specialties</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                  {SPECIALTIES.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({...f, specialties: toggle(f.specialties, s)}))}
                      style={{ padding: '6px 14px', borderRadius: '20px', border: `1.5px solid ${form.specialties.includes(s) ? '#0D1B2A' : '#E5E7EB'}`, background: form.specialties.includes(s) ? '#0D1B2A' : '#fff', color: form.specialties.includes(s) ? '#E8C97A' : '#6B7280', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales commission */}
        {form.role === 'sales' && (
          <div style={card}>
            <div style={cardH}>💰 Commission Configuration</div>
            <div style={grid}>
              <div>
                <label style={lbl}>Commission Amount Per Conversion</label>
                <input type="number" step="0.01" min="0" style={inp} value={form.commission_amount} onChange={e => setForm(f => ({...f, commission_amount: e.target.value}))} placeholder="e.g. 10" />
              </div>
              <div>
                <label style={lbl}>Commission Currency</label>
                <select style={inp} value={form.commission_currency} onChange={e => setForm(f => ({...f, commission_currency: e.target.value}))}>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="AED">AED</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{success}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={loading} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '12px 28px', borderRadius: '10px', border: 'none', fontWeight: '600', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating…' : 'Create User'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '12px 22px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
