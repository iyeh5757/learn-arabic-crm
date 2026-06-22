// lib/notifications/whatsapp.ts
// Evolution API integration (self-hosted WhatsApp gateway via WhatsApp Web)
//
// Required env vars:
//   EVOLUTION_API_URL   e.g. https://evo.yourdomain.com   (no trailing slash)
//   EVOLUTION_API_KEY   the global apikey for your instance
//   EVOLUTION_INSTANCE  the instance name you created (e.g. "learnarabic")

const API_URL  = process.env.EVOLUTION_API_URL?.replace(/\/+$/, '')
const API_KEY  = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE

export interface SessionReminderData {
  studentName:  string
  teacherName:  string
  sessionType:  string
  startAt:      Date
  durationMins: number
  meetLink?:    string
  hoursBeforeLabel: '24 hours' | '12 hours' | '1 hour'
}

function formatTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Africa/Cairo',
    weekday: 'long',
    month:   'short',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
    hour12:  true,
  })
}

function buildReminderText(data: SessionReminderData): string {
  const time = formatTime(data.startAt)
  const lines = [
    `📚 *Arabic Class Reminder*`,
    ``,
    `Hi ${data.studentName}! Your ${data.sessionType} session with *${data.teacherName}* starts in *${data.hoursBeforeLabel}*.`,
    ``,
    `🗓 *${time} (Cairo time)*`,
    `⏱ Duration: ${data.durationMins} minutes`,
  ]
  if (data.meetLink) {
    lines.push(``, `🎥 *Join here:* ${data.meetLink}`)
  }
  lines.push(``, `_Learn Arabic Academy — automated reminder_`)
  return lines.join('\n')
}

// Normalise to international format with no + or spaces.
// Egyptian local numbers starting with 0 are converted to 20xxxxxxxxxx.
function normalisePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('00')) p = p.slice(2)
  else if (p.startsWith('0')) p = '20' + p.slice(1)
  return p
}

export async function sendWhatsAppReminder(
  phone: string,
  data: SessionReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!API_URL || !API_KEY || !INSTANCE) {
    return { success: false, error: 'Evolution API credentials not configured' }
  }

  const number = normalisePhone(phone)

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
