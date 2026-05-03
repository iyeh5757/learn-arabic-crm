// app/api/payments/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('student_id')
  const status    = searchParams.get('status')

  let query = supabase.from('payments').select(`
    *, student:students(id, name, currency, phone, email),
    added_by_profile:profiles!payments_added_by_fkey(name)
  `).order('created_at', { ascending: false })

  if (studentId) query = query.eq('student_id', studentId)
  if (status)    query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('payments')
    .insert({ ...body, added_by: user.id })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
