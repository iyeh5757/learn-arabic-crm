'use client'
// app/(dashboard)/sales/students/[id]/edit/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

const COUNTRIES = ['Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia','Croatia','Cyprus','Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guatemala','Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Lebanon','Libya','Luxembourg','Malaysia','Malta','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Senegal','Serbia','Singapore','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Tanzania','Thailand','Tunisia','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe','Other']
const COUNTRY_CURRENCY: Record<string, string> = { 'Egypt':'EGP','United Arab Emirates':'AED','Saudi Arabia':'AED','Kuwait':'AED','Qatar':'AED','Bahrain':'AED','Oman':'AED','United Kingdom':'GBP','Germany':'EUR','France':'EUR','Netherlands':'EUR','Belgium':'EUR','Switzerland':'EUR','Austria':'EUR','United States':'USD','Canada':'USD','Australia':'USD' }

export default function SalesEditStudentPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [teachers, setTeachers] = useState<any[]>([])
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase.from('teachers').select('id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true),
    ]).then(([{ data: student }, { data: t }]) => {
      if (student) setForm(student)
      setTeachers(t ?? [])
      setLoading(false)
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error: err } = await supabase.from('students').update({
      name: form.name, email: form.email || null,
      phone: form.phone || null, country: form.country || null,
      currency: form.currency, session_duration: Number(form.session_duration),
      assigned_teacher_id: form.assigned_teacher_id || null,
      student_status: form.student_status,
      payment_method: form.payment_method || null,
      payment_status: form.payment_status,
      reminder_date: form.reminder_date || null,
      notes: form.notes || null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/sales/students')
    router.refresh()
  }

  const inp = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }
  const cardH = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827' }
  const grid = { padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280' }}>Loading…</div>
  if (!form) return <div style={{ padding: '60px', textAlign: 'center', color: '#DC2626' }}>Student not found</div>

  const remaining = (form.total_paid_classes ?? 0) - (form.consumed_classes ?? 0)

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Edit Student</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{form.name}</p>
      </div>

      {/* Class info — read only for sales */}
      <div style={{ background: '#0D1B2A', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div><p style={{ color: '#9CA3AF', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Total Classes</p><p style={{ color: '#E8C97A', fontWeight: '700', fontSize: '20px', margin: 0 }}>{form.total_paid_classes}</p></div>
        <div><p style={{ color: '#9CA3AF', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Consumed</p><p style={{ color: '#fff', fontWeight: '700', fontSize: '20px', margin: 0 }}>{form.consumed_classes}</p></div>
        <div><p style={{ color: '#9CA3AF', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Remaining</p><p style={{ color: remaining <= 2 ? '#FCD34D' : '#34D399', fontWeight: '700', fontSize: '20px', margin: 0 }}>{remaining}</p></div>
        <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>
          <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '0 0 4px 0' }}>To add classes, use the Payments tab</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={card}>
          <div style={cardH}>👤 Personal Information</div>
          <div style={grid}>
            <div><label style={lbl}>Full Name *</label><input style={inp} value={form.name ?? ''} onChange={e => setForm((f: any) => ({...f, name: e.target.value}))} required /></div>
            <div><label style={lbl}>Email</label><input type="email" style={inp} value={form.email ?? ''} onChange={e => setForm((f: any) => ({...f, email: e.target.value}))} /></div>
            <div><label style={lbl}>Phone</label><input style={inp} value={form.phone ?? ''} onChange={e => setForm((f: any) => ({...f, phone: e.target.value}))} /></div>
            <div><label style={lbl}>Country</label>
              <select style={inp} value={form.country ?? ''} onChange={e => setForm((f: any) => ({...f, country: e.target.value, currency: COUNTRY_CURRENCY[e.target.value] ?? f.currency}))}>
                <option value="">Select country</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardH}>📚 Learning Setup</div>
          <div style={grid}>
            <div><label style={lbl}>Assigned Teacher</label>
              <select style={inp} value={form.assigned_teacher_id ?? ''} onChange={e => setForm((f: any) => ({...f, assigned_teacher_id: e.target.value}))}>
                <option value="">Select teacher</option>
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.profile?.name} — {(t.specialties ?? []).join(', ')}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Session Duration</label>
              <select style={inp} value={form.session_duration ?? 60} onChange={e => setForm((f: any) => ({...f, session_duration: Number(e.target.value)}))}>
                <option value={30}>30 minutes</option>
                <option value={40}>40 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
                <option value={90}>90 minutes (1.5 hours)</option>
                <option value={120}>120 minutes (2 hours)</option>
              </select>
            </div>
            <div><label style={lbl}>Student Status</label>
              <select style={inp} value={form.student_status ?? 'trial'} onChange={e => setForm((f: any) => ({...f, student_status: e.target.value}))}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardH}>💳 Payment Details</div>
          <div style={grid}>
            <div><label style={lbl}>Currency</label>
              <select style={inp} value={form.currency ?? 'USD'} onChange={e => setForm((f: any) => ({...f, currency: e.target.value}))}>
                <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option><option value="EGP">EGP</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Method</label>
              <select style={inp} value={form.payment_method ?? ''} onChange={e => setForm((f: any) => ({...f, payment_method: e.target.value}))}>
                <option value="">Select method</option>
                {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Payment Status</label>
              <select style={inp} value={form.payment_status ?? 'pending'} onChange={e => setForm((f: any) => ({...f, payment_status: e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <div><label style={lbl}>Reminder Date</label>
              <input type="date" style={inp} value={form.reminder_date ?? ''} onChange={e => setForm((f: any) => ({...f, reminder_date: e.target.value}))} />
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ padding: '20px 22px' }}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={form.notes ?? ''} onChange={e => setForm((f: any) => ({...f, notes: e.target.value}))} />
          </div>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

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
