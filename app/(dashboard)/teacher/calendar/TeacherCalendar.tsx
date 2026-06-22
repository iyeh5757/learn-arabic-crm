'use client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import luxon3Plugin from '@fullcalendar/luxon3'
import { useCallback, useRef, useState } from 'react'

export default function TeacherCalendar() {
  const calRef = useRef<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const loadEvents = useCallback(async (info: any, success: any, failure: any) => {
    try {
      const qs = new URLSearchParams({ start: info.startStr, end: info.endStr }).toString()
      const [sRes, bRes] = await Promise.all([
        fetch(`/api/calendar/sessions?${qs}`),
        fetch(`/api/calendar/blocks?${qs}`),
      ])
      const sessions = await sRes.json()
      const blocks   = await bRes.json()
      const sEvents = (Array.isArray(sessions) ? sessions : []).map((s: any) => ({
        id: `s-${s.id}`,
        title: `${s.student_name ?? 'Session'} · ${s.session_type?.name ?? ''}`,
        start: s.start_at, end: s.end_at,
        backgroundColor: s.status === 'cancelled' ? '#E2E8F0' : (s.session_type?.color ?? '#64748B'),
        borderColor:     s.status === 'cancelled' ? '#CBD5E1' : (s.session_type?.color ?? '#64748B'),
        textColor: s.status === 'cancelled' ? '#94A3B8' : '#fff',
        extendedProps: { kind: 'session', data: s },
      }))
      const bEvents = (Array.isArray(blocks) ? blocks : []).map((b: any) => ({
        id: `b-${b.id}`,
        title: `🚫 Blocked${b.reason ? ` · ${b.reason}` : ''}`,
        start: b.start_at, end: b.end_at,
        backgroundColor: '#9CA3AF', borderColor: '#6B7280', textColor: '#fff',
        extendedProps: { kind: 'block', data: b },
      }))
      success([...sEvents, ...bEvents])
    } catch (e) { failure(e) }
  }, [])

  function refresh() { calRef.current?.getApi()?.refetchEvents() }

  async function blockRange(info: any) {
    const label = new Date(info.start).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', weekday: 'short', hour: '2-digit', minute: '2-digit' })
    if (!confirm(`Block this time as unavailable?\n${label}`)) { calRef.current?.getApi()?.unselect(); return }
    setBusy(true)
    const res = await fetch('/api/calendar/blocks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_at: new Date(info.start).toISOString(), end_at: new Date(info.end).toISOString() }),
    })
    setBusy(false)
    if (res.ok) refresh()
    else { const d = await res.json(); alert(`Couldn't block: ${d?.error ?? 'error'}`) }
  }

  async function removeBlock(id: string) {
    if (!confirm('Remove this blocked time? You will be available again.')) return
    setBusy(true)
    const res = await fetch(`/api/calendar/blocks/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) { setSelected(null); refresh() }
    else alert('Failed to remove block')
  }

  return (
    <>
      <style>{`
        .fc { --fc-border-color:#EEF2F6; --fc-today-bg-color:#FFFBEB; font-size:13px; }
        .fc .fc-toolbar-title { font-size:18px; font-weight:800; color:#0F172A; }
        .fc .fc-button { background:#fff; border:1px solid #E2E8F0; color:#475569; font-weight:600; font-size:12px; text-transform:capitalize; border-radius:9px; }
        .fc .fc-button-primary:not(:disabled).fc-button-active { background:#0D1B2A; border-color:#0D1B2A; color:#E8C97A; }
        .fc .fc-event { border-radius:7px; border:none; border-left:3px solid; font-weight:600; cursor:pointer; }
        .fc .fc-event-main { padding:2px 5px; }
      `}</style>

      <div style={{ background:'#fff', borderRadius:'18px', padding:'18px 20px', border:'1px solid #F1F5F9', boxShadow:'0 1px 3px rgba(15,23,42,0.06)' }}>
        <FullCalendar
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin, luxon3Plugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left:'prev,next today', center:'title', right:'timeGridWeek,timeGridDay,dayGridMonth,listWeek' }}
          buttonText={{ today:'Today', week:'Week', day:'Day', month:'Month', list:'Agenda' }}
          slotMinTime="00:00:00" slotMaxTime="24:00:00" scrollTime="08:00:00"
          allDaySlot={false} nowIndicator selectable selectMirror
          timeZone="Africa/Cairo" height="calc(100vh - 230px)" expandRows
          events={loadEvents}
          select={blockRange}
          eventClick={info => setSelected(info.event.extendedProps)}
        />
      </div>

      <div style={{ marginTop:'10px', fontSize:'12px', color:'#94A3B8' }}>
        💡 Tip: drag across any empty time to mark yourself <strong>unavailable</strong>. Click a grey block to remove it.
      </div>

      {/* Detail popup */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.4)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
          onClick={() => setSelected(null)}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'340px', padding:'20px', boxShadow:'0 12px 40px rgba(15,23,42,0.2)' }}
            onClick={e => e.stopPropagation()}>
            {selected.kind === 'block' ? (
              <>
                <div style={{ fontSize:'15px', fontWeight:'800', color:'#0F172A', marginBottom:'8px' }}>🚫 Blocked time</div>
                <div style={{ fontSize:'13px', color:'#475569', marginBottom:'14px' }}>
                  {new Date(selected.data.start_at).toLocaleString('en-GB', { timeZone:'Africa/Cairo', weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                </div>
                <button onClick={() => removeBlock(selected.data.id)} disabled={busy}
                  style={{ width:'100%', padding:'9px', background:'#FEE2E2', color:'#B91C1C', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                  Remove block (become available)
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize:'16px', fontWeight:'800', color:'#0F172A' }}>{selected.data.student_name}</div>
                <div style={{ fontSize:'13px', color:selected.data.session_type?.color, fontWeight:'700', marginTop:'2px' }}>{selected.data.session_type?.name}</div>
                <div style={{ fontSize:'13px', color:'#475569', marginTop:'10px' }}>📅 {new Date(selected.data.start_at).toLocaleString('en-GB', { timeZone:'Africa/Cairo', weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
                <div style={{ fontSize:'13px', color:'#475569', marginTop:'6px' }}>⏱ {selected.data.duration_minutes} minutes</div>
                {selected.data.google_meet_link && (
                  <a href={selected.data.google_meet_link} target="_blank" rel="noreferrer"
                    style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', padding:'10px', background:'#0D1B2A', color:'#E8C97A', borderRadius:'10px', textDecoration:'none', fontSize:'13px', fontWeight:'700', marginTop:'14px' }}>
                    🎥 Join Meet
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
