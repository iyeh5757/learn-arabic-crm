'use client'
// components/forms/PaymentForm.tsx
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  students: any[]
  currentUserId: string
  payment?: any
  redirectTo: string
  preselectedStudentId?: string
}

const PLANS = {
  '60': [
    { sessions: 4,  label: '4 sessions' },
    { sessions: 8,  label: '8 sessions' },
    { sessions: 12, label: '12 sessions' },
    { sessions: 16, label: '16 sessions ⭐ Popular', popular: true },
    { sessions: 20, label: '20 sessions' },
  ],
  '30': [
    { sessions: 4,  label: '4 sessions' },
    { sessions: 8,  label: '8 sessions' },
    { sessions: 12, label: '12 sessions' },
    { sessions: 16, label: '16 sessions ⭐ Popular', popular: true },
    { sessions: 20, label: '20 sessions' },
  ],
}

export default function PaymentForm({ students, currentUserId, payment, redirectTo, preselectedStudentId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!payment?.id

  const [form, setForm] = useState({
    student_id:         payment?.student_id ?? preselectedStudentId ?? '',
    number_of_classes:  payment?.number_of_classes ?? 16,
    amount:             payment?.amount ?? '',
    currency:           payment?.currency ?? 'USD',
    payment_method:     payment?.payment_method ?? '',
    status:             payment?.status ?? 'pending',
    payment_date:       payment?.payment_date ?? new Date().toISOString().split('T')[0],
    is_renewal:         payment?.is_renewal ?? false,
    notes:              payment?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedStudent = students.find(s => s.id === form.student_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const payload = {
      ...form,
      number_of_classes: Number(form.number_of_classes),
      amount:            Number(form.amount),
      added_by:          currentUserId,
      payment_date:      form.payment_date || null,
    }
    const { error: err } = isEdit
      ? await supabase.from('payments').update(payload).eq('id', payment.id)
      : await supabase.from('payments').insert(payload)
    if (err) { setError(err.message); setLoading(false); return }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Payment Details</h3></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Student *</label>
            <select className="input" value={form.student_id}
              onChange={e => {
                const s = students.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, student_id: e.target.value, currency: s?.currency ?? f.currency }))
              }} required>
              <option value="">Select student</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.currency} — {s.student_status}</option>
              ))}
            </select>
            {selectedStudent && (
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span>Current classes: <strong>{selectedStudent.total_paid_classes}</strong></span>
                <span>Remaining: <strong>{selectedStudent.total_paid_classes - selectedStudent.consumed_classes}</strong></span>
                <span>Duration: <strong>{selectedStudent.session_duration} min</strong></span>
              </div>
            )}
          </div>

          <div>
            <label className="label">Number of Classes *</label>
            <select className="input" value={form.number_of_classes}
              onChange={e => setForm(f => ({...f, number_of_classes: Number(e.target.value)}))}>
              {PLANS[selectedStudent?.session_duration === 30 ? '30' : '60'].map(p => (
                <option key={p.sessions} value={p.sessions}>{p.label}</option>
              ))}
              <option value={1}>Custom amount</option>
            </select>
          </div>

          <div>
            <label className="label">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {form.currency === 'USD' ? '$' : form.currency === 'GBP' ? '£' : form.currency === 'EUR' ? '€' : 'AED'}
              </span>
              <input type="number" step="0.01" className="input pl-8" value={form.amount}
                onChange={e => setForm(f => ({...f, amount: e.target.value}))} required />
            </div>
          </div>

          <div>
            <label className="label">Currency *</label>
            <select className="input" value={form.currency} onChange={e => setForm(f => ({...f, currency: e.target.value as any}))}>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="AED">AED</option>
            </select>
          </div>

          <div>
            <label className="label">Payment Method *</label>
            <select className="input" value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))} required>
              <option value="">Select method</option>
              {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Payment Status</label>
            <select className="input" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as any}))}>
              <option value="pending">Pending</option>
              <option value="paid">✅ Paid</option>
              <option value="declined">❌ Declined</option>
            </select>
          </div>

          <div>
            <label className="label">Payment Date</label>
            <input type="date" className="input" value={form.payment_date}
              onChange={e => setForm(f => ({...f, payment_date: e.target.value}))} />
          </div>

          <div className="flex items-center gap-3 pt-5">
            <input type="checkbox" id="is_renewal" checked={form.is_renewal}
              onChange={e => setForm(f => ({...f, is_renewal: e.target.checked}))}
              className="w-4 h-4 accent-[#C9A84C]" />
            <label htmlFor="is_renewal" className="text-sm font-medium text-gray-700">This is a renewal payment</label>
          </div>

          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input h-20" value={form.notes}
              onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              placeholder="Payment reference, notes..." />
          </div>
        </div>
      </div>

      {form.status === 'paid' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          <strong>⚡ Auto-action:</strong> Marking as paid will automatically add {form.number_of_classes} classes to this student and generate a commission for their sales agent.
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving…' : isEdit ? 'Update Payment' : 'Add Payment'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
