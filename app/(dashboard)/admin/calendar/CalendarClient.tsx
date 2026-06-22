'use client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import luxon3Plugin from '@fullcalendar/luxon3'
import { useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

const inp: React.CSSProperties = {
  padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px',
  fontSize: '13px', width: '100%', outline: 'none', background: '#fff',
}
const label: React.CSSProperties = {
  fontSize: '11px', fontWeight: '700', color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', display: 'block',
}

type SessionType = { id: string; name: string; color: string }
type Teacher = { id: string; name: string; email?: string; supervisor_id?: string | null }
type Supervisor = { id: string; name: string }
type Student = { id: string; name: string; email: string; phone: string }

interface Props {
  sessionTypes: SessionType[]
  teachers: Teacher[]
  supervisors: Supervisor[]
  students: Student[]
}

const EMPTY_FORM = {
  session_type_id: '', teacher_id: '', student_id: '',
  student_name: '', student_email: '', student_phone: '',
  date: '', start_time: '', duration_minutes: 60,
  notes: '', recurring: false,
  days: [] as number[],
  force: false, force_reason: '',
  open_access: true, auto_record: false,
  teacher_cohost: true, student_cohost: false, cohost_email: '',
}

// Offset (minutes) of a timezone at a given instant, via Intl — DST-safe.
function tzOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second)
  return (asUTC - date.getTime()) / 60000
}

// Convert a Cairo wall-clock date+time into the correct UTC instant,
// independent of the admin's browser timezone.
function cairoToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm]  = timeStr.split(':').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm))
  const offset = tzOffsetMinutes('Africa/Cairo', guess)
  return new Date(guess.getTime() - offset * 60000)
}

