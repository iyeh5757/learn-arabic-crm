'use client'
// app/(dashboard)/supervisor/sessions/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SupervisorSessionsPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTeachers() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('teachers')
        .select('id, profile:profiles!teachers_user_id_fkey(name)')
        .eq('supervisor_id', user.id)
        .eq('is_active', true)
      setTeachers(data ?? [])
    }
    loadTeachers()
  }, [])

  useEffect(() => {
    setLoading(true)
    async function loadSessions() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: myTeachers } = await supabase
        .from('teachers').select('id').eq('supervisor_id', user.id)

      const teacherIds = myTeachers?.map(t => t.id) ?? []
      if (teacherIds.length === 0) { setSessions([]); setLoading(false); return }

      const [yr, mo] = selectedMonth.split('-').map(Number)
      const monthStart = `${selectedMonth}-01`
      const lastDay = new Date(yr, mo, 0).getDate()
      const monthEnd = `${selectedMonth.split('-')[0]}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

      let query = supabase
        .from('sessions')
        .select('*, student:students!left(name), teacher:teachers!left(id, profile:profiles!teachers_user_id_fkey(name))')
        .in('teacher_id', teacherIds)
        .gte('session_date', monthStart)
        .lte('session_date', monthEnd)
        .order('session_date', { ascending: false })

      if (selectedTeacher) query = query.eq('teacher_id', selectedTeacher)

      const { data } = await query
      setSessions(data ?? [])
      setLoading(false)
    }
    loadSessions()
  }, [selectedTeacher, selectedMonth])

  const attColor: Record<string, { bg: string; text: string }> = {
    attended:  { bg: '#ECFDF5', text: '#059669' },
    'no-show': { bg: '#FEF2F2', text: '#DC2626' },
    cancelled: { bg: '#F3F4F6', text: '#6B7280' },
    scheduled: { bg: '#EFF6FF', text: '#2563EB' },
  }

  const inp = { padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', background: '#fff' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Sessions</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
          {sessions.length} sessions — {new Date(`${selectedMonth}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={inp} />
        <select style={{ ...inp, minWidth: '180px' }} value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
          <option value="">All My Teachers</option>
          {teachers.map((t: any) => (
            <option key={t.id} value={t.id}>{t.profile?.name}</option>
          ))}
        </select>
        <span style={{ padding: '8px 14px', background: '#F3F4F6', borderRadius: '8px', fontSize: '13px', color: '#374151', fontWeight: '600' }}>
          {sessions.length} sessions
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total', value: sessions.length, color: '#2563EB' },
          { label: 'Attended', value: sessions.filter(s => s.attendance_status === 'attended').length, color: '#059669' },
          { label: 'No-Show', value: sessions.filter(s => s.attendance_status === 'no-show').length, color: '#DC2626' },
          { label: 'Cancelled', value: sessions.filter(s => s.attendance_status === 'cancelled').length, color: '#6B7280' },
          { label: 'Scheduled', value: sessions.filter(s => s.attendance_status === 'scheduled').length, color: '#0891B2' },
          { label: 'Trials', value: sessions.filter(s => s.session_type === 'trial').length, color: '#D97706' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>No sessions found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Date', 'Student', 'Teacher', 'Type', 'Duration', 'Attendance', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any) => {
                  const ac = attColor[s.attendance_status] ?? { bg: '#F3F4F6', text: '#374151' }
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {new Date(s.session_date).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: '600', color: '#111827' }}>{s.student?.name ?? '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{s.teacher?.profile?.name ?? '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: s.session_type === 'trial' ? '#FFF7ED' : '#F0FDF4', color: s.session_type === 'trial' ? '#C2410C' : '#16A34A', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                          {s.session_type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#6B7280' }}>{s.duration} min</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: ac.bg, color: ac.text, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                          {s.attendance_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <Link href={`/supervisor/sessions/${s.id}/edit`} style={{ padding: '4px 10px', background: '#EFF6FF', color: '#2563EB', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
