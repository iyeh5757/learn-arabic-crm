// app/api/calendar/google-status/route.ts
// Admin-only: checks whether the Google Calendar / Meet integration is working.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { testGoogleConnection } from '@/lib/calendar/google'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const result = await testGoogleConnection()
  return NextResponse.json(result)
}
