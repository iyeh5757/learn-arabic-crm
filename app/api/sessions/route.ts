// app/api/sessions/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const teacherId = searchParams.get('teacher_id')
  const studentId = searchParams.get('student_id')
  const month     = searchParams.get('month') // YYYY-MM

  let query = supabase.from('sessions').select(`
    *, teacher:teachers(id, rate_per_session_usd, profile:profiles!teachers_user_id_fkey(name)),
    student:students(id, name, session_duration)
  `).order('session_date', { ascending: false })

  if (teacherId) query = query.eq('teacher_id', teacherId)
  if (studentId) query = query.eq('student_id', studentId)
  if (month) {
    query = query.gte('session_date', `${month}-01`).lt('session_date', `${month}-32`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const body = await req.json()
  const { data, error } = await supabase.from('sessions').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
