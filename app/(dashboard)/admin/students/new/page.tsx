'use client'
// app/(dashboard)/admin/students/new/page.tsx
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const COUNTRIES = ['Egypt','Saudi Arabia','United Arab Emirates','United Kingdom','United States','Germany','France','Netherlands','Belgium','Switzerland','Austria','Canada','Australia','Jordan','Lebanon','Kuwait','Qatar','Bahrain','Oman','Morocco','Tunisia','Algeria','Libya','Sudan','Other']
const COUNTRY_CURRENCY: Record<string, string> = { 'United Arab Emirates':'AED','Saudi Arabia':'AED','Kuwait':'AED','Qatar':'AED','Bahrain':'AED','Oman':'AED','United Kingdom':'GBP','Germany':'EUR','France':'EUR','Netherlands':'EUR','Belgium':'EUR','Switzerland':'EUR','Austria':'EUR','United States':'USD','Canada':'USD','Australia':'USD' }

export default function NewStudentPage() {
  const router = useRouter()
  const supabase = createClient()
  const [teachers, setTeachers] = useState<any[]>([])
  const [salesAgents, setSalesAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name:'', email:'', phone:'', country:'', currency:'USD', payment_method:'', session_duration:60, assigned_teacher_id:'', added_by_sales_id:'', student_status:'trial', payment_status:'pending', reminder_date:'', notes:'' })

  useEffect(() => {
    supabase.from('teachers').select('id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true).then(({ data }) => setTeachers(data ?? []))
    supabase.from('profiles').select('id, name').eq('role', 'sales').then(({ data }) => setSalesAgents(data ?? []))
  }, [])

  function handleCountry(country: string) {
    setForm(f => ({ ...f, country, currency: (COUNTRY_CURRENCY[country] ?? 'USD') as any }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.from('students').insert({ ...form, assigned_teacher_id: form.assigned_teacher_id || null, added_by_sales_id: form.added_by_sales_id || null, reminder_date: form.reminder_date || null, session_duration: Number(form.session_duration) })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/admin/students')
    router.refresh()
  }

  const inputStyle = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }
  const cardHeaderStyle = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827' }
  const cardBodyStyle = { padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Add New Student</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Fill in the details below</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>👤 Personal Information</div>
          <div style={cardBodyStyle}>
            <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
            <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+44 7..." /></div>
            <div><label style={labelStyle}>Country</label>
              <select style={inputStyle} value={form.country} onChange={e => handleCountry(e.target.value)}>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>📚 Learning Setup</div>
          <div style={cardBodyStyle}>
            <div><label style={labelStyle}>Assigned Teacher</label>
              <select style={inputStyle} value={form.assigned_teacher_id} onChange={e => setForm(f => ({...f, assigned_teacher_id: e.target.value}))}>
                <option value="">Select teacher</option>
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.profile?.name} — {(t.specialties ?? []).join(', ')} ({(t.languages ?? []).join(', ')})</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Session Duration</label>
              <select style={inputStyle} value={form.session_duration} onChange={e => setForm(f => ({...f, session_duration: Number(e.target.value) as any}))}>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
              </select>
            </div>
            <div><label style={labelStyle}>Student Status</label>
              <select style={inputStyle} value={form.student_status} onChange={e => setForm(f => ({...f, student_status: e.target.value}))}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div><label style={labelStyle}>Added by (Sales Agent)</label>
              <select style={inputStyle} value={form.added_by_sales_id} onChange={e => setForm(f => ({...f, added_by_sales_id: e.target.value}))}>
                <option value="">Select agent</option>
                {salesAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardHeaderStyle}>💳 Payment Details</div>
          <div style={cardBodyStyle}>
            <div><label style={labelStyle}>Currency</label>
              <select style={inputStyle} value={form.currency} onChange={e => setForm(f => ({...f, currency: e.target.value}))}>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="AED">AED — UAE Dirham</option>
              </select>
            </div>
            <div><label style={labelStyle}>Payment Method</label>
              <select style={inputStyle} value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))}>
                <option value="">Select method</option>
                {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Payment Status</label>
              <select style={inputStyle} value={form.payment_status} onChange={e => setForm(f => ({...f, payment_status: e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <div><label style={labelStyle}>Reminder Date</label><input type="date" style={inputStyle} value={form.reminder_date} onChange={e => setForm(f => ({...f, reminder_date: e.target.value}))} /></div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={cardBodyStyle}>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Any additional notes..." /></div>
          </div>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={loading} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '12px 28px', borderRadius: '10px', border: 'none', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>
            {loading ? 'Saving…' : 'Add Student'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '12px 22px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
