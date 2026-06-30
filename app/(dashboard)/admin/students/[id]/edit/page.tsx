'use client'
// app/(dashboard)/admin/students/[id]/edit/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

import { COUNTRIES, COUNTRY_CURRENCY } from '@/lib/countries'
import BrowseGroupsModal from '@/components/BrowseGroupsModal'

export default function EditStudentPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [teachers, setTeachers] = useState<any[]>([])
  const [salesAgents, setSalesAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<any>(null)
  const [showGroups, setShowGroups] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase.from('teachers').select('id, user_id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true),
      supabase.from('profiles').select('id, name').eq('role', 'sales'),
    ]).then(([{ data: student }, { data: t }, { data: s }]) => {
      if (student) setForm(student)
      setTeachers(t ?? [])
      setSalesAgents(s ?? [])
      setLoading(false)
    })
  }, [id])

  function handleCountry(country: string) {
    setForm((f: any) => ({ ...f, country, currency: COUNTRY_CURRENCY[country] ?? f.currency }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error: err } = await supabase.from('students').update({
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
      whatsapp_group_id: form.whatsapp_group_id || null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/admin/students')
    router.refresh()
  }

  async function adjustClasses(type: 'add' | 'subtract', field: 'total_paid_classes' | 'consumed_classes', amount: number) {
    const current = form[field] ?? 0
    const newVal = type === 'add' ? current + amount : Math.max(0, current - amount)
    const { error: err } = await supabase.from('students').update({ [field]: newVal }).eq('id', id)
    if (!err) setForm((f: any) => ({ ...f, [field]: newVal }))
  }

  const inp = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }
  const cardH = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827' }
  const grid = { padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280' }}>Loading student data…</div>
  if (!form) return <div style={{ padding: '60px', textAlign: 'center', color: '#DC2626' }}>Student not found</div>

  const remaining = (form.total_paid_classes ?? 0) - (form.consumed_classes ?? 0)

  return (
    <div style={{ maxWidth: '940px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Edit Student</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{form.name}</p>
        </div>
        <button onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #E5E7EB', fontSize: '14px', cursor: 'pointer' }}>← Back</button>
      </div>

      {/* Class Management — separate from the form */}
      <div style={{ ...card, border: '1px solid #C9A84C' }}>
        <div style={{ ...cardH, background: '#FFFBEB', color: '#92400E' }}>📊 Class Management (Updates Immediately)</div>
        <div style={{ padding: '20px 22px' }}>
          {/* Live display */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Purchased', value: form.total_paid_classes ?? 0, color: '#0D1B2A' },
              { label: 'Consumed', value: form.consumed_classes ?? 0, color: '#374151' },
              { label: 'Remaining', value: remaining, color: remaining <= 2 ? '#D97706' : '#059669' },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', background: '#F9FAFB', borderRadius: '10px', padding: '14px 24px' }}>
                <p style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>{item.label}</p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: item.color, margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Adjust total paid classes */}
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 10px 0' }}>Adjust Total Purchased Classes:</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[4, 8, 12, 16, 20].map(n => (
                <button key={n} type="button" onClick={() => adjustClasses('add', 'total_paid_classes', n)}
                  style={{ background: '#ECFDF5', color: '#059669', padding: '6px 14px', borderRadius: '8px', border: '1px solid #6EE7B7', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  +{n}
                </button>
              ))}
              <button type="button" onClick={() => { const n = Number(prompt('How many classes to add?')); if (n > 0) adjustClasses('add', 'total_paid_classes', n) }}
                style={{ background: '#EFF6FF', color: '#2563EB', padding: '6px 14px', borderRadius: '8px', border: '1px solid #93C5FD', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Custom +
              </button>
              {[4, 8].map(n => (
                <button key={n} type="button" onClick={() => adjustClasses('subtract', 'total_paid_classes', n)}
                  style={{ background: '#FEF2F2', color: '#DC2626', padding: '6px 14px', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  −{n}
                </button>
              ))}
            </div>
          </div>

          {/* Adjust consumed */}
          <div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '0 0 10px 0' }}>Adjust Consumed Classes (for corrections):</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 4].map(n => (
                <button key={n} type="button" onClick={() => adjustClasses('add', 'consumed_classes', n)}
                  style={{ background: '#FFFBEB', color: '#D97706', padding: '6px 14px', borderRadius: '8px', border: '1px solid #FCD34D', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  +{n} consumed
                </button>
              ))}
              {[1, 2].map(n => (
                <button key={n} type="button" onClick={() => adjustClasses('subtract', 'consumed_classes', n)}
                  style={{ background: '#F3F4F6', color: '#6B7280', padding: '6px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  −{n} consumed
                </button>
              ))}
            </div>
          </div>
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
              <select style={inp} value={form.country ?? ''} onChange={e => handleCountry(e.target.value)}>
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
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{(t.profile as any)?.name || (Array.isArray(t.profile) ? (t.profile as any)[0]?.name : '') || 'Unknown Teacher'}</option>)}
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
            <div><label style={lbl}>Added by (Sales Agent)</label>
              <select style={inp} value={form.added_by_sales_id ?? ''} onChange={e => setForm((f: any) => ({...f, added_by_sales_id: e.target.value}))}>
                <option value="">Select agent</option>
                {salesAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardH}>💳 Payment Details</div>
          <div style={grid}>
            <div><label style={lbl}>Currency</label>
              <select style={inp} value={form.currency ?? 'USD'} onChange={e => setForm((f: any) => ({...f, currency: e.target.value}))}>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option><option value="EGP">EGP</option>
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

        <div style={{ ...card, border: '1px solid #D1FAE5' }}>
          <div style={{ ...cardH, background: '#F0FDF4', color: '#065F46' }}>💬 WhatsApp Group Reminders</div>
          <div style={{ padding: '20px 22px' }}>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 14px 0' }}>
              When a group ID is set, session reminders will be sent to the student's WhatsApp group instead of their private number.
              Leave blank to keep sending to the student's phone number.
            </p>
            <label style={lbl}>WhatsApp Group ID</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input style={{ ...inp, fontFamily: 'monospace', fontSize: '13px' }}
                placeholder="e.g. 120363XXXXXXXXXX@g.us"
                value={form.whatsapp_group_id ?? ''}
                onChange={e => setForm((f: any) => ({ ...f, whatsapp_group_id: e.target.value }))} />
              <button type="button" onClick={() => setShowGroups(true)}
                style={{ whiteSpace: 'nowrap', background: '#065F46', color: '#fff', padding: '9px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Browse Groups
              </button>
              {form.whatsapp_group_id && (
                <button type="button" onClick={() => setForm((f: any) => ({ ...f, whatsapp_group_id: '' }))}
                  style={{ whiteSpace: 'nowrap', background: '#FEF2F2', color: '#DC2626', padding: '9px 14px', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '13px', cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
            {form.whatsapp_group_id && (
              <p style={{ fontSize: '12px', color: '#059669', margin: '8px 0 0', fontWeight: 600 }}>
                ✅ Reminders will go to this group
              </p>
            )}
          </div>
        </div>

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={saving} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '12px 28px', borderRadius: '10px', border: 'none', fontWeight: '600', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '12px 22px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>

      {showGroups && (
        <BrowseGroupsModal
          onSelect={id => setForm((f: any) => ({ ...f, whatsapp_group_id: id }))}
          onClose={() => setShowGroups(false)}
        />
      )}
    </div>
  )
}
