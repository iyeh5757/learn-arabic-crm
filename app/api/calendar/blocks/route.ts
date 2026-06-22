// app/api/calendar/blocks/route.ts
// Blocked (unavailable) time. Teachers block their own time; admins/supervisors
// can block on a teacher's behalf via teacher_id. Supports bulk (recurring).
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

// GET /api/calendar/blocks?start=&end=&teacher_id=&supervisor_id=
// Returns blocks visible to the caller (RLS scopes by role).
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start        = searchParams.get('start')
  const end          = searchParams.get('end')
  const teacherId    = searchParams.get('teacher_id')
  const supervisorId = searchParams.get('supervisor_id')

  let teacherIdsForSupervisor: string[] | null = null
  if (supervisorId) {
    const { data: ts } = await supabase.from('teachers').select('id').eq('supervisor_id', supervisorId)
    teacherIdsForSupervisor = (ts ?? []).map((t: any) => t.id)
    if (teacherIdsForSupervisor.length === 0) return NextResponse.json([])
  }

  let q = supabase.from('calendar_blocks').select('id, teacher_id, start_at, end_at, reason, recurrence_group_id')
  if (teacherId)               q = q.eq('teacher_id', teacherId)
  if (teacherIdsForSupervisor) q = q.in('teacher_id', teacherIdsForSupervisor)
  if (start) q = q.gte('start_at', start)
  if (end)   q = q.lte('start_at', end)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/calendar/blocks
//   single:  { start_at, end_at, reason?, teacher_id? }
//   bulk:    { blocks: [{ start_at, end_at }], reason?, teacher_id? }
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { reason, teacher_id } = body

  // Resolve teacher id: explicit (admin/supervisor) or the teacher's own
  let tId = teacher_id
  if (!tId) {
    const { data: t } = await supabase.from('teachers').select('id').eq('user_id', user.id).single()
    tId = t?.id ?? null
  }
  if (!tId) return NextResponse.json({ error: 'No teacher profile found for this account' }, { status: 400 })

  const list: Array<{ start_at: string; end_at: string }> = Array.isArray(body.blocks)
    ? body.blocks
    : (body.start_at && body.end_at ? [{ start_at: body.start_at, end_at: body.end_at }] : [])

  if (list.length === 0) return NextResponse.json({ error: 'No block times provided' }, { status: 400 })

  // Recurring (>1 occurrence) blocks share a recurrence group so they can be
  // edited/removed together later (this / this & future / all).
  const groupId = list.length > 1 ? crypto.randomUUID() : null

  const rows = list.map(b => ({
    teacher_id: tId, start_at: b.start_at, end_at: b.end_at, reason: reason ?? null,
    recurrence_group_id: groupId, created_by: user.id,
  }))

  const { data, error } = await supabase.from('calendar_blocks').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, count: data?.length ?? 0 }, { status: 201 })
}
