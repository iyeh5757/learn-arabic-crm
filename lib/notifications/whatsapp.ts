// lib/notifications/whatsapp.ts
// Evolution API integration (self-hosted WhatsApp gateway via WhatsApp Web)
//
// Required env vars:
//   EVOLUTION_API_URL   e.g. https://evo.yourdomain.com   (no trailing slash)
//   EVOLUTION_API_KEY   the global apikey for your instance
//   EVOLUTION_INSTANCE  the instance name you created (e.g. "learnarabic")

import { COUNTRY_TZ } from '@/lib/countries'

// Strip any non-printable / non-ASCII characters that can sneak in when
// pasting credentials (e.g. U+2028 line separators) — HTTP headers must be ASCII.
function clean(v?: string): string {
  return (v ?? '').replace(/[^\x20-\x7E]/g, '').trim()
}

// Ensure the URL has a scheme — fetch() requires https:// or http://
function withScheme(url: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return 'https://' + url
}

const API_URL  = withScheme(clean(process.env.EVOLUTION_API_URL)).replace(/\/+$/, '')
const API_KEY  = clean(process.env.EVOLUTION_API_KEY)
const INSTANCE = clean(process.env.EVOLUTION_INSTANCE)

export interface SessionReminderData {
  studentName:  string
  teacherName:  string
  sessionType:  string
  startAt:      Date
  durationMins: number
  meetLink?:    string
  hoursBeforeLabel: '24 hours' | '12 hours' | '1 hour'
  studentCountry?: string   // used to show the student's local time too
  whatsappGroupId?: string  // when set, reminder goes to the group instead of private
}

