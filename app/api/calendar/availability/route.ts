// app/api/calendar/availability/route.ts
// GET /api/calendar/availability?teacher_id=&date=YYYY-MM-DD&duration=60
// Returns free Cairo-time slots for a teacher on a given day, computed live
// from their sessions + blocked time (and weekly availability if defined).

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const TZ = 'Africa/Cairo'
const DEFAULT_START = 0          // 00:00 — teachers are available all day
const DEFAULT_END   = 24 * 60    // 24:00 — unless blocked or booked
const STEP = 30                 // 30-minute granularity

function minutesFromTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
function tzOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const m: any = {}; for (const p of dtf.formatToParts(date)) m[p.type] = p.value
  return (Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second) - date.getTime()) / 60000
}
function cairoToUtc(dateStr: string, minutes: number): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60))
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000)
}
function cairoMinutes(iso: string): number {
  const d = new Date(iso)
  const p: any = {}; for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)) p[x.type] = x.value
  let h = +p.hour; if (h === 24) h = 0
  return h * 60 + (+p.minute)
}
function overlaps(s: number, e: number, busy: Array<{ start: number; end: number }>): boolean {
  return busy.some(b => s < b.end && e > b.start)
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const teacherId   = searchParams.get('teacher_id')
  const date        = searchParams.get('date')
  const durationMin = parseInt(searchParams.get('duration') ?? '60')
  if (!teacherId || !date) return NextResponse.json({ error: 'teacher_id and date are required' }, { status: 400 })

  const [y, mo, d] = date.split('-').map(Number)
  const dow = new Date(y, mo - 1, d).getDay()

  // Working windows: teacher's weekly availability if set, else a default day
  const { data: avail } = await supabase
    .from('teacher_availability')
    .select('start_time, end_time')
    .eq('teacher_id', teacherId).eq('day_of_week', dow).eq('is_active', true)
  const windows = (avail && avail.length)
    ? avail.map(w => ({ start: minutesFromTime(w.start_time), end: minutesFromTime(w.end_time) }))
    : [{ start: DEFAULT_START, end: DEFAULT_END }]

  // Busy = sessions + blocks overlapping this Cairo day
  const dayStart = cairoToUtc(date, 0).toISOString()
  const dayEnd   = cairoToUtc(date, 24 * 60).toISOString()
  const [{ data: sessions }, { data: blocks }] = await Promise.all([
    supabase.from('calendar_sessions').select('start_at, end_at').eq('teacher_id', teacherId)
      .in('status', ['scheduled', 'rescheduled']).gte('start_at', dayStart).lt('start_at', dayEnd),
    supabase.from('calendar_blocks').select('start_at, end_at').eq('teacher_id', teacherId)
      .gte('start_at', dayStart).lt('start_at', dayEnd),
  ])
  const busy = [...(sessions ?? []), ...(blocks ?? [])].map(x => {
    let start = cairoMinutes(x.start_at), end = cairoMinutes(x.end_at)
    if (end <= start) end = 24 * 60
    return { start, end }
  })

  const now = Date.now()
  const slots: string[] = []
  for (const w of windows) {
    for (let m = w.start; m + durationMin <= w.end; m += STEP) {
      if (overlaps(m, m + durationMin, busy)) continue
      if (cairoToUtc(date, m).getTime() < now) continue   // skip past slots
      slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
    }
  }

  return NextResponse.json({ slots, available: slots.length > 0 })
}
