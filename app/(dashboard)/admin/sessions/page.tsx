'use client'
// app/(dashboard)/admin/sessions/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import DeleteSessionLogButton from '@/components/DeleteSessionLogButton'

export default function SessionsPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('teachers').select('id, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true).then(({ data }) => setTeachers(data ?? []))
    supabase.from('students').select('id, name, assigned_teacher_id').order('name').then(({ data }) => setStudents(data ?? []))
  }, [])

  useEffect(() => {
    setLoading(true)
    const monthStart = `${selectedMonth}-01`
    const [yr, mo] = selectedMonth.split('-').map(Number)
    const lastDay = new Date(yr, mo, 0).getDate()
    const monthEnd = `${selectedMonth.split('-')[0]}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    let query = supabase
      .from('sessions')
      .select('*, student:students!left(name), teacher:teachers!left(id, profile:profiles!teachers_user_id_fkey(name))')
      .gte('session_date', monthStart)
      .lte('session_date', monthEnd)
      .order('session_date', { ascending: false })
    if (selectedTeacher) query = query.eq('teacher_id', selectedTeacher)
    if (selectedStudent) query = query.eq('student_id', selectedStudent)
    query.then(({ data }) => { setSessions(data ?? []); setLoading(false) })
  }, [selectedTeacher, selectedStudent, selectedMonth])

  const attColor: Record<string, { bg: string; text: string }> = {
    attended:  { bg: '#ECFDF5', text: '#059669' },
    'no-show': { bg: '#FEF2F2', text: '#DC2626' },
    cancelled: { bg: '#F3F4F6', text: '#6B7280' },
    scheduled: { bg: '#FFFBEB', text: '#D97706' },
  }

  const inp = { padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Sessions</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>
            {sessions.length} sessions — {new Date(`${selectedMonth}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Month filter */}
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            style={{ ...inp, minWidth: '150px' }} />
          {/* Teacher filter — choosing a teacher scopes the student list below */}
          <select style={{ ...inp, minWidth: '180px' }} value={selectedTeacher} onChange={e => { setSelectedTeacher(e.target.value); setSelectedStudent('') }}>
            <option value="">All Teachers</option>
            {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.profile?.name}</option>)}
          </select>
          {/* Student filter — limited to the chosen teacher's students */}
          <select style={{ ...inp, minWidth: '180px' }} value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
            <option value="">{selectedTeacher ? 'All of this teacher’s students' : 'All Students'}</option>
            {students.filter((s: any) => !selectedTeacher || s.assigned_teacher_id === selectedTeacher).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {(selectedTeacher || selectedStudent) && (
            <button onClick={() => { setSelectedTeacher(''); setSelectedStudent('') }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              Clear ✕
            </button>
          )}
          <Link href="/admin/sessions/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
            + Log Session
          </Link>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Date', 'Student', 'Teacher', 'Type', 'Duration', 'Attendance', 'Trial Status', 'Rating', 'HW', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>Loading…</td></tr>}
              {!loading && sessions.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No sessions found</td></tr>}
              {sessions.map((s: any) => {
                const ac = attColor[s.attendance_status] || { bg: '#F3F4F6', text: '#374151' }
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(s.session_date).toLocaleDateString('en-GB')}
                      {s.session_time && <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{s.session_time.slice(0,5)}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{s.student?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{s.teacher?.profile?.name ?? '—'}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: s.session_type === 'trial' ? '#EFF6FF' : '#ECFDF5', color: s.session_type === 'trial' ? '#2563EB' : '#059669', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.session_type}</span></td>
                    <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{s.duration}m</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: ac.bg, color: ac.text, padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.attendance_status}</span></td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.trial_status ? <span style={{ background: s.trial_status === 'converted' ? '#ECFDF5' : s.trial_status === 'lost' ? '#FEF2F2' : '#FFFBEB', color: s.trial_status === 'converted' ? '#059669' : s.trial_status === 'lost' ? '#DC2626' : '#D97706', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s.trial_status}</span> : <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.student_rating ? '⭐'.repeat(s.student_rating) : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{s.homework ? '✅' : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Link href={`/admin/sessions/${s.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>Edit</Link>
                        <DeleteSessionLogButton sessionId={s.id} studentName={s.student?.name}
                          onDeleted={id => setSessions(prev => prev.filter(x => x.id !== id))} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
