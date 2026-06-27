'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type Opt = { id: string; name: string }

export default function Filters({ supervisors, teachers, months, hideSupervisor }: { supervisors: Opt[]; teachers: (Opt & { supervisor_id: string | null })[]; months: string[]; hideSupervisor?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const supervisorId = sp.get('supervisor') ?? ''
  const teacherId    = sp.get('teacher') ?? ''
  const month        = sp.get('month') ?? ''

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value); else params.delete(key)
    // changing supervisor clears teacher
    if (key === 'supervisor') params.delete('teacher')
    router.push(`${pathname}?${params.toString()}`)
  }

  const teacherOpts = supervisorId ? teachers.filter(t => t.supervisor_id === supervisorId) : teachers
  const sel: React.CSSProperties = { padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', background: '#fff', color: '#334155' }

  return (
    <div style={{ background: '#fff', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
      {!hideSupervisor && (
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '5px' }}>SUPERVISOR</div>
        <select value={supervisorId} onChange={e => setParam('supervisor', e.target.value)} style={sel}>
          <option value="">All supervisors</option>
          {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      )}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '5px' }}>TEACHER</div>
        <select value={teacherId} onChange={e => setParam('teacher', e.target.value)} style={sel}>
          <option value="">All teachers</option>
          {teacherOpts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', marginBottom: '5px' }}>MONTH</div>
        <select value={month} onChange={e => setParam('month', e.target.value)} style={sel}>
          <option value="">All time</option>
          {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</option>)}
        </select>
      </div>
      {(supervisorId || teacherId || month) && (
        <button onClick={() => router.push(pathname)}
          style={{ padding: '8px 12px', background: '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
          ✕ Clear
        </button>
      )}
    </div>
  )
}
