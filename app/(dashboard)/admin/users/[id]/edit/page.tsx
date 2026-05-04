'use client'
// app/(dashboard)/admin/users/[id]/edit/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const LANGUAGES = ['English','German','French','Spanish','Arabic','Italian','Dutch','Turkish','Russian']
const SPECIALTIES = ['Egyptian','Gulf','Levantine','MSA','Quran','Islamic','Children']

export default function EditUserPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [teacher, setTeacher] = useState<any>(null)
  const [form, setForm] = useState({
    name: '', is_active: true,
    rate_per_session_usd: '',
    languages: [] as string[],
    specialties: [] as string[],
    commission_amount: '',
    commission_currency: 'USD',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('teachers').select('*').eq('user_id', id).single(),
      supabase.from('sales_config').select('*').eq('sales_user_id', id).single(),
    ]).then(([{ data: p }, { data: t }, { data: s }]) => {
      if (p) { setProfile(p); setForm(f => ({ ...f, name: p.name, is_active: p.is_active })) }
      if (t) { setTeacher(t); setForm(f => ({ ...f, rate_per_session_usd: t.rate_per_session_usd, languages: t.languages ?? [], specialties: t.specialties ?? [] })) }
      if (s) setForm(f => ({ ...f, commission_amount: s.commission_amount, commission_currency: s.commission_currency }))
      setLoading(false)
    })
  }, [id])

  function toggle(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess('')

    const { error: profileErr } = await supabase.from('profiles').update({ name: form.name, is_active: form.is_active }).eq('id', id)
    if (profileErr) { setError(profileErr.message); setSaving(false); return }

    if (profile?.role === 'teacher' && teacher) {
      const { error: teacherErr } = await supabase.from('teachers').update({
        rate_per_session_usd: Number(form.rate_per_session_usd),
        languages: form.languages,
        specialties: form.specialties,
      }).eq('user_id', id)
      if (teacherErr) { setError(teacherErr.message); setSaving(false); return }
    }

    if (profile?.role === 'sales') {
      const { error: salesErr } = await supabase.from('sales_config').upsert({
        sales_user_id: id,
        commission_amount: Number(form.commission_amount),
        commission_currency: form.commission_currency,
      })
      if (salesErr) { setError(salesErr.message); setSaving(false); return }
    }

    setSuccess('User updated successfully!')
    setSaving(false)
    setTimeout(() => router.push('/admin/users'), 1200)
  }

  const inp = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }
  const cardH = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827' }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280' }}>Loading…</div>
  if (!profile) return <div style={{ padding: '60px', textAlign: 'center', color: '#DC2626' }}>User not found</div>

  const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
    admin: { bg: '#F3E8FF', text: '#7C3AED' }, teacher: { bg: '#EFF6FF', text: '#2563EB' },
    supervisor: { bg: '#FFF7ED', text: '#EA580C' }, sales: { bg: '#ECFDF5', text: '#059669' },
    accountant: { bg: '#FEF2F2', text: '#DC2626' },
  }
  const rc = ROLE_COLORS[profile.role] || { bg: '#F3F4F6', text: '#374151' }

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Edit User</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>{profile.email}</p>
            <span style={{ background: rc.bg, color: rc.text, padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' as const }}>{profile.role}</span>
          </div>
        </div>
        <button onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', cursor: 'pointer' }}>← Back</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={card}>
          <div style={cardH}>👤 Basic Information</div>
          <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div><label style={lbl}>Full Name</label><input style={inp} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
            <div><label style={lbl}>Email (read only)</label><input style={{ ...inp, background: '#F9FAFB', color: '#6B7280' }} value={profile.email} disabled /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
              <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({...f, is_active: e.target.checked}))} style={{ width: '16px', height: '16px', accentColor: '#C9A84C' }} />
              <label htmlFor="active" style={{ fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>Account is active</label>
            </div>
          </div>
        </div>

        {profile.role === 'teacher' && (
          <div style={card}>
            <div style={cardH}>👩‍🏫 Teacher Configuration</div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ maxWidth: '260px' }}>
                <label style={lbl}>Rate Per Session (USD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }}>$</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft: '28px' }} value={form.rate_per_session_usd} onChange={e => setForm(f => ({...f, rate_per_session_usd: e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Languages</label>
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
                <label style={lbl}>Specialties</label>
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

        {profile.role === 'sales' && (
          <div style={card}>
            <div style={cardH}>💰 Commission Configuration</div>
            <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label style={lbl}>Commission Per Conversion</label>
                <input type="number" step="0.01" min="0" style={inp} value={form.commission_amount} onChange={e => setForm(f => ({...f, commission_amount: e.target.value}))} />
              </div>
              <div>
                <label style={lbl}>Currency</label>
                <select style={inp} value={form.commission_currency} onChange={e => setForm(f => ({...f, commission_currency: e.target.value}))}>
                  <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}
        {success && <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>✅ {success}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={saving} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '12px 28px', borderRadius: '10px', border: 'none', fontWeight: '600', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '12px 22px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
