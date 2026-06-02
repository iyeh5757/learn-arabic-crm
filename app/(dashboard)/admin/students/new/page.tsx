'use client'
// app/(dashboard)/admin/students/new/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const COUNTRIES = ['Egypt','Saudi Arabia','United Arab Emirates','United Kingdom','United States','Germany','France','Netherlands','Belgium','Switzerland','Austria','Canada','Australia','Jordan','Lebanon','Kuwait','Qatar','Bahrain','Oman','Morocco','Tunisia','Algeria','Libya','Sudan','Other']
const COUNTRY_CURRENCY: Record<string, string> = { 'United Arab Emirates':'AED','Saudi Arabia':'AED','Kuwait':'AED','Qatar':'AED','Bahrain':'AED','Oman':'AED','United Kingdom':'GBP','Germany':'EUR','France':'EUR','Netherlands':'EUR','Belgium':'EUR','Switzerland':'EUR','Austria':'EUR','United States':'USD','Canada':'USD','Australia':'USD' }

const PRESET_CLASSES = [4, 8, 12, 16, 20]

export default function NewStudentPage() {
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const router = useRouter()
  const supabase = createClient()
  const [teachers, setTeachers] = useState<any[]>([])
  const [salesAgents, setSalesAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [classMode, setClassMode] = useState<'preset' | 'custom'>('preset')
  const [isOldStudent, setIsOldStudent] = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', phone: '', country: '',
    currency: 'USD', session_duration: 60,
    assigned_teacher_id: '', added_by_sales_id: '',
    student_status: 'trial', reminder_date: '', notes: '',
    payment_method: '', payment_status: 'pending',
    number_of_classes: 16,
    custom_classes: '',
    classes_consumed: 0,
    amount: '',
    create_payment_record: true,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''))
    supabase.from('teachers').select('id, user_id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true).then(({ data }) => setTeachers(data ?? []))
    supabase.from('profiles').select('id, name').eq('role', 'sales').then(({ data }) => setSalesAgents(data ?? []))
  }, [])

  function handleCountry(country: string) {
    setForm(f => ({ ...f, country, currency: COUNTRY_CURRENCY[country] ?? 'USD' }))
  }

  const totalClasses = classMode === 'preset' ? form.number_of_classes : (Number(form.custom_classes) || 0)
  const remaining = totalClasses - form.classes_consumed
  const sym = form.currency === 'USD' ? '$' : form.currency === 'GBP' ? '£' : form.currency === 'EUR' ? '€' : 'AED '

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Full name is required'); return }
    if (remaining < 0) { setError('Consumed classes cannot exceed total classes'); return }
    setLoading(true); setError('')

    try {
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

      // Check for duplicate email before inserting
      if (form.email) {
        const { data: existing } = await supabase
          .from('students').select('id, name').eq('email', form.email).maybeSingle()
        if (existing) {
          setError(`A student with this email already exists: ${existing.name}. Please check the student list.`)
          setLoading(false)
          return
        }
      }

      const { data: newStudent, error: studentErr } = await supabase
        .from('students').insert(studentPayload).select('id').single()
      if (studentErr) throw new Error(studentErr.message)

      // If classes were entered, create a payment record
      if (totalClasses > 0 && form.create_payment_record) {
        const { error: payErr } = await supabase.from('payments').insert({
          student_id: newStudent.id,
          number_of_classes: totalClasses,
          amount: Number(form.amount) || 0,
          currency: form.currency,
          payment_method: form.payment_method || 'Other',
          status: form.payment_status,
          added_by: currentUserId,
          payment_date: today,
          is_renewal: false,
        })
        if (payErr) throw new Error(payErr.message)
      } else if (totalClasses > 0 && !form.create_payment_record) {
        // Directly set the classes without a payment record (for old students)
        const { error: updateErr } = await supabase
          .from('students')
          .update({
            total_paid_classes: totalClasses,
            consumed_classes: Number(form.classes_consumed) || 0,
          })
          .eq('id', newStudent.id)
        if (updateErr) throw new Error(updateErr.message)
      }

      // If old student with consumed classes and payment record was created,
      // manually set consumed_classes after trigger runs
      if (totalClasses > 0 && form.create_payment_record && form.classes_consumed > 0) {
        await supabase
          .from('students')
          .update({ consumed_classes: Number(form.classes_consumed) })
          .eq('id', newStudent.id)
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
  const grid2 = { padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }

  return (
    <div style={{ maxWidth: '940px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Add New Student</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Fill in all details including payment if applicable</p>
      </div>

      {/* Old student toggle */}
      <div style={{ background: isOldStudent ? '#FFFBEB' : '#F0FDF4', border: `1px solid ${isOldStudent ? '#FCD34D' : '#86EFAC'}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>
            {isOldStudent ? '📦 Migrating an existing student' : '✨ Adding a new student'}
          </p>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '3px 0 0 0' }}>
            {isOldStudent ? 'Enter total classes purchased AND classes already completed' : 'Fresh enrolment — sessions will be tracked from now'}
          </p>
        </div>
        <button type="button" onClick={() => setIsOldStudent(!isOldStudent)} style={{ background: isOldStudent ? '#FCD34D' : '#0D1B2A', color: isOldStudent ? '#92400E' : '#E8C97A', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
          {isOldStudent ? 'Switch to New Student' : 'Switch to Existing Student'}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Personal */}
        <div style={card}>
          <div style={cardH}>👤 Personal Information</div>
          <div style={grid2}>
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

        {/* Learning */}
        <div style={card}>
          <div style={cardH}>📚 Learning Setup</div>
          <div style={grid2}>
            <div><label style={lbl}>Assigned Teacher</label>
              <select style={inp} value={form.assigned_teacher_id} onChange={e => setForm(f => ({...f, assigned_teacher_id: e.target.value}))}>
                <option value="">Select teacher</option>
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{(t.profile as any)?.name || (Array.isArray(t.profile) ? (t.profile as any)[0]?.name : '') || 'Unknown Teacher'}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Session Duration</label>
              <select style={inp} value={form.session_duration} onChange={e => setForm(f => ({...f, session_duration: Number(e.target.value)}))}>
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

        {/* Payment & Classes */}
        <div style={card}>
          <div style={cardH}>💳 Payment & Classes</div>
          <div style={grid2}>
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

          {/* Classes section */}
          <div style={{ borderTop: '1px solid #F3F4F6', padding: '20px 22px' }}>
            <p style={{ fontWeight: '600', color: '#374151', margin: '0 0 14px 0', fontSize: '14px' }}>📦 Classes</p>

            {/* Preset vs Custom toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button type="button" onClick={() => setClassMode('preset')}
                style={{ padding: '7px 16px', borderRadius: '8px', border: `1.5px solid ${classMode === 'preset' ? '#0D1B2A' : '#E5E7EB'}`, background: classMode === 'preset' ? '#0D1B2A' : '#fff', color: classMode === 'preset' ? '#E8C97A' : '#6B7280', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Preset Plans
              </button>
              <button type="button" onClick={() => setClassMode('custom')}
                style={{ padding: '7px 16px', borderRadius: '8px', border: `1.5px solid ${classMode === 'custom' ? '#0D1B2A' : '#E5E7EB'}`, background: classMode === 'custom' ? '#0D1B2A' : '#fff', color: classMode === 'custom' ? '#E8C97A' : '#6B7280', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Custom Amount
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              {/* Classes purchased */}
              <div>
                <label style={lbl}>Total Classes Purchased</label>
                {classMode === 'preset' ? (
                  <select style={inp} value={form.number_of_classes} onChange={e => setForm(f => ({...f, number_of_classes: Number(e.target.value)}))}>
                    <option value={0}>0 — Trial only</option>
                    {PRESET_CLASSES.map(n => <option key={n} value={n}>{n} sessions{n === 16 ? ' ⭐' : ''}</option>)}
                  </select>
                ) : (
                  <input type="number" min="0" style={inp} value={form.custom_classes} onChange={e => setForm(f => ({...f, custom_classes: e.target.value}))} placeholder="Enter any number e.g. 24" />
                )}
              </div>

              {/* Classes already consumed — always shown for old students */}
              {(isOldStudent || totalClasses > 0) && (
                <div>
                  <label style={lbl}>{isOldStudent ? 'Classes Already Done *' : 'Classes Already Consumed'}</label>
                  <input type="number" min="0" max={totalClasses} style={inp}
                    value={form.classes_consumed}
                    onChange={e => setForm(f => ({...f, classes_consumed: Number(e.target.value)}))}
                    placeholder="0" />
                  {isOldStudent && <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>Sessions completed before joining the system</p>}
                </div>
              )}

              {/* Amount paid */}
              <div>
                <label style={lbl}>Amount Paid ({form.currency})</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }}>{sym}</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft: '36px' }} value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Live remaining calculator */}
            {totalClasses > 0 && (
              <div style={{ background: remaining <= 2 ? '#FFFBEB' : '#ECFDF5', border: `1px solid ${remaining <= 2 ? '#FCD34D' : '#6EE7B7'}`, borderRadius: '10px', padding: '12px 16px', marginTop: '16px', display: 'flex', gap: '32px', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Purchased</p>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: '#0D1B2A', margin: 0 }}>{totalClasses}</p>
                </div>
                <div style={{ fontSize: '20px', color: '#D1D5DB' }}>−</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consumed</p>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: '#374151', margin: 0 }}>{form.classes_consumed}</p>
                </div>
                <div style={{ fontSize: '20px', color: '#D1D5DB' }}>=</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining</p>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: remaining <= 2 ? '#D97706' : '#059669', margin: 0 }}>{remaining}</p>
                </div>
              </div>
            )}

            {isOldStudent && totalClasses > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="createpay" checked={form.create_payment_record} onChange={e => setForm(f => ({...f, create_payment_record: e.target.checked}))} style={{ width: '16px', height: '16px', accentColor: '#C9A84C' }} />
                <label htmlFor="createpay" style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>Create a payment record for this student's history</label>
              </div>
            )}

            {form.payment_status === 'paid' && totalClasses > 0 && (
              <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '8px', padding: '10px 14px', marginTop: '12px', fontSize: '13px', color: '#065F46' }}>
                ⚡ Marking as <strong>Paid</strong> will automatically add <strong>{totalClasses} classes</strong> to this student and generate a sales commission.
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
            {loading ? 'Saving…' : isOldStudent ? 'Add Existing Student' : 'Add Student'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '12px 22px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
