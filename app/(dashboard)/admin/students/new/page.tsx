'use client'
// app/(dashboard)/admin/students/new/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const COUNTRIES = ['Egypt','Saudi Arabia','United Arab Emirates','United Kingdom','United States','Germany','France','Netherlands','Belgium','Switzerland','Austria','Canada','Australia','Jordan','Lebanon','Kuwait','Qatar','Bahrain','Oman','Morocco','Tunisia','Algeria','Libya','Sudan','Other']
const COUNTRY_CURRENCY: Record<string, string> = { 'United Arab Emirates':'AED','Saudi Arabia':'AED','Kuwait':'AED','Qatar':'AED','Bahrain':'AED','Oman':'AED','United Kingdom':'GBP','Germany':'EUR','France':'EUR','Netherlands':'EUR','Belgium':'EUR','Switzerland':'EUR','Austria':'EUR','United States':'USD','Canada':'USD','Australia':'USD' }

const PLANS_60 = [
  { sessions: 4,  label: '4 sessions' },
  { sessions: 8,  label: '8 sessions' },
  { sessions: 12, label: '12 sessions' },
  { sessions: 16, label: '16 sessions ⭐ Most Popular' },
  { sessions: 20, label: '20 sessions' },
]
const PLANS_30 = [
  { sessions: 4,  label: '4 sessions (30 min)' },
  { sessions: 8,  label: '8 sessions (30 min)' },
  { sessions: 12, label: '12 sessions (30 min)' },
  { sessions: 16, label: '16 sessions ⭐ Most Popular' },
  { sessions: 20, label: '20 sessions (30 min)' },
]

