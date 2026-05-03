'use client'
// app/(dashboard)/admin/sessions/new/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NewSessionPage() {
  const router = useRouter()
  const supabase = createClient()
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentTeacherId, setCurrentTeacherId] = useState('')

  const [form, setForm] = useState({
    student_id: '', teacher_id: '',
    session_date: new Date().toISOString().split('T')[0],
    session_time: '', duration: 60,
    session_type: 'paid', attendance_status: 'attended',
    homework: false, feedback: '', student_rating: '',
    trial_status: '', notes: '',
  })

  useEffect(() => {
    supabase.from('students').select('id, name, total_paid_classes, consumed_classes, session_duration, student_status').eq('student_status', 'active').order('name').then(({ data }) => setStudents(data ?? []))
    supabase.from('teachers').select('id, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true).then(({ data }) => setTeachers(data ?? []))
  }, [])

  const selectedStudent = students.find(s => s.id === form.student_id)
  const remaining = selectedStudent ? selectedStudent.total_paid_classes - selectedStudent.consumed_classes : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.student_id || !form.teacher_id) { setError('Please select a student and teacher'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.from('sessions').insert({
      ...form,
      duration: Number(form.duration),
      student_rating: form.student_rating ? Number(form.student_rating) : null,
      trial_status: form.session_type === 'trial' ? (form.trial_status || 'pending') : null,
      session_time: form.session_time || null,
      feedback: form.feedback || null,
      notes: form.notes || null,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/admin/sessions')
    router.refresh()
  }

  const inp = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }
  const card = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }
  const cardH = { padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600' as const, fontSize: '15px', color: '#111827' }
  const grid = { padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }

  return (
    <div style={{ maxWidth: '860px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Log New Session</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Record a completed or scheduled session</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={card}>
          <div style={cardH}>📅 Session Details</div>
          <div style={grid}>
            <div>
              <label style={lbl}>Student *</label>
              <select style={inp} value={form.student_id} onChange={e => setForm(f => ({...f, student_id: e.target.value}))} required>
                <option value="">Select student</option>
                {students.map(s => {
                  const rem = s.total_paid_classes - s.consumed_classes
                  return <option key={s.id} value={s.id}>{s.name} ({rem} classes left)</option>
                })}
              </select>
              {selectedStudent && (
                <p style={{ fontSize: '12px', marginTop: '4px', color: remaining !== null && remaining <= 2 ? '#D97706' : '#059669', fontWeight: '500' }}>
                  {remaining} classes remaining · {selectedStudent.session_duration}min sessions
                </p>
              )}
            </div>
            <div>
              <label style={lbl}>Teacher *</label>
              <select style={inp} value={form.teacher_id} onChange={e => setForm(f => ({...f, teacher_id: e.target.value}))} required>
                <option value="">Select teacher</option>
                {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.profile?.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Session Date *</label><input type="date" style={inp} value={form.session_date} onChange={e => setForm(f => ({...f, session_date: e.target.value}))} required /></div>
            <div><label style={lbl}>Session Time</label><input type="time" style={inp} value={form.session_time} onChange={e => setForm(f => ({...f, session_time: e.target.value}))} /></div>
            <div><label style={lbl}>Duration</label>
              <select style={inp} value={form.duration} onChange={e => setForm(f => ({...f, duration: Number(e.target.value) as any}))}>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
            <div><label style={lbl}>Session Type</label>
              <select style={inp} value={form.session_type} onChange={e => setForm(f => ({...f, session_type: e.target.value}))}>
                <option value="paid">Paid Session</option>
                <option value="trial">Trial Session</option>
              </select>
            </div>
            <div><label style={lbl}>Attendance</label>
              <select style={inp} value={form.attendance_status} onChange={e => setForm(f => ({...f, attendance_status: e.target.value}))}>
                <option value="attended">✅ Attended</option>
                <option value="no-show">❌ No-Show</option>
                <option value="cancelled">Cancelled</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            {form.session_type === 'trial' && (
              <div><label style={lbl}>Trial Outcome</label>
                <select style={inp} value={form.trial_status} onChange={e => setForm(f => ({...f, trial_status: e.target.value}))}>
                  <option value="pending">Pending</option>
                  <option value="converted">✅ Converted</option>
                  <option value="lost">❌ Lost</option>
                </select>
              </div>
            )}
            <div><label style={lbl}>Student Rating (1–5)</label>
              <select style={inp} value={form.student_rating} onChange={e => setForm(f => ({...f, student_rating: e.target.value}))}>
                <option value="">No rating</option>
                {[1,2,3,4,5].map(r => <option key={r} value={r}>{'⭐'.repeat(r)} {r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
              <input type="checkbox" id="hw" checked={form.homework} onChange={e => setForm(f => ({...f, homework: e.target.checked}))} style={{ width: '16px', height: '16px', accentColor: '#C9A84C' }} />
              <label htmlFor="hw" style={{ fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>Homework assigned</label>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div><label style={lbl}>Session Feedback / Progress Notes</label>
              <textarea style={{ ...inp, minHeight: '90px', resize: 'vertical' }} value={form.feedback} onChange={e => setForm(f => ({...f, feedback: e.target.value}))} placeholder="What was covered, student progress, areas to work on..." />
            </div>
            <div><label style={lbl}>Internal Notes</label>
              <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Internal notes only..." />
            </div>
          </div>
        </div>

        {form.session_type === 'paid' && form.attendance_status === 'attended' && (
          <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#065F46' }}>
            ⚡ Marking this as <strong>Paid + Attended</strong> will automatically deduct 1 class from the student's remaining balance.
          </div>
        )}

        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="submit" disabled={loading} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '12px 28px', borderRadius: '10px', border: 'none', fontWeight: '600', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving…' : 'Log Session'}
          </button>
          <button type="button" onClick={() => router.back()} style={{ background: 'transparent', color: '#6B7280', padding: '12px 22px', borderRadius: '10px', border: '1.5px solid #E5E7EB', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
