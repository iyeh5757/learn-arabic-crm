// lib/notifications/whatsapp.ts
// Evolution API integration (self-hosted WhatsApp gateway via WhatsApp Web)
//
// Required env vars:
//   EVOLUTION_API_URL   e.g. https://evo.yourdomain.com   (no trailing slash)
//   EVOLUTION_API_KEY   the global apikey for your instance
//   EVOLUTION_INSTANCE  the instance name you created (e.g. "learnarabic")

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
}

// Best-effort primary IANA timezone per country (the agreed chat time governs)
const COUNTRY_TZ: Record<string, string> = {
  'Afghanistan': 'Asia/Kabul', 'Albania': 'Europe/Tirane', 'Algeria': 'Africa/Algiers',
  'Angola': 'Africa/Luanda', 'Argentina': 'America/Argentina/Buenos_Aires', 'Armenia': 'Asia/Yerevan',
  'Australia': 'Australia/Sydney', 'Austria': 'Europe/Vienna', 'Azerbaijan': 'Asia/Baku',
  'Bahrain': 'Asia/Bahrain', 'Bangladesh': 'Asia/Dhaka', 'Belarus': 'Europe/Minsk', 'Belgium': 'Europe/Brussels',
  'Bolivia': 'America/La_Paz', 'Bosnia and Herzegovina': 'Europe/Sarajevo', 'Brazil': 'America/Sao_Paulo',
  'Bulgaria': 'Europe/Sofia', 'Cambodia': 'Asia/Phnom_Penh', 'Canada': 'America/Toronto', 'Chile': 'America/Santiago',
  'China': 'Asia/Shanghai', 'Colombia': 'America/Bogota', 'Croatia': 'Europe/Zagreb', 'Cyprus': 'Asia/Nicosia',
  'Czech Republic': 'Europe/Prague', 'Denmark': 'Europe/Copenhagen', 'Dominican Republic': 'America/Santo_Domingo',
  'Ecuador': 'America/Guayaquil', 'Egypt': 'Africa/Cairo', 'El Salvador': 'America/El_Salvador', 'Estonia': 'Europe/Tallinn',
  'Ethiopia': 'Africa/Addis_Ababa', 'Finland': 'Europe/Helsinki', 'France': 'Europe/Paris', 'Georgia': 'Asia/Tbilisi',
  'Germany': 'Europe/Berlin', 'Ghana': 'Africa/Accra', 'Greece': 'Europe/Athens', 'Guatemala': 'America/Guatemala',
  'Honduras': 'America/Tegucigalpa', 'Hungary': 'Europe/Budapest', 'India': 'Asia/Kolkata', 'Indonesia': 'Asia/Jakarta',
  'Iran': 'Asia/Tehran', 'Iraq': 'Asia/Baghdad', 'Ireland': 'Europe/Dublin', 'Israel': 'Asia/Jerusalem',
  'Italy': 'Europe/Rome', 'Jamaica': 'America/Jamaica', 'Japan': 'Asia/Tokyo', 'Jordan': 'Asia/Amman',
  'Kazakhstan': 'Asia/Almaty', 'Kenya': 'Africa/Nairobi', 'Kuwait': 'Asia/Kuwait', 'Lebanon': 'Asia/Beirut',
  'Libya': 'Africa/Tripoli', 'Luxembourg': 'Europe/Luxembourg', 'Malaysia': 'Asia/Kuala_Lumpur', 'Malta': 'Europe/Malta',
  'Mexico': 'America/Mexico_City', 'Morocco': 'Africa/Casablanca', 'Netherlands': 'Europe/Amsterdam',
  'New Zealand': 'Pacific/Auckland', 'Nigeria': 'Africa/Lagos', 'Norway': 'Europe/Oslo', 'Oman': 'Asia/Muscat',
  'Pakistan': 'Asia/Karachi', 'Palestine': 'Asia/Gaza', 'Peru': 'America/Lima', 'Philippines': 'Asia/Manila',
  'Poland': 'Europe/Warsaw', 'Portugal': 'Europe/Lisbon', 'Qatar': 'Asia/Qatar', 'Romania': 'Europe/Bucharest',
  'Russia': 'Europe/Moscow', 'Saudi Arabia': 'Asia/Riyadh', 'Senegal': 'Africa/Dakar', 'Serbia': 'Europe/Belgrade',
  'Singapore': 'Asia/Singapore', 'Somalia': 'Africa/Mogadishu', 'South Africa': 'Africa/Johannesburg',
  'South Korea': 'Asia/Seoul', 'Spain': 'Europe/Madrid', 'Sri Lanka': 'Asia/Colombo', 'Sudan': 'Africa/Khartoum',
  'Sweden': 'Europe/Stockholm', 'Switzerland': 'Europe/Zurich', 'Syria': 'Asia/Damascus', 'Tanzania': 'Africa/Dar_es_Salaam',
  'Thailand': 'Asia/Bangkok', 'Tunisia': 'Africa/Tunis', 'Turkey': 'Europe/Istanbul', 'Uganda': 'Africa/Kampala',
  'Ukraine': 'Europe/Kiev', 'United Arab Emirates': 'Asia/Dubai', 'United Kingdom': 'Europe/London',
  'United States': 'America/New_York', 'Uzbekistan': 'Asia/Tashkent', 'Venezuela': 'America/Caracas',
  'Vietnam': 'Asia/Ho_Chi_Minh', 'Yemen': 'Asia/Aden', 'Zimbabwe': 'Africa/Harare',
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
      lines.push(``, `📌 Need to reschedule or cancel? Please message us here in our chat and we'll be happy to help.`)
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
