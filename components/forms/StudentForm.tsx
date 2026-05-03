'use client'
// components/forms/StudentForm.tsx
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Student, Teacher, Profile } from '@/types'

const COUNTRIES = [
  'Egypt','Saudi Arabia','United Arab Emirates','United Kingdom','United States',
  'Germany','France','Netherlands','Belgium','Switzerland','Austria','Canada',
  'Australia','Jordan','Lebanon','Kuwait','Qatar','Bahrain','Oman','Morocco',
  'Tunisia','Algeria','Libya','Sudan','Other'
]

const COUNTRY_CURRENCY: Record<string, string> = {
  'United Arab Emirates': 'AED', 'Saudi Arabia': 'AED', 'Kuwait': 'AED', 'Qatar': 'AED',
  'Bahrain': 'AED', 'Oman': 'AED',
  'United Kingdom': 'GBP',
  'Germany': 'EUR', 'France': 'EUR', 'Netherlands': 'EUR', 'Belgium': 'EUR',
  'Switzerland': 'EUR', 'Austria': 'EUR',
  'United States': 'USD', 'Canada': 'USD', 'Australia': 'USD',
}

interface Props {
  teachers: (Teacher & { profile: Profile })[]
  salesAgents: Profile[]
  student?: Partial<Student>
  redirectTo: string
}

export default function StudentForm({ teachers, salesAgents, student, redirectTo }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!student?.id

  const [form, setForm] = useState({
    name:                 student?.name ?? '',
    email:                student?.email ?? '',
    country:              student?.country ?? '',
    phone:                student?.phone ?? '',
    payment_method:       student?.payment_method ?? '',
    currency:             student?.currency ?? 'USD',
    session_duration:     student?.session_duration ?? 60,
    assigned_teacher_id:  student?.assigned_teacher_id ?? '',
    added_by_sales_id:    student?.added_by_sales_id ?? '',
    student_status:       student?.student_status ?? 'trial',
    payment_status:       student?.payment_status ?? 'pending',
    reminder_date:        student?.reminder_date ?? '',
    notes:                student?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleCountryChange(country: string) {
    const currency = COUNTRY_CURRENCY[country] ?? 'USD'
    setForm(f => ({ ...f, country, currency: currency as any }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const payload = {
      ...form,
      assigned_teacher_id: form.assigned_teacher_id || null,
      added_by_sales_id:   form.added_by_sales_id || null,
      reminder_date:       form.reminder_date || null,
      session_duration:    Number(form.session_duration),
    }
    const { error: err } = isEdit
      ? await supabase.from('students').update(payload).eq('id', student!.id!)
      : await supabase.from('students').insert(payload)
    if (err) { setError(err.message); setLoading(false); return }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Info */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold text-gray-900">Personal Information</h3></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+44 7..." />
          </div>
          <div>
            <label className="label">Country</label>
            <select className="input" value={form.country} onChange={e => handleCountryChange(e.target.value)}>
              <option value="">Select country</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Learning Config */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold text-gray-900">Learning Configuration</h3></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Assigned Teacher</label>
            <select className="input" value={form.assigned_teacher_id} onChange={e => setForm(f => ({...f, assigned_teacher_id: e.target.value}))}>
              <option value="">Select teacher</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.profile?.name} — {t.specialties?.join(', ')} ({t.languages?.join(', ')})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Session Duration</label>
            <select className="input" value={form.session_duration} onChange={e => setForm(f => ({...f, session_duration: Number(e.target.value) as 30|60}))}>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes (1 hour)</option>
            </select>
          </div>
          <div>
            <label className="label">Student Status</label>
            <select className="input" value={form.student_status} onChange={e => setForm(f => ({...f, student_status: e.target.value as any}))}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="label">Added by (Sales Agent)</label>
            <select className="input" value={form.added_by_sales_id} onChange={e => setForm(f => ({...f, added_by_sales_id: e.target.value}))}>
              <option value="">Select agent</option>
              {salesAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold text-gray-900">Payment Details</h3></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Currency</label>
            <select className="input" value={form.currency} onChange={e => setForm(f => ({...f, currency: e.target.value as any}))}>
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="EUR">EUR — Euro</option>
              <option value="AED">AED — UAE Dirham</option>
            </select>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value as any}))}>
              <option value="">Select method</option>
              {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Payment Status</label>
            <select className="input" value={form.payment_status} onChange={e => setForm(f => ({...f, payment_status: e.target.value as any}))}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <div>
            <label className="label">Reminder Date</label>
            <input type="date" className="input" value={form.reminder_date} onChange={e => setForm(f => ({...f, reminder_date: e.target.value}))} />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <div className="card-body">
          <label className="label">Notes</label>
          <textarea className="input h-24" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Any additional notes..." />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Student'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
