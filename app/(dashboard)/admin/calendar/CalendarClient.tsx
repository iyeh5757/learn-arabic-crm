'use client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const inp: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '8px',
  fontSize: '13px', width: '100%', outline: 'none',
}
const label: React.CSSProperties = {
  fontSize: '11px', fontWeight: '700', color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block',
}

type SessionType = { id: string; name: string; color: string }
type Teacher = { id: string; name: string }
type Student = { id: string; name: string; email: string; phone: string }

interface Props {
  sessionTypes: SessionType[]
  teachers: Teacher[]
  students: Student[]
}

const EMPTY_FORM = {
  session_type_id: '', teacher_id: '', student_id: '',
  student_name: '', student_email: '', student_phone: '',
  date: '', start_time: '', duration_minutes: 60,
  notes: '', recurring: false,
  days: [] as number[],
  force: false, force_reason: '',
}

export default function CalendarClient({ sessionTypes, teachers, students }: Props) {
  const calRef = useRef<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [form, setForm]     = useState({ ...EMPTY_FORM })
  const [modal, setModal]   = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [selected, setSelected] = useState<any>(null)
  const supabase = createClient()

  const loadEvents = useCallback(async (fetchInfo: any, successCb: any) => {
    const res = await fetch(
      `/api/calendar/sessions?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
    )
    const data = await res.json()
    successCb((data ?? []).map((s: any) => ({
      id:            s.id,
      title:         `${s.student_name ?? 'Session'} — ${s.session_type?.name ?? ''}`,
      start:         s.start_at,
      end:           s.end_at,
      backgroundColor: s.session_type?.color ?? '#6B7280',
      borderColor:     s.session_type?.color ?? '#6B7280',
      textColor:       '#fff',
      extendedProps:   s,
    })))
  }, [])

  function openNew(dateStr?: string) {
    setForm({ ...EMPTY_FORM, date: dateStr ?? '' })
    setConflict(false); setError(''); setModal(true)
  }

  function handleStudentSelect(id: string) {
    const s = students.find(x => x.id === id)
    setForm(f => ({ ...f, student_id: id, student_name: s?.name ?? '', student_email: s?.email ?? '', student_phone: s?.phone ?? '' }))
  }

  async function handleSubmit(force = false) {
    setSaving(true); setError('')
    const start = new Date(`${form.date}T${form.start_time}:00`)
    const end   = new Date(start.getTime() + form.duration_minutes * 60000)

    const payload = {
      session_type_id:  form.session_type_id || null,
      teacher_id:       form.teacher_id,
      student_id:       form.student_id || null,
      student_name:     form.student_name,
      student_email:    form.student_email,
      student_phone:    form.student_phone,
      start_at:         start.toISOString(),
      end_at:           end.toISOString(),
      duration_minutes: form.duration_minutes,
      notes:            form.notes,
      force_booked:     force,
      force_booked_reason: force ? form.force_reason : null,
    }

    const res = await fetch('/api/calendar/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (res.status === 409) {
      setConflict(true); setSaving(false); return
    }
    if (!res.ok) {
      setError(data?.error ?? 'Failed to save'); setSaving(false); return
    }

    // If recurring, create the rule
    if (form.recurring && form.days.length > 0) {
      await supabase.from('recurring_rules').insert({
        teacher_id:       form.teacher_id,
        student_id:       form.student_id || null,
        session_type_id:  form.session_type_id || null,
        days_of_week:     form.days,
        start_time:       form.start_time + ':00',
        duration_minutes: form.duration_minutes,
      })
    }

    calRef.current?.getApi()?.refetchEvents()
    setModal(false); setSaving(false)
  }

  function toggleDay(d: number) {
    setForm(f => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d],
    }))
  }

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const selectedType = sessionTypes.find(t => t.id === form.session_type_id)

  return (
    <>
      {/* FullCalendar */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'timeGridWeek,timeGridDay,dayGridMonth,listWeek',
          }}
          buttonText={{ today: 'Today', week: 'Week', day: 'Day', month: 'Month', list: 'Agenda' }}
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          allDaySlot={false}
          nowIndicator
          selectable
          selectMirror
          editable={false}
          events={loadEvents}
          select={info => openNew(info.startStr.slice(0, 10))}
          eventClick={info => setSelected(info.event.extendedProps)}
          height="calc(100vh - 200px)"
          timeZone="Africa/Cairo"
        />
      </div>

      {/* Event detail popup */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}
        >
          <div style={{ background: '#fff', borderRadius: '16px', width: '340px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)', borderTop: `4px solid ${selected.session_type?.color ?? '#6B7280'}` }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{selected.student_name}</div>
                <div style={{ fontSize: '13px', color: selected.session_type?.color, fontWeight: '600', marginTop: '2px' }}>{selected.session_type?.name}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', color: '#4B5563' }}>📅 {new Date(selected.start_at).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              <div style={{ fontSize: '13px', color: '#4B5563' }}>👩‍🏫 {selected.teacher?.profile?.name}</div>
              <div style={{ fontSize: '13px', color: '#4B5563' }}>⏱ {selected.duration_minutes} minutes</div>
              {selected.recurring_rule_id && <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '600' }}>🔄 Recurring session</div>}
              {selected.force_booked && <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: '600' }}>⚠️ Force booked</div>}
              <div style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: selected.status === 'scheduled' ? '#DCFCE7' : '#FEF2F2', color: selected.status === 'scheduled' ? '#065F46' : '#991B1B', display: 'inline-block', fontWeight: '600', width: 'fit-content' }}>
                {selected.status}
              </div>
            </div>
            {selected.google_meet_link && (
              <div style={{ padding: '0 20px 20px' }}>
                <a href={selected.google_meet_link} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
                  🎥 Join Google Meet
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>📅 Book New Session</div>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Session type pills */}
              <div>
                <span style={label}>Session Type</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {sessionTypes.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, session_type_id: t.id }))}
                      style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: `2px solid ${form.session_type_id === t.id ? t.color : '#E5E7EB'}`, background: form.session_type_id === t.id ? t.color + '20' : '#F9FAFB', color: t.color }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={label}>Student</label>
                  <select style={inp} value={form.student_id} onChange={e => handleStudentSelect(e.target.value)}>
                    <option value="">Select student…</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Teacher</label>
                  <select style={inp} value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                    <option value="">Select teacher…</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Date / time / duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={label}>Date</label>
                  <input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Start Time</label>
                  <input type="time" style={inp} value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Duration</label>
                  <select style={inp} value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}>
                    {[30, 40, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={label}>Notes</label>
                <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Session notes…" />
              </div>

              {/* Recurring toggle */}
              <div style={{ background: '#F9FAFB', borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: form.recurring ? '12px' : '0' }}>
                  <button onClick={() => setForm(f => ({ ...f, recurring: !f.recurring, days: [] }))}
                    style={{ width: '40px', height: '22px', borderRadius: '11px', background: form.recurring ? '#0D1B2A' : '#D1D5DB', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', top: '3px', left: form.recurring ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>🔄 Recurring Schedule</span>
                </div>
                {form.recurring && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '8px' }}>Select days (runs indefinitely until cancelled)</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {DAY_LABELS.map((d, i) => (
                        <button key={i} onClick={() => toggleDay(i)}
                          style={{ padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1.5px solid', borderColor: form.days.includes(i) ? '#0D1B2A' : '#E5E7EB', background: form.days.includes(i) ? '#0D1B2A' : '#fff', color: form.days.includes(i) ? '#E8C97A' : '#6B7280' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Conflict warning */}
              {conflict && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#92400E', fontWeight: '600' }}>⚠️ Scheduling Conflict</div>
                  <div style={{ fontSize: '12px', color: '#92400E' }}>This teacher already has a session at this time. Enter a reason to force-book:</div>
                  <input style={inp} placeholder="Reason for force booking…" value={form.force_reason} onChange={e => setForm(f => ({ ...f, force_reason: e.target.value }))} />
                </div>
              )}

              {error && <div style={{ color: '#DC2626', fontSize: '13px', background: '#FEF2F2', padding: '10px', borderRadius: '8px' }}>{error}</div>}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '9px 20px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              {conflict
                ? <button onClick={() => handleSubmit(true)} disabled={!form.force_reason || saving}
                    style={{ padding: '9px 20px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : 'Force Book →'}
                  </button>
                : <button onClick={() => handleSubmit(false)} disabled={!form.teacher_id || !form.date || !form.start_time || saving}
                    style={{ padding: '9px 20px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : 'Book Session →'}
                  </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => openNew()}
        style={{ position: 'fixed', bottom: '28px', right: '28px', width: '52px', height: '52px', borderRadius: '50%', background: '#0D1B2A', color: '#E8C97A', border: 'none', fontSize: '24px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        +
      </button>
    </>
  )
}
