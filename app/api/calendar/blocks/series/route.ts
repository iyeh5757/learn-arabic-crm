// app/api/calendar/blocks/series/route.ts
// Retime an entire recurring block series: shift every upcoming block in the
// group to a new from/to time (keeping each block's date).
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const TZ = 'Africa/Cairo'
function tzOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const m: any = {}; for (const p of dtf.formatToParts(date)) m[p.type] = p.value
  return (Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second) - date.getTime()) / 60000
}
function cairoToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm))
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000)
}
function cairoDate(iso: string): string {
  const p: any = {}; for (const x of new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))) p[x.type] = x.value
  return `${p.year}-${p.month}-${p.day}`
}

export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { group, start_time, end_time } = await req.json()
  if (!group || !start_time || !end_time) return NextResponse.json({ error: 'group, start_time and end_time are required' }, { status: 400 })

  // Upcoming blocks in this series
  const { data: blocks } = await supabase
    .from('calendar_blocks')
    .select('id, teacher_id, reason, start_at')
    .eq('recurrence_group_id', group)
    .gte('start_at', new Date().toISOString())
  if (!blocks || blocks.length === 0) return NextResponse.json({ ok: true, updated: 0 })

  // Rebuild each on its own date with the new time
  const rows = blocks.map((b: any) => {
    const ds = cairoDate(b.start_at)
    return {
      teacher_id: b.teacher_id, reason: b.reason, recurrence_group_id: group, created_by: user.id,
      start_at: cairoToUtc(ds, start_time).toISOString(),
      end_at: cairoToUtc(ds, end_time).toISOString(),
    }
  })

  // Replace: delete the old upcoming ones, insert the retimed ones
  const ids = blocks.map((b: any) => b.id)
  const { error: delErr } = await supabase.from('calendar_blocks').delete().in('id', ids)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })
  const { error: insErr } = await supabase.from('calendar_blocks').insert(rows)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, updated: rows.length })
}
