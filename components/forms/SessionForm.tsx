'use client'
// components/forms/SessionForm.tsx
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  students: any[]
  teacherId: string
  session?: any
  redirectTo: string
  role: string
}

export default function SessionForm({ students, teacherId, session, redirectTo, role }: Props) {
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  const router = useRouter()
  const supabase = createClient()
  const isEdit = !!session?.id

  const [form, setForm] = useState({
    student_id:        session?.student_id ?? '',
    session_date:      session?.session_date ?? today,
    session_time:      session?.session_time ?? '',
    duration:          session?.duration ?? 60,
    session_type:      session?.session_type ?? 'paid',
    attendance_status: session?.attendance_status ?? 'scheduled',
    homework:          session?.homework ?? false,
    feedback:          session?.feedback ?? '',
    student_rating:    session?.student_rating ?? '',
    trial_status:      session?.trial_status ?? '',
    notes:             session?.notes ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedStudent = students.find(s => s.id === form.student_id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const payload = {
      ...form,
      teacher_id:     teacherId,
      duration:       Number(form.duration),
      student_rating: form.student_rating ? Number(form.student_rating) : null,
      trial_status:   form.session_type === 'trial' ? (form.trial_status || 'pending') : null,
      session_time:   form.session_time || null,
    }
    const { error: err } = isEdit
      ? await supabase.from('sessions').update(payload).eq('id', session.id)
      : await supabase.from('sessions').insert(payload)
    if (err) { setError(err.message); setLoading(false); return }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Session Details</h3></div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Student *</label>
            <select className="input" value={form.student_id} onChange={e => setForm(f => ({...f, student_id: e.target.value}))} required>
              <option value="">Select student</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.remaining_classes ?? (s.total_paid_classes - s.consumed_classes)} classes left
                </option>
              ))}
            </select>
            {selectedStudent && (
              <p className={`text-xs mt-1 ${(selectedStudent.remaining_classes ?? (selectedStudent.total_paid_classes - selectedStudent.consumed_classes)) <= 2 ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                {selectedStudent.total_paid_classes - selectedStudent.consumed_classes} classes remaining · {selectedStudent.session_duration} min sessions
              </p>
            )}
          </div>
          <div>
            <label className="label">Session Date *</label>
            <input type="date" className="input" value={form.session_date} onChange={e => setForm(f => ({...f, session_date: e.target.value}))} required />
          </div>
          <div>
            <label className="label">Session Time</label>
            <input type="time" className="input" value={form.session_time} onChange={e => setForm(f => ({...f, session_time: e.target.value}))} />
          </div>
          <div>
            <label className="label">Duration</label>
            <select className="input" value={form.duration} onChange={e => setForm(f => ({...f, duration: Number(e.target.value) as any}))}>
              <option value={30}>30 minutes</option>
              <option value={40}>40 minutes</option>
              <option value={60}>60 minutes (1 hour)</option>
              <option value={90}>90 minutes (1.5 hours)</option>
              <option value={120}>120 minutes (2 hours)</option>
            </select>
          </div>
          <div>
            <label className="label">Session Type *</label>
            <select className="input" value={form.session_type} onChange={e => setForm(f => ({...f, session_type: e.target.value as any}))}>
              <option value="paid">Paid Session</option>
              <option value="trial">Trial Session</option>
            </select>
          </div>
          <div>
            <label className="label">Attendance</label>
            <select className="input" value={form.attendance_status} onChange={e => setForm(f => ({...f, attendance_status: e.target.value as any}))}>
              <option value="scheduled">Scheduled</option>
              <option value="attended">Attended ✓</option>
              <option value="no-show">No-Show ✗</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {form.session_type === 'trial' && (
            <div>
              <label className="label">Trial Outcome</label>
              <select className="input" value={form.trial_status} onChange={e => setForm(f => ({...f, trial_status: e.target.value as any}))}>
                <option value="pending">Pending</option>
                <option value="converted">✅ Converted</option>
                <option value="lost">❌ Lost</option>
              </select>
            </div>
          )}
          <div>
            <label className="label">Student Rating (1–5)</label>
            <select className="input" value={form.student_rating} onChange={e => setForm(f => ({...f, student_rating: e.target.value}))}>
              <option value="">No rating</option>
              {[1,2,3,4,5].map(r => <option key={r} value={r}>{'⭐'.repeat(r)} {r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input type="checkbox" id="homework" checked={form.homework}
              onChange={e => setForm(f => ({...f, homework: e.target.checked}))}
              className="w-4 h-4 accent-[#C9A84C]" />
            <label htmlFor="homework" className="text-sm font-medium text-gray-700">Homework assigned</label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-4">
          <div>
            <label className="label">Feedback / Notes</label>
            <textarea className="input h-24" value={form.feedback}
              onChange={e => setForm(f => ({...f, feedback: e.target.value}))}
              placeholder="Session notes, progress, areas to work on..." />
          </div>
          <div>
            <label className="label">Internal Notes</label>
            <textarea className="input h-16" value={form.notes}
              onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              placeholder="Internal notes (not visible to student)..." />
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving…' : isEdit ? 'Update Session' : 'Log Session'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
      </div>
    </form>
  )
}
