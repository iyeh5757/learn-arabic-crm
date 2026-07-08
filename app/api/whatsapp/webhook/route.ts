// app/api/whatsapp/webhook/route.ts
// Inbound webhook for the shared team inbox. Evolution API POSTs every message
// event here; we upsert the conversation and store the message. Runs with the
// service-role client (no user session) and is protected by a token.
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WEBHOOK_TOKEN = (process.env.WHATSAPP_WEBHOOK_TOKEN ?? '').trim()

// Health check — Evolution (and you) can GET this to confirm the URL is reachable.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'whatsapp-webhook' })
}

// Pull the readable text (or a media placeholder) out of an Evolution message.
function extractContent(message: any): { body: string; mediaType: string | null } {
  if (!message) return { body: '', mediaType: null }
  if (typeof message.conversation === 'string') return { body: message.conversation, mediaType: null }
  if (message.extendedTextMessage?.text) return { body: message.extendedTextMessage.text, mediaType: null }
  if (message.imageMessage)    return { body: message.imageMessage.caption ?? '📷 Photo', mediaType: 'image' }
  if (message.videoMessage)    return { body: message.videoMessage.caption ?? '🎥 Video', mediaType: 'video' }
  if (message.audioMessage)    return { body: '🎤 Voice message', mediaType: 'audio' }
  if (message.documentMessage) return { body: message.documentMessage.fileName ?? '📎 Document', mediaType: 'document' }
  if (message.stickerMessage)  return { body: '🌟 Sticker', mediaType: 'image' }
  if (message.locationMessage) return { body: '📍 Location', mediaType: null }
  return { body: '', mediaType: null }
}

export async function POST(req: Request) {
  // Auth: require the configured token (?token= or x-webhook-token header)
  if (WEBHOOK_TOKEN) {
    const url = new URL(req.url)
    const token = url.searchParams.get('token') ?? req.headers.get('x-webhook-token') ?? ''
    if (token !== WEBHOOK_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try { payload = await req.json() } catch { return NextResponse.json({ ok: true }) }

  // We only care about incoming/outgoing messages
  const event = payload?.event ?? ''
  if (event && !String(event).includes('messages')) return NextResponse.json({ ok: true })

  // Evolution may send a single message object or an array under data
  const items: any[] = Array.isArray(payload?.data) ? payload.data
    : payload?.data ? [payload.data] : []

  const supabase = createAdminClient()

  for (const data of items) {
    const key = data?.key
    if (!key?.remoteJid) continue
    const jid: string = key.remoteJid
    if (jid === 'status@broadcast') continue     // ignore status updates

    const isGroup = jid.endsWith('@g.us')
    const fromMe = !!key.fromMe
    const direction = fromMe ? 'out' : 'in'
    const waMessageId = key.id ?? null
    const { body, mediaType } = extractContent(data.message)
    const pushName = data.pushName ?? null
    const phoneDigits = isGroup ? '' : jid.split('@')[0].replace(/\D/g, '')
    const ts = data.messageTimestamp ? new Date(Number(data.messageTimestamp) * 1000).toISOString() : new Date().toISOString()

    // Find existing conversation
    const { data: existing } = await supabase.from('wa_conversations').select('id, student_id, name').eq('wa_jid', jid).maybeSingle()

    let conversationId = existing?.id as string | undefined

    if (!conversationId) {
      // Try to match an incoming private number to a student
      let studentId: string | null = null
      let country: string | null = null
      let name: string | null = isGroup ? (pushName ?? 'Group') : pushName
      if (!isGroup && phoneDigits) {
        const { data: match } = await supabase.rpc('match_student_by_phone', { p_digits: phoneDigits })
        const m = Array.isArray(match) ? match[0] : match
        if (m) { studentId = m.id; country = m.country ?? null; name = m.name ?? name }
      }
      const { data: created } = await supabase.from('wa_conversations').insert({
        wa_jid: jid, phone: isGroup ? null : phoneDigits, is_group: isGroup,
        name, student_id: studentId, country,
        last_message_at: ts, last_message_preview: body.slice(0, 120), last_direction: direction,
        unread_count: direction === 'in' ? 1 : 0,
      }).select('id').single()
      conversationId = created?.id
    } else {
      // Update conversation summary
      const upd: Record<string, any> = {
        last_message_at: ts, last_message_preview: body.slice(0, 120), last_direction: direction,
      }
      if (!existing?.name && pushName) upd.name = pushName
      await supabase.from('wa_conversations').update(upd).eq('id', conversationId)
      if (direction === 'in') {
        await supabase.rpc('increment_unread', { conv_id: conversationId }).then(() => {}, () => {})
      }
    }

    if (!conversationId) continue

    // Insert the message (dedupe by WhatsApp message id)
    await supabase.from('wa_messages').insert({
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction, body, media_type: mediaType,
      sender_name: fromMe ? 'You' : (pushName ?? null),
      created_at: ts,
    }).then(() => {}, () => {})   // ignore unique-violation duplicates
  }

  return NextResponse.json({ ok: true })
}
