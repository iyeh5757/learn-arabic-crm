// app/api/meta/test/route.ts
// Admin: send ONE test event to Meta with a test_event_code so it appears in
// Events Manager → Test Events without touching real data.
import { createClient } from '@/lib/supabase/server'
import { sendCapiEvents } from '@/lib/meta/capi'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { test_event_code } = await req.json()
  if (!test_event_code?.trim()) return NextResponse.json({ error: 'Enter the test_event_code from Meta → Test Events' }, { status: 400 })

  const result = await sendCapiEvents([{
    event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000), event_id: `capi_test_${Date.now()}`,
    email: 'test.lead@learnarabic.example', phone: '201000000000', first_name: 'Test', last_name: 'Lead',
    value: 1, currency: 'USD',
  }], { testEventCode: test_event_code.trim() })

  if (!result.ok) return NextResponse.json({ error: result.error, response: result.response }, { status: 502 })
  return NextResponse.json({ ok: true, sent: result.sent, meta: result.response })
}
