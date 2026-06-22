'use client'
import { useState, useEffect, useCallback } from 'react'

const TEACHER_COLORS = ['#2563EB','#16A34A','#9333EA','#EA580C','#0891B2','#DB2777','#CA8A04','#4F46E5','#059669','#DC2626','#7C3AED','#0D9488']
const DURATIONS = [30, 40, 60, 90, 120]

type Teacher = { id: string; name: string }

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
  const [results, setResults] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const entries = await Promise.all(teachers.map(async t => {
      try {
        const res = await fetch(`/api/calendar/availability?teacher_id=${t.id}&date=${date}&duration=${duration}`)
        const data = await res.json()
        return [t.id, Array.isArray(data.slots) ? data.slots : []] as [string, string[]]
      } catch { return [t.id, []] as [string, string[]] }
    }))
    setResults(Object.fromEntries(entries))
    setLoading(false)
  }, [teachers, date, duration])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DATE</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DURATION</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {DURATIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)}
                style={{ padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1.5px solid', borderColor: duration === d ? '#0D1B2A' : '#E5E7EB', background: duration === d ? '#0D1B2A' : '#fff', color: duration === d ? '#E8C97A' : '#6B7280' }}>
                {d}m
              </button>
            ))}
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding: '8px 16px', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: '#0D1B2A', cursor: 'pointer' }}>
          {loading ? 'Loading…' : '🔄 Refresh'}
        </button>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px' }}>
        {teachers.map((t, i) => {
          const color = TEACHER_COLORS[i % TEACHER_COLORS.length]
          const slots = results[t.id] ?? []
          return (
            <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px', borderTop: `4px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>{t.name}</span>
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

      <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
        Free slots are computed live from each teacher's booked sessions and blocked time. Book a slot from the main Calendar.
      </div>
    </div>
  )
}