export default function NewStudentPage() {
  const router = useRouter()
  const supabase = createClient()
  const [teachers, setTeachers] = useState<any[]>([])
  const [salesAgents, setSalesAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const [form, setForm] = useState({
    // Personal
    name: '', email: '', phone: '', country: '',
    // Learning
    currency: 'USD', session_duration: 60,
    assigned_teacher_id: '', added_by_sales_id: '',
    student_status: 'trial', reminder_date: '', notes: '',
    // Payment
    payment_method: '', payment_status: 'pending',
    number_of_classes: 16, amount: '',
    is_paid_upfront: false,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''))
    supabase.from('teachers').select('id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true).then(({ data }) => setTeachers(data ?? []))
    supabase.from('profiles').select('id, name').eq('role', 'sales').then(({ data }) => setSalesAgents(data ?? []))
  }, [])

  function handleCountry(country: string) {
    setForm(f => ({ ...f, country, currency: COUNTRY_CURRENCY[country] ?? 'USD' }))
  }

  const plans = form.session_duration === 30 ? PLANS_30 : PLANS_60

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Full name is required'); return }
    setLoading(true); setError('')

    try {
      // 1. Insert student
      const studentPayload: any = {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        country: form.country || null,
        currency: form.currency,
        session_duration: Number(form.session_duration),
        assigned_teacher_id: form.assigned_teacher_id || null,
        added_by_sales_id: form.added_by_sales_id || null,
        student_status: form.student_status,
        payment_method: form.payment_method || null,
        payment_status: form.payment_status,
        reminder_date: form.reminder_date || null,
        notes: form.notes || null,
        total_paid_classes: 0,
        consumed_classes: 0,
      }

      const { data: newStudent, error: studentErr } = await supabase
        .from('students').insert(studentPayload).select('id').single()

      if (studentErr) throw new Error(studentErr.message)

      // 2. If classes were purchased, create a payment record
      if (form.number_of_classes > 0 && form.amount && Number(form.amount) > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          student_id: newStudent.id,
          number_of_classes: Number(form.number_of_classes),
          amount: Number(form.amount),
          currency: form.currency,
          payment_method: form.payment_method || 'Other',
          status: form.payment_status,
          added_by: currentUserId,
          payment_date: new Date().toISOString().split('T')[0],
          is_renewal: false,
        })
        if (payErr) throw new Error(payErr.message)
      }

      router.push('/admin/students')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const inp = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }
  const cardH = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827' }
  const grid = { padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }

  const currencySymbol = form.currency === 'USD' ? '$' : form.currency === 'GBP' ? '£' : form.currency === 'EUR' ? '€' : 'AED '

  return (
    <div style={{ maxWidth: '920px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Add New Student</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Fill in all details including payment if applicable</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Personal Info */}
        <div style={card}>
          <div style={cardH}>👤 Personal Information</div>
          <div style={grid}>
            <div><label style={lbl}>Full Name *</label><input style={inp} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required /></div>
            <div><label style={lbl}>Email</label><input type="email" style={inp} value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} /></div>
            <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+44 7..." /></div>
            <div><label style={lbl}>Country</label>
              <select style={inp} value={form.country} onChange={e => handleCountry(e.target.value)}>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Learning Setup */}
        <div style={card}>
          <div style={cardH}>📚 Learning Setup</div>
          <div style={grid}>
            <div><label style={lbl}>Assigned Teacher</label>
              <select style={inp} value={form.assigned_teacher_id} onChange={e => setForm(f => ({...f, assigned_teacher_id: e.target.value}))}>
                <option value="">Select teacher</option>
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.profile?.name} — {(t.specialties ?? []).join(', ')} ({(t.languages ?? []).join(', ')})</option>)}
              </select>
            </div>
            <div><label style={lbl}>Session Duration</label>
              <select style={inp} value={form.session_duration} onChange={e => setForm(f => ({...f, session_duration: Number(e.target.value), number_of_classes: 16}))}>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
              </select>
            </div>
            <div><label style={lbl}>Student Status</label>
              <select style={inp} value={form.student_status} onChange={e => setForm(f => ({...f, student_status: e.target.value}))}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div><label style={lbl}>Added by (Sales Agent)</label>
              <select style={inp} value={form.added_by_sales_id} onChange={e => setForm(f => ({...f, added_by_sales_id: e.target.value}))}>
                <option value="">Select agent</option>
                {salesAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div style={card}>
          <div style={cardH}>💳 Payment Details</div>
          <div style={grid}>
            <div><label style={lbl}>Currency</label>
              <select style={inp} value={form.currency} onChange={e => setForm(f => ({...f, currency: e.target.value}))}>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="AED">AED — UAE Dirham</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Method</label>
              <select style={inp} value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))}>
                <option value="">Select method</option>
                {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Payment Status</label>
              <select style={inp} value={form.payment_status} onChange={e => setForm(f => ({...f, payment_status: e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="paid">✅ Paid</option>
                <option value="declined">❌ Declined</option>
              </select>
            </div>
            <div><label style={lbl}>Reminder Date</label>
              <input type="date" style={inp} value={form.reminder_date} onChange={e => setForm(f => ({...f, reminder_date: e.target.value}))} />
            </div>
          </div>

          {/* Classes purchased */}
          <div style={{ padding: '0 22px 20px', borderTop: '1px solid #F3F4F6', marginTop: '4px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '16px 0 12px 0' }}>📦 Classes Purchased (leave amount as 0 if trial only)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div><label style={lbl}>Number of Classes</label>
                <select style={inp} value={form.number_of_classes} onChange={e => setForm(f => ({...f, number_of_classes: Number(e.target.value)}))}>
                  <option value={0}>0 — Trial only (no payment)</option>
                  {plans.map(p => <option key={p.sessions} value={p.sessions}>{p.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Amount Paid ({form.currency})</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', fontSize: '14px' }}>{currencySymbol}</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft: '36px' }} value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0.00" />
                </div>
              </div>
            </div>
            {form.payment_status === 'paid' && Number(form.amount) > 0 && form.number_of_classes > 0 && (
              <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', color: '#065F46' }}>
                ⚡ Marking as <strong>Paid</strong> will automatically add <strong>{form.number_of_classes} classes</strong> to this student and generate a sales commission.
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div style={card}>
          <div style={{ padding: '20px 22px' }}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Any additional notes..." />
          </div>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={loading} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '12px 28px', borderRadius: '10px', border: 'none', fontWeight: '600', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
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
