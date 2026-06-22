// app/api/calendar/test-whatsapp/route.ts
// Admin-only endpoint to fire a single test WhatsApp message,
// so we can verify the Evolution API connection without waiting
// for a real 24h-before reminder.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsAppReminder } from '@/lib/notifications/whatsapp'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { phone } = await req.json()
  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
  }

  // Build a realistic-looking test reminder
  const result = await sendWhatsAppReminder(phone, {
    studentName:  'Test Student',
    teacherName:  'Ahmed',
    sessionType:  'Egyptian Arabic',
    startAt:      new Date(Date.now() + 24 * 60 * 60 * 1000),
    durationMins: 60,
    meetLink:     'https://meet.google.com/test-link',
    hoursBeforeLabel: '24 hours',
  })

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true, message: 'Test message sent' })
}
