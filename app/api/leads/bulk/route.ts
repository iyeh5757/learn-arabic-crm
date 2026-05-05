// app/api/leads/bulk/route.ts
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const adminClient = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leads, assigned_to } = await req.json()
  if (!leads?.length) return NextResponse.json({ error: 'No leads provided' }, { status: 400 })

  const rows = leads.map((l: any) => ({
    submitted_date:  l.submitted_date || null,
    name:            l.name,
    email:           l.email || null,
    phone:           l.phone || null,
    for_whom:        l.for_whom === 'ME' ? 'ME' : l.for_whom === 'Child' ? 'Child' : null,
    want_to_learn:   l.want_to_learn || null,
    country:         l.country || null,
    assigned_to:     assigned_to || null,
    uploaded_by:     user.id,
    status:          'new',
    pipeline_stage:  0,
  }))

  const { error } = await adminClient.from('leads').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, count: rows.length })
}