function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleString('en-GB', {
    timeZone, weekday: 'long', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function buildReminderText(data: SessionReminderData): string {
  const isTrial = (data.sessionType ?? '').toLowerCase().includes('trial')
  const cairoTime = formatTime(data.startAt, 'Africa/Cairo')
  const studentTz = data.studentCountry ? COUNTRY_TZ[data.studentCountry] : undefined

  const lines = [
    `📚 *Arabic Class Reminder*`,
    ``,
    `Hi ${data.studentName}! Your ${data.sessionType} session with *${data.teacherName}* starts in *${data.hoursBeforeLabel}*.`,
    ``,
  ]

  // Show the student's local time + Egypt time when we know their country
  if (studentTz && studentTz !== 'Africa/Cairo') {
    lines.push(
      `🗓 *Your time:* ${formatTime(data.startAt, studentTz)}`,
      `🇪🇬 *Egypt time:* ${cairoTime}`,
    )
  } else {
    lines.push(`🗓 *${cairoTime} (Egypt / Cairo time)*`)
  }
  lines.push(`⏱ Duration: ${data.durationMins} minutes`)

  if (data.meetLink) {
    lines.push(``, `🎥 *Join here:* ${data.meetLink}`)
  }

  if (studentTz && studentTz !== 'Africa/Cairo') {
    lines.push(``, `ℹ️ Egypt time may be different from your local time — your class is held at the time we agreed in our chat.`)
  }

  // Reschedule / cancel notice only on the earlier reminders (not the 1-hour one)
  if (data.hoursBeforeLabel === '24 hours' || data.hoursBeforeLabel === '12 hours') {
    if (isTrial) {
      lines.push(``, `📌 Need to reschedule or cancel? Please message us here in the chat and we'll be happy to help.`)
    } else if (data.whatsappGroupId) {
      // Already in the group — tell them to reply here
      lines.push(``, `📌 Need to reschedule? Reply in this group and your supervisor will help. Reschedule requests must be made *at least 12 hours in advance* — otherwise the class will be counted.`)
    } else {
      lines.push(``, `📌 Need to reschedule? Please reach out to your supervisor in your group so they can help. Reschedule requests must be made *at least 12 hours in advance* — otherwise the class will be counted.`)
    }
  }

  lines.push(``, `_Learn Arabic Academy — automated reminder_`)
  return lines.join('\n')
}

// Normalise to international format with no + or spaces.
// Numbers are stored WITH their country code already, so we only strip
// formatting characters and any "00" / "+" international dialling prefix.
function normalisePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')   // drop +, spaces, dashes, parentheses
  if (p.startsWith('00')) p = p.slice(2)  // 0044... -> 44...
  return p
}

// Diagnostic: list the instance names that actually exist on the server.
export async function listInstances(): Promise<{ names: string[]; error?: string }> {
  if (!API_URL || !API_KEY) return { names: [], error: 'Credentials not configured' }
  try {
    const res = await fetch(`${API_URL}/instance/fetchInstances`, {
      headers: { apikey: API_KEY },
    })
    const json = await res.json()
    if (!res.ok) return { names: [], error: json?.message ?? `HTTP ${res.status}` }
    // Evolution returns an array; instance name is at .name or .instance.instanceName
    const arr = Array.isArray(json) ? json : []
    const names = arr.map((i: any) =>
      i?.name ?? i?.instance?.instanceName ?? i?.instanceName ?? JSON.stringify(i).slice(0, 40)
    )
    return { names }
  } catch (err: any) {
    return { names: [], error: err?.message ?? 'Network error' }
  }
}

export async function sendWhatsAppReminder(
  phone: string,
  data: SessionReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!API_URL || !API_KEY || !INSTANCE) {
    return { success: false, error: 'Evolution API credentials not configured' }
  }

  // Use group JID when available, otherwise fall back to private chat.
  // Group JIDs already contain @g.us and need no normalisation.
  const number = data.whatsappGroupId ? data.whatsappGroupId : normalisePhone(phone)
  if (!number) return { success: false, error: 'No phone or group ID available' }

  // Evolution API v2 sendText endpoint
  const body = {
    number,
    text: buildReminderText(data),
  }

  try {
    const res = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
      method:  'POST',
      headers: {
        apikey:         API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    let json: any = null
    try { json = await res.json() } catch { /* non-JSON response */ }

    if (!res.ok) {
      const errMsg = json?.message ?? json?.error ?? `HTTP ${res.status}`
      console.error('[WhatsApp/Evolution] Send failed:', errMsg)
      return { success: false, error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg) }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Network error' }
  }
}

// Fetch a group's real subject (title) from Evolution. Message events don't
// carry the subject, so we look it up. Returns null on failure.
export async function getGroupSubject(groupJid: string): Promise<string | null> {
  if (!API_URL || !API_KEY || !INSTANCE || !groupJid) return null
  try {
    const res = await fetch(`${API_URL}/group/findGroupInfos/${INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`, {
      headers: { apikey: API_KEY },
    })
    if (!res.ok) return null
    const j = await res.json().catch(() => null)
    const g = Array.isArray(j) ? j[0] : (j?.group ?? j)
    const subject = g?.subject ?? g?.name ?? null
    return typeof subject === 'string' && subject.trim() ? subject.trim() : null
  } catch { return null }
}

// Download a media message's bytes from Evolution (base64). `raw` is the raw
// message payload we captured from the webhook. Returns the decoded buffer +
// mimetype, or null on failure. Tries a couple of request shapes across versions.
export async function getMediaBase64FromEvolution(
  raw: any
): Promise<{ buffer: Buffer; mimetype: string } | null> {
  if (!API_URL || !API_KEY || !INSTANCE || !raw) return null
  const bodies = [
    { message: raw, convertToMp4: false },
    { message: { key: raw.key }, convertToMp4: false },
  ]
  for (const body of bodies) {
    try {
      const res = await fetch(`${API_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`, {
        method: 'POST', headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) continue
      const j = await res.json().catch(() => null)
      const b64 = j?.base64 ?? j?.media ?? j?.buffer
      if (typeof b64 === 'string' && b64.length > 0) {
        const mimetype = j?.mimetype ?? j?.mimeType ?? 'application/octet-stream'
        return { buffer: Buffer.from(b64, 'base64'), mimetype }
      }
    } catch { /* try next shape */ }
  }
  return null
}

// Generic free-text send — used by the shared team inbox. `to` may be a full
// WhatsApp JID (…@s.whatsapp.net / …@g.us) or a plain phone number.
export async function sendWhatsAppText(
  to: string, text: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!API_URL || !API_KEY || !INSTANCE) {
    return { success: false, error: 'Evolution API credentials not configured' }
  }
  const number = to.includes('@') ? to.split('@')[0] : normalisePhone(to)
  if (!number) return { success: false, error: 'No recipient' }

  try {
    const res = await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
      method:  'POST',
      headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ number, text }),
    })
    let json: any = null
    try { json = await res.json() } catch { /* non-JSON */ }
    if (!res.ok) {
      const errMsg = json?.message ?? json?.error ?? `HTTP ${res.status}`
      return { success: false, error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg) }
    }
    return { success: true, id: json?.key?.id ?? undefined }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Network error' }
  }
}
