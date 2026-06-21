// app/api/calendar/availability/route.ts
// GET /api/calendar/availability?teacher_id=&date=YYYY-MM-DD&duration=60
// Returns free slots for a teacher on a given day

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function minutesFromMidnight(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function slotConflicts(
  slotStart: number, slotEnd: number,
  busyIntervals: Array<{ start: number; end: number }>
): boolean {
  return busyIntervals.some(b => slotStart < b.end && slotEnd > b.start)
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)

  const teacherId   = searchParams.get('teacher_id')
  const date        = searchParams.get('date')       // YYYY-MM-DD
  const durationMin = parseInt(searchParams.get('duration') ?? '60')

  if (!teacherId || !date) {
    return NextResponse.json({ error: 'teacher_id and date are required' }, { status: 400 })
  }

  // Determine day of week (0=Sun)
  const [year, month, day] = date.split('-').map(Number)
  const dow = new Date(year, month - 1, day).getDay()

  // Fetch teacher's availability for this day
  const { data: avail } = await supabase
    .from('teacher_availability')
    .select('start_time, end_time')
    .eq('teacher_id', teacherId)
    .eq('day_of_week', dow)
    .eq('is_active', true)

  if (!avail || avail.length === 0) {
    return NextResponse.json({ slots: [], available: false })
  }

  // Fetch booked sessions + blocks that overlap this day
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd   = `${date}T23:59:59.999Z`

  const [{ data: sessions }, { data: blocks }] = await Promise.all([
    supabase.from('calendar_sessions')
      .select('start_at, end_at')
      .eq('teacher_id', teacherId)
      .in('status', ['scheduled', 'rescheduled'])
      .gte('start_at', dayStart).lte('start_at', dayEnd),
    supabase.from('calendar_blocks')
      .select('start_at, end_at')
      .eq('teacher_id', teacherId)
      .gte('start_at', dayStart).lte('start_at', dayEnd),
  ])

  // Convert busy times to minutes-from-midnight
  const busy = [
    ...(sessions ?? []).map(s => ({
      start: minutesFromMidnight(new Date(s.start_at).toTimeString().slice(0, 5)),
      end:   minutesFromMidnight(new Date(s.end_at).toTimeString().slice(0, 5)),
    })),
    ...(blocks ?? []).map(b => ({
      start: minutesFromMidnight(new Date(b.start_at).toTimeString().slice(0, 5)),
      end:   minutesFromMidnight(new Date(b.end_at).toTimeString().slice(0, 5)),
    })),
  ]

  // Generate 30-minute slots within each availability window
  const slots: string[] = []
  for (const w of avail) {
    const windowStart = minutesFromMidnight(w.start_time)
    const windowEnd   = minutesFromMidnight(w.end_time)

    for (let m = windowStart; m + durationMin <= windowEnd; m += 30) {
      if (!slotConflicts(m, m + durationMin, busy)) {
        const hh = String(Math.floor(m / 60)).padStart(2, '0')
        const mm = String(m % 60).padStart(2, '0')
        slots.push(`${hh}:${mm}`)
      }
    }
  }

  return NextResponse.json({ slots, available: slots.length > 0 })
}
