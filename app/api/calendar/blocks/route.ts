// app/api/calendar/blocks/route.ts
// Teacher (or admin) blocked time. A teacher blocks their own time;
// admins/supervisors/sales may block on a teacher's behalf via teacher_id.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function resolveTeacherId(supabase: any, userId: string, explicit?: string) {
  if (explicit) return explicit
  const { data } = await supabase.from('teachers').select('id').eq('user_id', userId).single()
  return data?.id ?? null
}

// GET /api/calendar/blocks?start=&end=&teacher_id=
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')
  const teacherId = await resolveTeacherId(supabase, user.id, searchParams.get('teacher_id') ?? undefined)
  if (!teacherId) return NextResponse.json([])

  let q = supabase.from('calendar_blocks').select('id, teacher_id, start_at, end_at, reason').eq('teacher_id', teacherId)
  if (start) q = q.gte('start_at', start)
  if (end)   q = q.lte('start_at', end)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// POST /api/calendar/blocks  { start_at, end_at, reason?, teacher_id? }
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { start_at, end_at, reason, teacher_id } = await req.json()
  if (!start_at || !end_at) return NextResponse.json({ error: 'start_at and end_at required' }, { status: 400 })

  const tId = await resolveTeacherId(supabase, user.id, teacher_id)
  if (!tId) return NextResponse.json({ error: 'No teacher profile found for this account' }, { status: 400 })

  const { data, error } = await supabase
    .from('calendar_blocks')
    .insert({ teacher_id: tId, start_at, end_at, reason: reason ?? null, created_by: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
