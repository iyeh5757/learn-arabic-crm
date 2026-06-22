// app/api/calendar/sync-google/route.ts
// Admin-only: pull changes (deletions / reschedules) from Google into the CRM.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { syncFromGoogle } from '@/lib/calendar/sync'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const result = await syncFromGoogle()
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? 'Sync failed' }, { status: 500 })
  }
}
