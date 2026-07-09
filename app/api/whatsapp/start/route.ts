// app/api/whatsapp/start/route.ts
// Start a brand-new conversation with a number that hasn't messaged us yet:
// send the first message and create the inbox conversation.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppText } from '@/lib/notifications/whatsapp'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function digitsOnly(p: string): string { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); return d }

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
  if (!['admin', 'supervisor', 'sales'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { phone, text } = await req.json()
  const digits = digitsOnly(String(phone ?? ''))
  if (!digits || digits.length < 8) return NextResponse.json({ error: 'Enter a valid phone number with country code' }, { status: 400 })
  if (!text?.trim()) return NextResponse.json({ error: 'Type a first message' }, { status: 400 })

  // Send the first message
  const sent = await sendWhatsAppText(digits, text.trim())
  if (!sent.success) return NextResponse.json({ error: sent.error ?? 'Send failed (is this number on WhatsApp?)' }, { status: 502 })

  const admin = createAdminClient()
  const jid = `${digits}@s.whatsapp.net`
  const now = new Date().toISOString()

  // Match to a student if we know this number
  let studentId: string | null = null, country: string | null = null, matchedName: string | null = null
  const { data: match } = await admin.rpc('match_student_by_phone', { p_digits: digits })
  const m = Array.isArray(match) ? match[0] : match
  if (m) { studentId = m.id; country = m.country ?? null; matchedName = m.name ?? null }

  // Create or update the conversation
  const { data: conv } = await admin.from('wa_conversations').upsert({
    wa_jid: jid, phone: digits, is_group: false,
    name: matchedName, student_id: studentId, country,
    last_message_at: now, last_message_preview: text.trim().slice(0, 120), last_direction: 'out',
    unread_count: 0, status: 'open',
  }, { onConflict: 'wa_jid' }).select('id').single()

  if (conv?.id) {
    await admin.from('wa_messages').insert({
      conversation_id: conv.id, wa_message_id: sent.id ?? null,
      direction: 'out', body: text.trim(), sender_name: profile?.name ?? 'Staff', sent_by: user.id, status: 'sent',
      created_at: now,
    })
  }

  return NextResponse.json({ ok: true, conversation_id: conv?.id ?? null })
}
