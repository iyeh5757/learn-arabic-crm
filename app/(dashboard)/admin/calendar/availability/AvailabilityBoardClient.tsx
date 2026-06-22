'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'

const TEACHER_COLORS = ['#2563EB','#16A34A','#9333EA','#EA580C','#0891B2','#DB2777','#CA8A04','#4F46E5','#059669','#DC2626','#7C3AED','#0D9488']
const DURATIONS = [30, 40, 60, 90, 120]

type Teacher = { id: string; name: string; specialties: string[]; languages: string[] }

function todayCairo() {
  const p: any = {}
  for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())) p[x.type] = x.value
  return `${p.year}-${p.month}-${p.day}`
}
function fmt(time: string) {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function AvailabilityBoardClient({ teachers }: { teachers: Teacher[] }) {
  const [date, setDate] = useState(todayCairo())
  const [duration, setDuration] = useState(60)
  const [dialect, setDialect] = useState('')
  const [language, setLanguage] = useState('')
  const [results, setResults] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  // Build filter options from what teachers actually have
  const dialectOptions = useMemo(() => Array.from(new Set(teachers.flatMap(t => t.specialties))).sort(), [teachers])
  const languageOptions = useMemo(() => Array.from(new Set(teachers.flatMap(t => t.languages))).sort(), [teachers])

  // Teachers matching the dialect + language filters
  const filteredTeachers = useMemo(() => teachers.filter(t =>
    (!dialect || t.specialties.includes(dialect)) &&
    (!language || t.languages.includes(language))
  ), [teachers, dialect, language])

  const load = useCallback(async () => {
    setLoading(true)
    const entries = await Promise.all(filteredTeachers.map(async t => {
      try {
        const res = await fetch(`/api/calendar/availability?teacher_id=${t.id}&date=${date}&duration=${duration}`)
        const data = await res.json()
        return [t.id, Array.isArray(data.slots) ? data.slots : []] as [string, string[]]
      } catch { return [t.id, []] as [string, string[]] }
    }))
    setResults(Object.fromEntries(entries))
    setLoading(false)
  }, [filteredTeachers, date, duration])

  useEffect(() => { load() }, [load])

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
    border: '1.5px solid', borderColor: active ? '#0D1B2A' : '#E5E7EB',
    background: active ? '#0D1B2A' : '#fff', color: active ? '#E8C97A' : '#6B7280',
  })
  const colorFor = (id: string) => TEACHER_COLORS[teachers.findIndex(t => t.id === id) % TEACHER_COLORS.length]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DATE</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DIALECT</div>
          <select value={dialect} onChange={e => setDialect(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none', background: dialect ? '#0D1B2A' : '#fff', color: dialect ? '#E8C97A' : '#334155', fontWeight: dialect ? 700 : 400 }}>
            <option value="">All dialects</option>
            {dialectOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>TEACHES IN (LANGUAGE)</div>
          <select value={language} onChange={e => setLanguage(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none', background: language ? '#0D1B2A' : '#fff', color: language ? '#E8C97A' : '#334155', fontWeight: language ? 700 : 400 }}>
            <option value="">All languages</option>
            {languageOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DURATION</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {DURATIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)} style={pill(duration === d)}>{d}m</button>
            ))}
          </div>
        </div>
        {(dialect || language) && (
          <button onClick={() => { setDialect(''); setLanguage('') }}
            style={{ padding: '7px 12px', background: '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#475569' }}>
            ✕ Clear
          </button>
        )}
        <button onClick={load} disabled={loading}
          style={{ padding: '8px 16px', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: '#0D1B2A', cursor: 'pointer', marginLeft: 'auto' }}>
          {loading ? 'Loading…' : '🔄 Refresh'}
        </button>
      </div>

      {/* Results */}
      {filteredTeachers.length === 0 ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px', color: '#B91C1C', fontSize: '13px' }}>
          No teachers match these filters{dialect ? ` · ${dialect}` : ''}{language ? ` · ${language}` : ''}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
          {filteredTeachers.map(t => {
            const color = colorFor(t.id)
            const slots = results[t.id] ?? []
            return (
              <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', borderTop: `4px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{t.name}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '10px' }}>
                  {(t.specialties.join(', ') || 'No dialects set')}{t.languages.length ? ` · in ${t.languages.join(', ')}` : ''}
                </div>
                {loading ? (
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>Checking…</div>
                ) : slots.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: '600' }}>No free slots</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {slots.map(s => (
                      <span key={s} style={{ padding: '4px 10px', background: color + '18', color, border: `1px solid ${color}55`, borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
                        {fmt(s)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
        Free slots are computed live from each teacher's booked sessions and blocked time (available 24h otherwise). Book a slot from the main Calendar.
      </div>
    </div>
  )
}
