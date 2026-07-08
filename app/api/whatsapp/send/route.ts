// app/api/whatsapp/send/route.ts
// Outbound: a staff member replies to a conversation from the shared inbox.
// Sends via Evolution and records the outbound message.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendWhatsAppText } from '@/lib/notifications/whatsapp'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
  if (!['admin', 'supervisor', 'sales'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { conversation_id, text } = await req.json()
  if (!conversation_id || !text?.trim()) {
    return NextResponse.json({ error: 'conversation_id and text are required' }, { status: 400 })
  }

  const { data: conv } = await supabase.from('wa_conversations').select('id, wa_jid').eq('id', conversation_id).single()
  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const sent = await sendWhatsAppText(conv.wa_jid, text.trim())
  if (!sent.success) return NextResponse.json({ error: sent.error ?? 'Send failed' }, { status: 502 })

  const now = new Date().toISOString()
  const { data: msg } = await supabase.from('wa_messages').insert({
    conversation_id, wa_message_id: sent.id ?? null,
    direction: 'out', body: text.trim(),
    sender_name: profile?.name ?? 'Staff', sent_by: user.id, status: 'sent',
    created_at: now,
  }).select().single()

  await supabase.from('wa_conversations').update({
    last_message_at: now, last_message_preview: text.trim().slice(0, 120),
    last_direction: 'out', unread_count: 0,   // staff replied → clear unread
  }).eq('id', conversation_id)

  return NextResponse.json({ ok: true, message: msg })
}
