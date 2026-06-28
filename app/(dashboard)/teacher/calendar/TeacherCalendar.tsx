'use client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import luxon3Plugin from '@fullcalendar/luxon3'
import { useCallback, useRef, useState } from 'react'

function tzOffsetMinutes(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const m: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second)
  return (asUTC - date.getTime()) / 60000
}
// Cairo wall-clock (date + HH:mm) → correct UTC Date
function cairoToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm))
  return new Date(guess.getTime() - tzOffsetMinutes('Africa/Cairo', guess) * 60000)
}

const inp: React.CSSProperties = { padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', width: '100%', outline: 'none', background: '#fff' }
const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px', display: 'block' }
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const EMPTY_BLOCK = { date: '', start_time: '', end_time: '', reason: '', recurring: false, days: [] as number[], weeks: 8, never_end: false }

export default function TeacherCalendar() {
  const calRef = useRef<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [blockForm, setBlockForm] = useState<typeof EMPTY_BLOCK | null>(null)
  const [retime, setRetime] = useState<null | { group: string; start_time: string; end_time: string }>(null)

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

  function cairoParts(d: Date) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
    const m: Record<string, string> = {}
    for (const x of p) m[x.type] = x.value
    return { date: `${m.year}-${m.month}-${m.day}`, time: `${m.hour === '24' ? '00' : m.hour}:${m.minute}` }
  }

  // Drag-select opens the block modal pre-filled with the chosen range
  function onSelect(info: any) {
    const s = cairoParts(new Date(info.start))
    const e = cairoParts(new Date(info.end))
    setBlockForm({ ...EMPTY_BLOCK, date: s.date, start_time: s.time, end_time: e.time })
    calRef.current?.getApi()?.unselect()
  }

  function openBlock() {
    const today = cairoParts(new Date())
    setBlockForm({ ...EMPTY_BLOCK, date: today.date, start_time: '09:00', end_time: '10:00' })
  }

  function toggleDay(d: number) {
    setBlockForm(f => f && ({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] }))
  }

  async function saveBlock() {
    if (!blockForm) return
    const { date, start_time, end_time, recurring, days, weeks, never_end, reason } = blockForm
    if (!date || !start_time || !end_time) { alert('Pick a date, start time and end time.'); return }
    if (cairoToUtc(date, end_time) <= cairoToUtc(date, start_time)) { alert('End time must be after start time.'); return }

    const blocks: Array<{ start_at: string; end_at: string }> = []
    if (!recurring) {
      blocks.push({ start_at: cairoToUtc(date, start_time).toISOString(), end_at: cairoToUtc(date, end_time).toISOString() })
    } else {
      if (days.length === 0) { alert('Pick at least one weekday to repeat on.'); return }
      const horizonWeeks = never_end ? 104 : weeks   // "never" = 2 years of blocks (cheap CRM rows)
      const MAX = 500
      const [by, bm, bd] = date.split('-').map(Number)
      for (let n = 0; n < horizonWeeks * 7 && blocks.length < MAX; n++) {
        const day = new Date(by, bm - 1, bd + n)
        if (!days.includes(day.getDay())) continue
        const ds = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
        const start = cairoToUtc(ds, start_time)
        if (start.getTime() < Date.now()) continue
        blocks.push({ start_at: start.toISOString(), end_at: cairoToUtc(ds, end_time).toISOString() })
      }
    }
    if (blocks.length === 0) { alert('No upcoming times to block (all selected dates are in the past).'); return }

    setBusy(true)
    const res = await fetch('/api/calendar/blocks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks, reason: reason || null }),
    })
    setBusy(false)
    if (res.ok) { setBlockForm(null); refresh() }
    else { const d = await res.json(); alert(`Couldn't block: ${d?.error ?? 'error'}`) }
  }

  async function removeBlock(id: string, scope: 'one' | 'future' | 'all' = 'one') {
    setBusy(true)
    const res = await fetch(`/api/calendar/blocks/${id}?scope=${scope}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) { setSelected(null); refresh() }
    else alert('Failed to remove block')
  }

  function startRetime() {
    if (!selected) return
    setRetime({
      group: selected.data.recurrence_group_id,
      start_time: cairoParts(new Date(selected.data.start_at)).time,
      end_time: cairoParts(new Date(selected.data.end_at)).time,
    })
  }
  async function saveRetime() {
    if (!retime) return
    if (cairoToUtc('2000-01-01', retime.end_time) <= cairoToUtc('2000-01-01', retime.start_time)) { alert('End time must be after start time.'); return }
    setBusy(true)
    const res = await fetch('/api/calendar/blocks/series', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: retime.group, start_time: retime.start_time, end_time: retime.end_time }),
    })
    setBusy(false)
    if (res.ok) { setRetime(null); setSelected(null); refresh() }
    else { const d = await res.json(); alert(`Couldn't update series: ${d?.error ?? 'error'}`) }
  }

  return (
    <>
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
          select={onSelect}
          eventClick={info => setSelected(info.event.extendedProps)}
        />
      </div>

      <div style={{ marginTop:'10px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'12px', color:'#94A3B8' }}>
          💡 Drag across empty time to block it, or use the button. Click a grey block to remove it.
        </span>
        <button onClick={openBlock}
          style={{ padding:'9px 16px', background:'#0D1B2A', color:'#E8C97A', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
          🚫 Block time
        </button>
      </div>

      {/* Block modal */}
      {blockForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.45)', backdropFilter:'blur(2px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
          onClick={() => setBlockForm(null)}>
          <div style={{ background:'#fff', borderRadius:'18px', width:'100%', maxWidth:'460px', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(15,23,42,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid #F1F5F9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'16px', fontWeight:'800', color:'#0F172A' }}>🚫 Block unavailable time</div>
              <button onClick={() => setBlockForm(null)} style={{ background:'#F1F5F9', border:'none', borderRadius:'8px', width:'30px', height:'30px', fontSize:'16px', cursor:'pointer', color:'#64748B' }}>✕</button>
            </div>
            <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={lbl}>Date</label>
                <input type="date" style={inp} value={blockForm.date} onChange={e => setBlockForm(f => f && ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={lbl}>From</label>
                  <input type="time" style={inp} value={blockForm.start_time} onChange={e => setBlockForm(f => f && ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>To</label>
                  <input type="time" style={inp} value={blockForm.end_time} onChange={e => setBlockForm(f => f && ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Reason (optional)</label>
                <input style={inp} placeholder="e.g. Personal, holiday…" value={blockForm.reason} onChange={e => setBlockForm(f => f && ({ ...f, reason: e.target.value }))} />
              </div>

              <div style={{ background:'#F8FAFC', borderRadius:'12px', padding:'14px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom: blockForm.recurring ? '12px' : '0' }}>
                  <button type="button" onClick={() => setBlockForm(f => f && ({ ...f, recurring: !f.recurring, days: [] }))}
                    style={{ width:'42px', height:'24px', borderRadius:'12px', background: blockForm.recurring ? '#0D1B2A' : '#CBD5E1', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                    <span style={{ position:'absolute', width:'18px', height:'18px', borderRadius:'50%', background:'#fff', top:'3px', left: blockForm.recurring ? '21px' : '3px', transition:'left 0.2s' }} />
                  </button>
                  <span style={{ fontSize:'13px', fontWeight:'700', color:'#334155' }}>🔁 Repeat weekly</span>
                </div>
                {blockForm.recurring && (
                  <div>
                    <div style={{ fontSize:'11px', color:'#94A3B8', marginBottom:'8px' }}>Block these days each week at the same time</div>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px' }}>
                      {DAY_LABELS.map((d, i) => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          style={{ padding:'6px 11px', borderRadius:'9px', fontSize:'12px', fontWeight:'700', cursor:'pointer', border:'1.5px solid', borderColor: blockForm.days.includes(i) ? '#0D1B2A' : '#E2E8F0', background: blockForm.days.includes(i) ? '#0D1B2A' : '#fff', color: blockForm.days.includes(i) ? '#E8C97A' : '#64748B' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                      <button type="button" onClick={() => setBlockForm(f => f && ({ ...f, never_end: !f.never_end }))}
                        style={{ width:'42px', height:'24px', borderRadius:'12px', background: blockForm.never_end ? '#0D1B2A' : '#CBD5E1', border:'none', cursor:'pointer', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
                        <span style={{ position:'absolute', width:'18px', height:'18px', borderRadius:'50%', background:'#fff', top:'3px', left: blockForm.never_end ? '21px' : '3px', transition:'left 0.2s' }} />
                      </button>
                      <span style={{ fontSize:'13px', fontWeight:'600', color:'#334155' }}>♾️ Never ends</span>
                    </div>
                    {!blockForm.never_end && (
                      <label style={{ fontSize:'12px', color:'#475569', display:'flex', alignItems:'center', gap:'8px' }}>
                        Repeat for
                        <input type="number" min={1} max={52} value={blockForm.weeks} onChange={e => setBlockForm(f => f && ({ ...f, weeks: Math.max(1, Math.min(52, Number(e.target.value) || 1)) }))}
                          style={{ width:'64px', padding:'6px 8px', border:'1px solid #E2E8F0', borderRadius:'8px', fontSize:'13px' }} />
                        weeks
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding:'16px 24px', borderTop:'1px solid #F1F5F9', display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button onClick={() => setBlockForm(null)} style={{ padding:'10px 20px', background:'#fff', border:'1px solid #E2E8F0', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer', color:'#475569' }}>Cancel</button>
              <button onClick={saveBlock} disabled={busy}
                style={{ padding:'10px 22px', background:'#0D1B2A', color:'#E8C97A', border:'none', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
                {busy ? 'Saving…' : 'Block time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail popup */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.4)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
          onClick={() => { setSelected(null); setRetime(null) }}>
          <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'340px', padding:'20px', boxShadow:'0 12px 40px rgba(15,23,42,0.2)' }}
            onClick={e => e.stopPropagation()}>
            {selected.kind === 'block' ? (
              <>
                <div style={{ fontSize:'15px', fontWeight:'800', color:'#0F172A', marginBottom:'8px' }}>🚫 Blocked time</div>
                <div style={{ fontSize:'13px', color:'#475569', marginBottom:'14px' }}>
                  {new Date(selected.data.start_at).toLocaleString('en-GB', { timeZone:'Africa/Cairo', weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                  {selected.data.recurrence_group_id && <span style={{ display:'block', fontSize:'12px', color:'#8B5CF6', fontWeight:'700', marginTop:'4px' }}>🔁 Part of a repeating block</span>}
                </div>
                {selected.data.recurrence_group_id ? (
                  retime ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', color:'#64748B', textTransform:'uppercase' }}>New time for the whole series</div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <input type="time" value={retime.start_time} onChange={e => setRetime(r => r && ({ ...r, start_time: e.target.value }))}
                          style={{ flex:1, padding:'9px 10px', border:'1px solid #E2E8F0', borderRadius:'10px', fontSize:'13px' }} />
                        <input type="time" value={retime.end_time} onChange={e => setRetime(r => r && ({ ...r, end_time: e.target.value }))}
                          style={{ flex:1, padding:'9px 10px', border:'1px solid #E2E8F0', borderRadius:'10px', fontSize:'13px' }} />
                      </div>
                      <div style={{ fontSize:'11px', color:'#94A3B8' }}>Applies to all upcoming blocks in this series.</div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button onClick={() => setRetime(null)} disabled={busy} style={{ flex:1, padding:'9px', background:'#fff', color:'#475569', border:'1px solid #E2E8F0', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>Back</button>
                        <button onClick={saveRetime} disabled={busy} style={{ flex:1, padding:'9px', background:'#0D1B2A', color:'#E8C97A', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>{busy ? 'Saving…' : 'Save new time'}</button>
                      </div>
                    </div>
                  ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    <button onClick={startRetime} disabled={busy}
                      style={{ width:'100%', padding:'9px', background:'#E0E7FF', color:'#3730A3', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                      🕑 Edit series time
                    </button>
                    <div style={{ fontSize:'11px', fontWeight:'700', color:'#64748B', textTransform:'uppercase' }}>Remove…</div>
                    <button onClick={() => removeBlock(selected.data.id, 'one')} disabled={busy}
                      style={{ width:'100%', padding:'9px', background:'#F1F5F9', color:'#334155', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                      Only this one
                    </button>
                    <button onClick={() => removeBlock(selected.data.id, 'future')} disabled={busy}
                      style={{ width:'100%', padding:'9px', background:'#FEF3C7', color:'#92400E', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                      This and all future ones
                    </button>
                    <button onClick={() => removeBlock(selected.data.id, 'all')} disabled={busy}
                      style={{ width:'100%', padding:'9px', background:'#FEE2E2', color:'#B91C1C', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                      All in the series
                    </button>
                  </div>
                  )
                ) : (
                  <button onClick={() => { if (confirm('Remove this blocked time?')) removeBlock(selected.data.id, 'one') }} disabled={busy}
                    style={{ width:'100%', padding:'9px', background:'#FEE2E2', color:'#B91C1C', border:'none', borderRadius:'10px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                    Remove block (become available)
                  </button>
                )}
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
