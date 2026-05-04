'use client'
// app/(dashboard)/supervisor/sessions/[id]/edit/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

export default function SupervisorSessionEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<any>(null)

  useEffect(() => {
    supabase.from('sessions').select('*, student:students(name), teacher:teachers(profile:profiles!teachers_user_id_fkey(name))').eq('id', id).single().then(({ data }) => {
      if (data) setForm(data)
      setLoading(false)
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error: err } = await supabase.from('sessions').update({
      attendance_status: form.attendance_status,
      trial_status: form.trial_status || null,
      student_rating: form.student_rating ? Number(form.student_rating) : null,
      homework: form.homework,
      feedback: form.feedback || null,
      notes: form.notes || null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/supervisor/sessions')
    router.refresh()
  }

  const inp = { width: '100%', padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }
  const lbl = { display: 'block', fontSize: '11px', fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '6px' }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#6B7280' }}>Loading…</div>
  if (!form) return <div style={{ padding: '60px', textAlign: 'center', color: '#DC2626' }}>Session not found</div>

  return (
    <div style={{ maxWidth: '700px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Review Session</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>
          {form.student?.name} · {form.teacher?.profile?.name} · {new Date(form.session_date).toLocaleDateString('en-GB')}
        </p>
      </div>

      {/* Read-only info */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div><p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Type</p><p style={{ fontWeight: '600', color: '#111827', margin: 0 }}>{form.session_type}</p></div>
        <div><p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Duration</p><p style={{ fontWeight: '600', color: '#111827', margin: 0 }}>{form.duration}min</p></div>
        <div><p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Date</p><p style={{ fontWeight: '600', color: '#111827', margin: 0 }}>{new Date(form.session_date).toLocaleDateString('en-GB')}</p></div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827' }}>Update Session</div>
          <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div><label style={lbl}>Attendance</label>
              <select style={inp} value={form.attendance_status} onChange={e => setForm((f: any) => ({...f, attendance_status: e.target.value}))}>
                <option value="attended">✅ Attended</option>
                <option value="no-show">❌ No-Show</option>
                <option value="cancelled">Cancelled</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            {form.session_type === 'trial' && (
              <div>
                <label style={lbl}>Trial Outcome</label>
                <select style={inp} value={form.trial_status ?? 'pending'} onChange={e => setForm((f: any) => ({...f, trial_status: e.target.value}))}>
                  <option value="pending">⏳ Pending</option>
                  <option value="converted">✅ Converted</option>
                  <option value="lost">❌ Lost</option>
                </select>
              </div>
            )}
            <div><label style={lbl}>Student Rating</label>
              <select style={inp} value={form.student_rating ?? ''} onChange={e => setForm((f: any) => ({...f, student_rating: e.target.value}))}>
                <option value="">No rating</option>
                {[1,2,3,4,5].map(r => <option key={r} value={r}>{'⭐'.repeat(r)} {r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
              <input type="checkbox" id="hw" checked={form.homework} onChange={e => setForm((f: any) => ({...f, homework: e.target.checked}))} style={{ width: '16px', height: '16px', accentColor: '#C9A84C' }} />
              <label htmlFor="hw" style={{ fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>Homework assigned</label>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Feedback</label>
              <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={form.feedback ?? ''} onChange={e => setForm((f: any) => ({...f, feedback: e.target.value}))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Supervisor Notes</label>
              <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.notes ?? ''} onChange={e => setForm((f: any) => ({...f, notes: e.target.value}))} />
            </div>
          </div>
        </div>

        {form.session_type === 'trial' && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>
            ⚠️ Marking a trial as <strong>Converted</strong> will update the trial status. The sales agent can then add a payment to activate the student.
          </div>
        )}

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
