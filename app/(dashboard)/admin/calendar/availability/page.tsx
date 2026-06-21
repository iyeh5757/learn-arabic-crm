'use client'
import { useState } from 'react'

const btn = (active: boolean): React.CSSProperties => ({
  padding: '7px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
  cursor: 'pointer', border: '1.5px solid',
  borderColor: active ? '#0D1B2A' : '#E5E7EB',
  background:  active ? '#0D1B2A' : '#fff',
  color:       active ? '#E8C97A' : '#6B7280',
})

const DIALECTS = ['All Dialects', 'Egyptian Arabic', 'MSA', 'Gulf Arabic', 'Levantine Arabic', 'Quran']
const DURATIONS = [30, 40, 60, 90, 120]

// Static preview data — will be replaced by live API call after migration
const PREVIEW_TEACHERS = [
  { id: '1', name: 'Esraa', specialties: ['Egyptian Arabic', 'MSA'], students: 12, slots: ['09:00','11:00','14:00','17:00'] },
  { id: '2', name: 'Sara',  specialties: ['MSA', 'Gulf Arabic'],      students: 8,  slots: ['10:00','15:00','18:00'] },
  { id: '3', name: 'Nour',  specialties: ['Quran', 'Levantine Arabic'],students: 6,  slots: ['13:00','16:00','19:00'] },
  { id: '4', name: 'Ahmed', specialties: ['Egyptian Arabic'],          students: 10, slots: [] },
]

function formatSlot(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2,'0')} ${ampm}`
}

export default function AvailabilityBoard() {
  const [date,     setDate]     = useState(new Date().toISOString().slice(0,10))
  const [dialect,  setDialect]  = useState('All Dialects')
  const [duration, setDuration] = useState(60)

  const filtered = PREVIEW_TEACHERS.filter(t =>
    dialect === 'All Dialects' || t.specialties.includes(dialect)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 4px' }}>🔍 Availability Search Board</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Find available teachers and book instantly</p>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DATE</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DIALECT</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DIALECTS.map(d => (
              <button key={d} onClick={() => setDialect(d)} style={btn(dialect === d)}>{d}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', marginBottom: '6px' }}>DURATION</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {DURATIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)} style={btn(duration === d)}>{d}m</button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
        {filtered.map(t => (
          <div key={t.id} style={{ background: '#fff', border: `1px solid ${t.slots.length === 0 ? '#FECACA' : '#E5E7EB'}`, borderRadius: '14px', padding: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827', marginBottom: '2px' }}>{t.name}</div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '10px' }}>
              {t.specialties.join(' · ')} &nbsp;·&nbsp; {t.students} students
            </div>
            {t.slots.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: '600' }}>Unavailable today</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {t.slots.map(s => (
                  <button key={s}
                    onClick={() => window.location.href = `/admin/calendar?teacher=${t.id}&date=${date}&time=${s}&duration=${duration}`}
                    style={{ padding: '5px 10px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    {formatSlot(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '8px' }}>
        🚧 Preview mode — slots shown are static examples. Live availability will load from the database after the schema migration is applied.
      </div>
    </div>
  )
}