export default function CalendarClient({ sessionTypes, teachers, supervisors, students }: Props) {
  const calRef = useRef<any>(null)
  const [filterTeacher, setFilterTeacher]       = useState('')
  const [filterSupervisor, setFilterSupervisor] = useState('')
  const [form, setForm]     = useState({ ...EMPTY_FORM })
  const [modal, setModal]   = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [busy, setBusy]     = useState(false)
  const [copied, setCopied] = useState(false)
  const [studentQuery, setStudentQuery] = useState('')
  const [showStudentList, setShowStudentList] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [resched, setResched] = useState<null | { date: string; time: string; duration: number }>(null)
  const filterTeacherRef    = useRef('')
  const filterSupervisorRef = useRef('')
  const supabase = createClient()

  const loadEvents = useCallback(async (fetchInfo: any, successCb: any, failureCb: any) => {
    try {
      const params: Record<string, string> = { start: fetchInfo.startStr, end: fetchInfo.endStr }
      if (filterTeacherRef.current)    params.teacher_id    = filterTeacherRef.current
      if (filterSupervisorRef.current) params.supervisor_id = filterSupervisorRef.current
      const qs = new URLSearchParams(params).toString()
      const res = await fetch(`/api/calendar/sessions?${qs}`)
      const data = await res.json()
      if (!res.ok) {
        setLoadError(data?.error ?? `Failed to load sessions (HTTP ${res.status})`)
        successCb([]); return
      }
      setLoadError('')
      const arr = Array.isArray(data) ? data : []
      const showTeacher = !filterTeacherRef.current  // include teacher name unless viewing one teacher
      successCb(arr.map((s: any) => ({
        id:    s.id,
        title: showTeacher
          ? `${s.teacher?.profile?.name ?? '—'} · ${s.student_name ?? 'Session'}`
          : `${s.student_name ?? 'Session'} · ${s.session_type?.name ?? ''}`,
        start: s.start_at,
        end:   s.end_at,
        backgroundColor: s.status === 'cancelled' ? '#E2E8F0' : (s.session_type?.color ?? '#64748B'),
        borderColor:     s.status === 'cancelled' ? '#CBD5E1' : (s.session_type?.color ?? '#64748B'),
        textColor:       s.status === 'cancelled' ? '#94A3B8' : '#fff',
        extendedProps:   s,
      })))
    } catch (e: any) {
      setLoadError(e?.message ?? 'Network error loading sessions')
      failureCb(e)
    }
  }, [])

  function refresh() { calRef.current?.getApi()?.refetchEvents() }

  function onTeacherFilter(id: string) {
    setFilterTeacher(id); setFilterSupervisor('')
    filterTeacherRef.current = id; filterSupervisorRef.current = ''
    refresh()
  }
  function onSupervisorFilter(id: string) {
    setFilterSupervisor(id); setFilterTeacher('')
    filterSupervisorRef.current = id; filterTeacherRef.current = ''
    refresh()
  }
  function clearFilters() {
    setFilterTeacher(''); setFilterSupervisor('')
    filterTeacherRef.current = ''; filterSupervisorRef.current = ''
    refresh()
  }

  function openNew(dateStr?: string, timeStr?: string) {
    setForm({ ...EMPTY_FORM, date: dateStr ?? '', start_time: timeStr ?? '' })
    setStudentQuery(''); setConflict(false); setError(''); setModal(true)
  }

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase()
    if (!q) return students.slice(0, 8)
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q)
    ).slice(0, 8)
  }, [studentQuery, students])

  function pickStudent(s: Student) {
    setForm(f => ({ ...f, student_id: s.id, student_name: s.name, student_email: s.email, student_phone: s.phone }))
    setStudentQuery(s.name)
    setShowStudentList(false)
  }

  async function handleSubmit(force = false) {
    setSaving(true); setError('')
    const start = cairoToUtc(form.date, form.start_time)
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
      open_access:      form.open_access,
      auto_record:      form.auto_record,
      cohost_emails:    (() => {
        const t = teachers.find(x => x.id === form.teacher_id)
        const list: string[] = []
        if (form.teacher_cohost && t?.email) list.push(t.email)
        if (form.student_cohost && form.student_email) list.push(form.student_email)
        if (form.cohost_email.trim()) list.push(form.cohost_email.trim())
        return Array.from(new Set(list))
      })(),
    }

    const res = await fetch('/api/calendar/sessions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (res.status === 409) { setConflict(true); setSaving(false); return }
    if (!res.ok) { setError(data?.error ?? 'Failed to save'); setSaving(false); return }

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

    // Jump the calendar to the new session's date and refresh so it's always visible
    const api = calRef.current?.getApi()
    if (api) { api.gotoDate(start); api.refetchEvents() }
    setModal(false); setSaving(false)

    // Surface co-host result so we know if Google accepted it
    const ch = data?._meet?.cohosts
    if (ch && (ch.error || (ch.added && ch.added.length < (payload.cohost_emails?.length ?? 0)))) {
      alert(`Co-host result:\n• Added: ${(ch.added ?? []).join(', ') || 'none'}\n• Error: ${ch.error ?? 'none'}`)
    }
  }

  function startReschedule() {
    if (!selected) return
    // pre-fill with the session's current Cairo date/time
    const d = new Date(selected.start_at)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)
    const m: Record<string, string> = {}
    for (const p of parts) m[p.type] = p.value
    setResched({
      date: `${m.year}-${m.month}-${m.day}`,
      time: `${m.hour === '24' ? '00' : m.hour}:${m.minute}`,
      duration: selected.duration_minutes,
    })
  }

  async function saveReschedule() {
    if (!selected || !resched) return
    setBusy(true)
    const start = cairoToUtc(resched.date, resched.time)
    const end   = new Date(start.getTime() + resched.duration * 60000)
    const res = await fetch(`/api/calendar/sessions/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_at: start.toISOString(),
        end_at:   end.toISOString(),
        duration_minutes: resched.duration,
      }),
    })
    setBusy(false)
    if (res.ok) {
      setResched(null); setSelected(null)
      const api = calRef.current?.getApi()
      if (api) { api.gotoDate(start); api.refetchEvents() }
    } else {
      const d = await res.json()
      alert(`Failed to reschedule: ${d?.error ?? 'unknown error'}`)
    }
  }

  async function cancelSession() {
    if (!selected) return
    if (!confirm('Cancel this session? The student and teacher will be notified and the Meet event removed.')) return
    setBusy(true)
    const res = await fetch(`/api/calendar/sessions/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    setBusy(false)
    if (res.ok) { setSelected(null); refresh() }
    else alert('Failed to cancel session')
  }

  async function deleteSession() {
    if (!selected) return
    if (!confirm('Permanently delete this session? This cannot be undone.')) return
    setBusy(true)
    const res = await fetch(`/api/calendar/sessions/${selected.id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) { setSelected(null); refresh() }
    else alert('Failed to delete session')
  }

  function copyMeet() {
    if (!selected?.google_meet_link) return
    navigator.clipboard.writeText(selected.google_meet_link)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  async function remindNow() {
    if (!selected) return
    setBusy(true)
    const res = await fetch(`/api/calendar/sessions/${selected.id}/remind`, { method: 'POST' })
    const data = await res.json()
    setBusy(false)
    if (res.ok) alert('✅ WhatsApp reminder sent!')
    else alert(`❌ ${data.error ?? 'Failed to send'}`)
  }

  function toggleDay(d: number) {
    setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }))
  }

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  return (
    <>
      {/* Modern FullCalendar theming */}
      <style>{`
        .fc { --fc-border-color: #EEF2F6; --fc-today-bg-color: #FFFBEB;
              --fc-now-indicator-color: #EF4444; font-size: 13px; }
        .fc .fc-toolbar-title { font-size: 19px; font-weight: 800; color: #0F172A; letter-spacing: -0.01em; }
        .fc .fc-button { background: #fff; border: 1px solid #E2E8F0; color: #475569;
              font-weight: 600; font-size: 12px; text-transform: capitalize; padding: 6px 12px;
              border-radius: 9px; box-shadow: none; transition: all 0.12s; }
        .fc .fc-button:hover { background: #F8FAFC; border-color: #CBD5E1; color: #0F172A; }
        .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc .fc-button-primary:not(:disabled):active { background: #0D1B2A; border-color: #0D1B2A; color: #E8C97A; }
        .fc .fc-button-primary:focus { box-shadow: 0 0 0 3px rgba(13,27,42,0.12); }
        .fc .fc-button .fc-icon { font-size: 1.1em; }
        .fc-theme-standard td, .fc-theme-standard th { border-color: #EEF2F6; }
        .fc .fc-col-header-cell-cushion { font-size: 11px; font-weight: 700; color: #94A3B8;
              text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 4px; text-decoration: none; }
        .fc .fc-timegrid-axis-cushion, .fc .fc-timegrid-slot-label-cushion { color: #94A3B8; font-size: 11px; font-weight: 500; }
        .fc .fc-timegrid-slot { height: 44px; }
        .fc-day-today .fc-col-header-cell-cushion { color: #0D1B2A; }
        .fc .fc-event { border-radius: 7px; border: none; border-left: 3px solid; padding: 1px 2px;
              font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.06); transition: filter 0.1s; }
        .fc .fc-event:hover { filter: brightness(0.95); }
        .fc .fc-event-main { padding: 2px 5px; }
        .fc .fc-timegrid-now-indicator-line { border-width: 2px; }
        .fc-highlight { background: rgba(13,27,42,0.06); border-radius: 6px; }
        .fc .fc-list-event:hover td { background: #F8FAFC; }
        .fc .fc-list-event-dot { border-radius: 3px; }
      `}</style>

      {loadError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', color: '#B91C1C', fontSize: '13px', fontWeight: '600' }}>
          ⚠️ Could not load sessions: {loadError}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', background: '#fff', border: '1px solid #F1F5F9', borderRadius: '12px', padding: '12px 16px' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filter</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>👩‍🏫 Teacher</span>
          <select value={filterTeacher} onChange={e => onTeacherFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', background: filterTeacher ? '#0D1B2A' : '#fff', color: filterTeacher ? '#E8C97A' : '#334155', fontWeight: filterTeacher ? 700 : 400 }}>
            <option value="">All teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>🔍 Supervisor</span>
          <select value={filterSupervisor} onChange={e => onSupervisorFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', background: filterSupervisor ? '#0D1B2A' : '#fff', color: filterSupervisor ? '#E8C97A' : '#334155', fontWeight: filterSupervisor ? 700 : 400 }}>
            <option value="">All supervisors</option>
            {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}'s teachers</option>)}
          </select>
        </div>
        {(filterTeacher || filterSupervisor) && (
          <button onClick={clearFilters}
            style={{ padding: '6px 12px', background: '#F1F5F9', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', color: '#475569' }}>
            ✕ Clear
          </button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: '18px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)', border: '1px solid #F1F5F9' }}>
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin, luxon3Plugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,dayGridMonth,listWeek' }}
          buttonText={{ today: 'Today', week: 'Week', day: 'Day', month: 'Month', list: 'Agenda' }}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime="08:00:00"
          allDaySlot={false}
          nowIndicator
          selectable
          selectMirror
          dayMaxEvents
          editable={false}
          events={loadEvents}
          select={info => openNew(info.startStr.slice(0, 10), info.startStr.slice(11, 16))}
          eventClick={info => { setCopied(false); setSelected(info.event.extendedProps) }}
          height="calc(100vh - 230px)"
          timeZone="Africa/Cairo"
          expandRows
        />
      </div>

      {/* Event detail popup */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(2px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => { setSelected(null); setResched(null) }}>
          <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 50px rgba(15,23,42,0.25)', borderTop: `5px solid ${selected.session_type?.color ?? '#64748B'}`, overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>{selected.student_name}</div>
                <div style={{ fontSize: '13px', color: selected.session_type?.color, fontWeight: '700', marginTop: '2px' }}>{selected.session_type?.name}</div>
              </div>
              <button onClick={() => { setSelected(null); setResched(null) }} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '28px', height: '28px', fontSize: '15px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div style={{ fontSize: '13px', color: '#475569' }}>📅 {new Date(selected.start_at).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              <div style={{ fontSize: '13px', color: '#475569' }}>👩‍🏫 {selected.teacher?.profile?.name ?? '—'}</div>
              <div style={{ fontSize: '13px', color: '#475569' }}>⏱ {selected.duration_minutes} minutes</div>
              {selected.student_phone && <div style={{ fontSize: '13px', color: '#475569' }}>📱 {selected.student_phone}</div>}
              {selected.recurring_rule_id && <div style={{ fontSize: '12px', color: '#8B5CF6', fontWeight: '700' }}>🔄 Recurring session</div>}
              {selected.force_booked && <div style={{ fontSize: '12px', color: '#DC2626', fontWeight: '700' }}>⚠️ Force booked</div>}
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: selected.status === 'scheduled' ? '#DCFCE7' : selected.status === 'cancelled' ? '#FEE2E2' : '#F1F5F9', color: selected.status === 'scheduled' ? '#15803D' : selected.status === 'cancelled' ? '#B91C1C' : '#475569', fontWeight: '700', width: 'fit-content', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {selected.status}
              </span>

              {/* Google Meet */}
              {selected.google_meet_link ? (
                <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                  <a href={selected.google_meet_link} target="_blank" rel="noreferrer"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px', background: '#0D1B2A', color: '#E8C97A', borderRadius: '10px', textDecoration: 'none', fontSize: '13px', fontWeight: '700' }}>
                    🎥 Join Meet
                  </a>
                  <button onClick={copyMeet} style={{ padding: '10px 12px', background: '#F1F5F9', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: '#475569' }}>
                    {copied ? '✓' : '📋'}
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#94A3B8', background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px' }}>
                  No Meet link — connect Google Calendar to auto-generate links.
                </div>
              )}
            </div>

            {/* Reschedule form */}
            {selected.status !== 'cancelled' && resched && (
              <div style={{ padding: '0 22px 16px' }}>
                <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '10px' }}>🕑 Move session to a new time</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <input type="date" value={resched.date} onChange={e => setResched(r => r && { ...r, date: e.target.value })}
                      style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none' }} />
                    <input type="time" value={resched.time} onChange={e => setResched(r => r && { ...r, time: e.target.value })}
                      style={{ padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none' }} />
                  </div>
                  <select value={resched.duration} onChange={e => setResched(r => r && { ...r, duration: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', marginBottom: '10px' }}>
                    {[30, 40, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setResched(null)} disabled={busy}
                      style={{ flex: 1, padding: '9px', background: '#fff', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      Back
                    </button>
                    <button onClick={saveReschedule} disabled={busy}
                      style={{ flex: 1, padding: '9px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      {busy ? 'Saving…' : 'Save New Time'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            {selected.status !== 'cancelled' && !resched && (
              <div style={{ padding: '0 22px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={remindNow} disabled={busy}
                  style={{ width: '100%', padding: '9px', background: '#DCFCE7', color: '#15803D', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  📲 Send WhatsApp reminder now
                </button>
                <button onClick={startReschedule} disabled={busy}
                  style={{ width: '100%', padding: '9px', background: '#E0E7FF', color: '#3730A3', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  🕑 Reschedule
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={cancelSession} disabled={busy}
                    style={{ flex: 1, padding: '9px', background: '#FEF3C7', color: '#92400E', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    Cancel Session
                  </button>
                  <button onClick={deleteSession} disabled={busy}
                    style={{ flex: 1, padding: '9px', background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
            )}
            {selected.status === 'cancelled' && (
              <div style={{ padding: '0 22px 20px' }}>
                <button onClick={deleteSession} disabled={busy}
                  style={{ width: '100%', padding: '9px', background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                  Delete Permanently
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setModal(false)}>
          <div style={{ background: '#fff', borderRadius: '18px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(15,23,42,0.3)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ padding: '22px 26px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>Book New Session</div>
              <button onClick={() => setModal(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>

            <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Session type pills */}
              <div>
                <span style={label}>Session Type</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {sessionTypes.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, session_type_id: t.id }))}
                      style={{ padding: '6px 13px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', border: `2px solid ${form.session_type_id === t.id ? t.color : '#E2E8F0'}`, background: form.session_type_id === t.id ? t.color + '1A' : '#F8FAFC', color: t.color, transition: 'all 0.1s' }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Searchable student picker */}
              <div style={{ position: 'relative' }}>
                <label style={label}>Student — type to search</label>
                <input
                  style={inp}
                  value={studentQuery}
                  onChange={e => { setStudentQuery(e.target.value); setShowStudentList(true); setForm(f => ({ ...f, student_id: '' })) }}
                  onFocus={() => setShowStudentList(true)}
                  placeholder="Start typing a name, email or phone…"
                />
                {form.student_id && !showStudentList && (
                  <span style={{ position: 'absolute', right: '12px', top: '32px', color: '#16A34A', fontSize: '13px' }}>✓</span>
                )}
                {showStudentList && filteredStudents.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 10, marginTop: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                    {filteredStudents.map(s => (
                      <div key={s.id} onClick={() => pickStudent(s)}
                        style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #F8FAFC' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{s.email || s.phone || '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Teacher + duration */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Teacher</label>
                  <select style={inp} value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}>
                    <option value="">Select teacher…</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Duration</label>
                  <select style={inp} value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}>
                    {[30, 40, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              {/* Date + time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Date</label>
                  <input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Start Time</label>
                  <input type="time" style={inp} value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={label}>Notes</label>
                <textarea style={{ ...inp, minHeight: '54px', resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" />
              </div>

              {/* Recurring */}
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: form.recurring ? '12px' : '0' }}>
                  <button onClick={() => setForm(f => ({ ...f, recurring: !f.recurring, days: [] }))}
                    style={{ width: '42px', height: '24px', borderRadius: '12px', background: form.recurring ? '#0D1B2A' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', top: '3px', left: form.recurring ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>🔄 Recurring Schedule</span>
                </div>
                {form.recurring && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px' }}>Repeats weekly on these days, indefinitely until cancelled</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {DAY_LABELS.map((d, i) => (
                        <button key={i} onClick={() => toggleDay(i)}
                          style={{ padding: '6px 11px', borderRadius: '9px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', border: '1.5px solid', borderColor: form.days.includes(i) ? '#0D1B2A' : '#E2E8F0', background: form.days.includes(i) ? '#0D1B2A' : '#fff', color: form.days.includes(i) ? '#E8C97A' : '#64748B' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Google Meet options */}
              <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>🎥 Google Meet options</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, open_access: !f.open_access }))}
                    style={{ width: '42px', height: '24px', borderRadius: '12px', background: form.open_access ? '#0D1B2A' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', top: '3px', left: form.open_access ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Open access</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Anyone with the link joins directly — no knocking</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, auto_record: !f.auto_record }))}
                    style={{ width: '42px', height: '24px', borderRadius: '12px', background: form.auto_record ? '#0D1B2A' : '#CBD5E1', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', top: '3px', left: form.auto_record ? '21px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Auto-record</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>Recording saves to the organizer's Google Drive</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 700, marginBottom: '6px' }}>Co-hosts</div>
                  {(() => {
                    const t = teachers.find(x => x.id === form.teacher_id)
                    const teacherEmail = t?.email
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: teacherEmail ? '#334155' : '#94A3B8' }}>
                          <input type="checkbox" disabled={!teacherEmail} checked={form.teacher_cohost && !!teacherEmail}
                            onChange={e => setForm(f => ({ ...f, teacher_cohost: e.target.checked }))} />
                          Teacher{teacherEmail ? ` — ${teacherEmail}` : ' (select a teacher first)'}
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: form.student_email ? '#334155' : '#94A3B8' }}>
                          <input type="checkbox" disabled={!form.student_email} checked={form.student_cohost && !!form.student_email}
                            onChange={e => setForm(f => ({ ...f, student_cohost: e.target.checked }))} />
                          Student{form.student_email ? ` — ${form.student_email}` : ' (no email on file)'}
                        </label>
                        <input style={{ ...inp, marginTop: '2px' }} type="email" placeholder="Other co-host email (optional)" value={form.cohost_email} onChange={e => setForm(f => ({ ...f, cohost_email: e.target.value }))} />
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Conflict */}
              {conflict && (
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: '#92400E', fontWeight: '700' }}>⚠️ Scheduling Conflict</div>
                  <div style={{ fontSize: '12px', color: '#92400E' }}>This teacher already has a session then. Enter a reason to force-book:</div>
                  <input style={inp} placeholder="Reason for force booking…" value={form.force_reason} onChange={e => setForm(f => ({ ...f, force_reason: e.target.value }))} />
                </div>
              )}

              {error && <div style={{ color: '#DC2626', fontSize: '13px', background: '#FEF2F2', padding: '11px', borderRadius: '10px' }}>{error}</div>}
            </div>

            <div style={{ padding: '16px 26px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '8px', justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#fff' }}>
              <button onClick={() => setModal(false)} style={{ padding: '10px 20px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}>Cancel</button>
              {conflict
                ? <button onClick={() => handleSubmit(true)} disabled={!form.force_reason || saving}
                    style={{ padding: '10px 22px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                    {saving ? 'Saving…' : 'Force Book'}
                  </button>
                : <button onClick={() => handleSubmit(false)} disabled={!form.teacher_id || !form.date || !form.start_time || saving}
                    style={{ padding: '10px 22px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: (!form.teacher_id || !form.date || !form.start_time || saving) ? 'not-allowed' : 'pointer', opacity: (!form.teacher_id || !form.date || !form.start_time || saving) ? 0.55 : 1 }}>
                    {saving ? 'Saving…' : 'Book Session'}
                  </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => openNew()}
        style={{ position: 'fixed', bottom: '28px', right: '28px', width: '54px', height: '54px', borderRadius: '50%', background: '#0D1B2A', color: '#E8C97A', border: 'none', fontSize: '26px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(13,27,42,0.35)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        +
      </button>
    </>
  )
}
