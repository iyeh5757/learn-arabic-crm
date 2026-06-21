// lib/notifications/whatsapp.ts
// Meta WhatsApp Cloud API integration

const META_API_URL = 'https://graph.facebook.com/v19.0'
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID
const ACCESS_TOKEN    = process.env.META_WHATSAPP_TOKEN

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
  lines.push(``, `_Learn Arabic CRM — automated reminder_`)
  return lines.join('\n')
}

export async function sendWhatsAppReminder(
  phone: string,
  data: SessionReminderData
): Promise<{ success: boolean; error?: string }> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { success: false, error: 'WhatsApp credentials not configured' }
  }

  // Normalise phone: must start with country code, no + or spaces
  const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '20') // Egypt default

  const body = {
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'text',
    text: { body: buildReminderText(data), preview_url: false },
  }

  try {
    const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/messages`, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const json = await res.json()
    if (!res.ok) {
      const errMsg = json?.error?.message ?? `HTTP ${res.status}`
      console.error('[WhatsApp] Send failed:', errMsg)
      return { success: false, error: errMsg }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Network error' }
  }
}
