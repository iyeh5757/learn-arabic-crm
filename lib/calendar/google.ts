// lib/calendar/google.ts
// Google Calendar + Meet integration via a Workspace service account with
// domain-wide delegation. The service account impersonates a Workspace user
// (the org account) which becomes the organizer of every event.
//
// Required env vars (only needed for Meet links — everything else works without them):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL        the service account address
//   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  the private key (with \n escapes is fine)
//   GOOGLE_IMPERSONATE_EMAIL            the Workspace user to act as (e.g. admin@learnarabic08.com)
//   GOOGLE_CALENDAR_ID                  optional, defaults to that user's "primary" calendar

import crypto from 'crypto'

const SA_EMAIL    = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '').trim()
const SA_KEY      = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim()
const IMPERSONATE = (process.env.GOOGLE_IMPERSONATE_EMAIL ?? '').trim()
const CALENDAR_ID = (process.env.GOOGLE_CALENDAR_ID ?? 'primary').trim()

export function isGoogleConfigured(): boolean {
  return !!(SA_EMAIL && SA_KEY && IMPERSONATE)
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar'
const SCOPE_MEET     = 'https://www.googleapis.com/auth/meetings.space.created'

async function getAccessToken(scope: string = SCOPE_CALENDAR): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss:   SA_EMAIL,
    scope,
    aud:   'https://oauth2.googleapis.com/token',
    sub:   IMPERSONATE,        // impersonate the Workspace user
    iat:   now,
    exp:   now + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsigned)
  const signature = base64url(signer.sign(SA_KEY))
  const jwt = `${unsigned}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? 'Google token error')
  return json.access_token
}

// Verify the service account + key + domain-wide delegation actually work
// by requesting an impersonated access token. Returns a clear error if not.
export async function testGoogleConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!isGoogleConfigured()) {
    const missing = [
      !SA_EMAIL && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      !SA_KEY && 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      !IMPERSONATE && 'GOOGLE_IMPERSONATE_EMAIL',
    ].filter(Boolean).join(', ')
    return { ok: false, error: `Missing env vars: ${missing}` }
  }
  try {
    await getAccessToken()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Unknown error' }
  }
}

export interface CreateEventInput {
  summary:     string
  description?: string
  startIso:    string
  endIso:      string
  timezone:    string
  attendees:   string[]   // email addresses
}

export interface CreatedEvent {
  eventId:  string
  meetLink: string | null
  htmlLink: string | null
}

// Creates a Google Calendar event with a Meet link and emails invites to attendees.
export async function createCalendarEventWithMeet(
  input: CreateEventInput
): Promise<CreatedEvent | null> {
  if (!isGoogleConfigured()) return null

  const token = await getAccessToken()
  const body = {
    summary:     input.summary,
    description: input.description ?? '',
    start: { dateTime: input.startIso, timeZone: input.timezone },
    end:   { dateTime: input.endIso,   timeZone: input.timezone },
    attendees: input.attendees.filter(Boolean).map(email => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`
  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Google Calendar create failed')

  const meetLink =
    json.hangoutLink ??
    json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri ??
    null

  return { eventId: json.id, meetLink, htmlLink: json.htmlLink ?? null }
}

// Creates a Meet space directly via the Meet API (so we own it and can set
// access type, auto-recording, and co-hosts). Recording is patched separately
// so an unsupported plan doesn't block space creation.
export async function createMeetSpace(
  opts: { openAccess?: boolean; autoRecord?: boolean }
): Promise<{ meetUri: string; spaceName: string; recordingApplied: boolean }> {
  const token = await getAccessToken(SCOPE_MEET)
  const res = await fetch('https://meet.googleapis.com/v2/spaces', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ config: { accessType: opts.openAccess ? 'OPEN' : 'TRUSTED' } }),
  })
  const space = await res.json()
  if (!res.ok) throw new Error(space?.error?.message ?? 'Meet space create failed')

  const meetUri   = space.meetingUri
  const spaceName = space.name   // "spaces/xxxx"

  let recordingApplied = false
  if (opts.autoRecord) {
    try {
      const pr = await fetch(
        `https://meet.googleapis.com/v2/${spaceName}?updateMask=config.artifactConfig.recordingConfig.autoRecordingGeneration`,
        {
          method:  'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ config: { artifactConfig: { recordingConfig: { autoRecordingGeneration: 'ON' } } } }),
        }
      )
      recordingApplied = pr.ok
      if (!pr.ok) console.error('[Meet] auto-record patch failed:', (await pr.json().catch(() => ({})))?.error?.message)
    } catch (e: any) { console.error('[Meet] auto-record error:', e?.message) }
  }

  return { meetUri, spaceName, recordingApplied }
}

// Adds co-hosts to a Meet space (best-effort; co-hosts usually must be in the org).
export async function addMeetCoHosts(
  spaceName: string, emails: string[]
): Promise<{ added: string[]; error?: string }> {
  const out: { added: string[]; error?: string } = { added: [] }
  if (!spaceName || emails.length === 0) return out
  let token: string
  try { token = await getAccessToken(SCOPE_MEET) }
  catch (e: any) { out.error = e?.message; return out }

  // Member management (co-host roles) lives under the v2beta API.
  for (const email of emails) {
    try {
      const r = await fetch(`https://meet.googleapis.com/v2beta/${spaceName}/members`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, role: 'COHOST' }),
      })
      if (r.ok) out.added.push(email)
      else if (!out.error) out.error = (await r.json().catch(() => ({})))?.error?.message ?? `member ${r.status}`
    } catch (e: any) { if (!out.error) out.error = e?.message }
  }
  return out
}

// Creates a calendar event that points at an already-created Meet link
// (made via the Meet API). First tries to attach it as a real conference so the
// native "Join with Google Meet" button shows; falls back to a description link.
export async function createCalendarEventWithLink(
  input: CreateEventInput, meetLink: string, sendUpdates: 'all' | 'none' = 'all',
  recurrence?: string[]   // e.g. ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'] for a recurring series
): Promise<CreatedEvent | null> {
  if (!isGoogleConfigured()) return null
  const token = await getAccessToken()
  const code = meetLink.split('/').filter(Boolean).pop() ?? ''
  const description = `${input.description ? input.description + '\n\n' : ''}🎥 Join Google Meet: ${meetLink}`
  const base: any = {
    summary:     input.summary,
    description,
    start: { dateTime: input.startIso, timeZone: input.timezone },
    end:   { dateTime: input.endIso,   timeZone: input.timezone },
    attendees: input.attendees.filter(Boolean).map(email => ({ email })),
  }
  if (recurrence && recurrence.length) base.recurrence = recurrence
  const calBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`

  // Attempt 1: attach as a native conference (shows the Join button)
  const withConf = {
    ...base,
    conferenceData: {
      conferenceId: code,
      conferenceSolution: { key: { type: 'hangoutsMeet' }, name: 'Google Meet' },
      entryPoints: [{ entryPointType: 'video', uri: meetLink, label: code }],
    },
  }
  let res = await fetch(`${calBase}?conferenceDataVersion=1&sendUpdates=${sendUpdates}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(withConf),
  })

  // Attempt 2 (fallback): plain event, link in description only
  if (!res.ok) {
    res = await fetch(`${calBase}?sendUpdates=${sendUpdates}`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(base),
    })
  }

  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Google Calendar create failed')
  return { eventId: json.id, meetLink, htmlLink: json.htmlLink ?? null }
}

// ── Recurring-series instance helpers ──────────────────────────────────────
// A recurring event has one master ID; each occurrence is an "instance" with
// its own instance ID. These let us cancel / move a single occurrence, or
// truncate the whole series, without touching the others.

// Find the instance ID of one occurrence of a recurring event by its start time.
async function getInstanceId(recurringEventId: string, startIso: string): Promise<string | null> {
  if (!isGoogleConfigured() || !recurringEventId) return null
  const token = await getAccessToken()
  const t = new Date(startIso).getTime()
  const timeMin = new Date(t - 60_000).toISOString()
  const timeMax = new Date(t + 60_000).toISOString()
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(recurringEventId)}/instances?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = await res.json()
  return json.items?.[0]?.id ?? null
}

// Cancel a single occurrence of a recurring event (leaves the rest intact).
export async function cancelRecurringInstance(recurringEventId: string, startIso: string): Promise<void> {
  if (!isGoogleConfigured() || !recurringEventId) return
  const instId = await getInstanceId(recurringEventId, startIso)
  if (instId) await deleteCalendarEvent(instId)
}

// Move a single occurrence of a recurring event to a new time.
export async function rescheduleRecurringInstance(
  recurringEventId: string, oldStartIso: string, newStartIso: string, newEndIso: string, timezone: string
): Promise<void> {
  if (!isGoogleConfigured() || !recurringEventId) return
  const instId = await getInstanceId(recurringEventId, oldStartIso)
  if (instId) await updateCalendarEventTime(instId, newStartIso, newEndIso, timezone)
}

// Format a Date as an RRULE UNTIL value (UTC basic format: YYYYMMDDTHHMMSSZ).
function rruleUntil(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

// Truncate a recurring series so occurrences from `fromIso` onward are removed
// (used for "this and future" cancellation). One API call; handles never-ending.
export async function truncateRecurringSeries(recurringEventId: string, fromIso: string): Promise<void> {
  if (!isGoogleConfigured() || !recurringEventId) return
  const token = await getAccessToken()
  const calBase = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`
  // Read current recurrence rules
  const getRes = await fetch(`${calBase}/${encodeURIComponent(recurringEventId)}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!getRes.ok) return
  const ev = await getRes.json()
  const rules: string[] = ev.recurrence ?? []
  if (!rules.some(r => r.startsWith('RRULE'))) return
  const until = rruleUntil(new Date(new Date(fromIso).getTime() - 1000))   // 1s before the cut occurrence
  const newRules = rules.map(r => {
    if (!r.startsWith('RRULE')) return r
    const parts = r.replace(/^RRULE:/, '').split(';').filter(p => p && !/^UNTIL=/i.test(p) && !/^COUNT=/i.test(p))
    parts.push(`UNTIL=${until}`)
    return `RRULE:${parts.join(';')}`
  })
  await fetch(`${calBase}/${encodeURIComponent(recurringEventId)}?sendUpdates=all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recurrence: newRules }),
  })
}

export interface FetchedEvent {
  exists:    boolean
  cancelled: boolean
  startIso?: string
  endIso?:   string
}

// Reads the current state of a Google Calendar event (for inbound sync).
// Returns cancelled=true if the event was deleted or cancelled in Google.
export async function getCalendarEvent(eventId: string): Promise<FetchedEvent | null> {
  if (!isGoogleConfigured() || !eventId) return null
  const token = await getAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 404 || res.status === 410) return { exists: false, cancelled: true }
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Google fetch event failed')
  if (json.status === 'cancelled') return { exists: true, cancelled: true }
  return {
    exists:    true,
    cancelled: false,
    startIso:  json.start?.dateTime ?? undefined,
    endIso:    json.end?.dateTime ?? undefined,
  }
}

// Moves a Google Calendar event to a new time and notifies attendees.
// Throws on real failures so the caller can surface them.
export async function updateCalendarEventTime(
  eventId: string, startIso: string, endIso: string, timezone: string
): Promise<void> {
  if (!isGoogleConfigured() || !eventId) return
  const token = await getAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { dateTime: startIso, timeZone: timezone },
        end:   { dateTime: endIso,   timeZone: timezone },
      }),
    }
  )
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? `Google reschedule failed (HTTP ${res.status})`)
  }
}

// Applies Meet settings (open access, auto-record) to an existing Meet link.
// Best-effort: each setting is patched separately so one failing (e.g. an
// unsupported plan) doesn't block the other. Returns what was applied.
export async function configureMeetSpace(
  meetLink: string,
  opts: { openAccess?: boolean; autoRecord?: boolean }
): Promise<{ openAccess: boolean; autoRecord: boolean; error?: string }> {
  const applied = { openAccess: false, autoRecord: false, error: undefined as string | undefined }
  if (!isGoogleConfigured() || !meetLink) return applied

  const code = meetLink.split('/').filter(Boolean).pop()
  if (!code) return applied

  let token: string
  try { token = await getAccessToken(SCOPE_MEET) }
  catch (e: any) { applied.error = `Meet auth failed: ${e?.message}`; return applied }

  // Resolve the canonical space resource name from the meeting code
  let spaceName: string
  try {
    const getRes = await fetch(`https://meet.googleapis.com/v2/spaces/${code}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const space = await getRes.json()
    if (!getRes.ok) { applied.error = space?.error?.message ?? `space lookup ${getRes.status}`; return applied }
    spaceName = space.name   // "spaces/xxxx"
  } catch (e: any) { applied.error = e?.message; return applied }

  async function patch(config: any, mask: string): Promise<boolean> {
    const res = await fetch(`https://meet.googleapis.com/v2/${spaceName}?updateMask=${encodeURIComponent(mask)}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ config }),
    })
    return res.ok
  }

  if (opts.openAccess) {
    try { applied.openAccess = await patch({ accessType: 'OPEN' }, 'config.accessType') }
    catch { /* ignore */ }
  }
  if (opts.autoRecord) {
    try {
      applied.autoRecord = await patch(
        { artifactConfig: { recordingConfig: { autoRecordingGeneration: 'ON' } } },
        'config.artifactConfig.recordingConfig.autoRecordingGeneration'
      )
    } catch { /* ignore */ }
  }

  return applied
}

// Cancels/deletes a Google Calendar event and notifies attendees.
// Returns whether the event is gone (a 404/410 means it was already deleted,
// which we treat as success). Throws on real failures so callers can surface them.
export async function deleteCalendarEvent(eventId: string): Promise<{ ok: boolean; alreadyGone?: boolean }> {
  if (!isGoogleConfigured() || !eventId) return { ok: false }
  const token = await getAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.ok) return { ok: true }
  if (res.status === 404 || res.status === 410) return { ok: true, alreadyGone: true }  // already deleted in Google
  const body = await res.json().catch(() => ({}))
  throw new Error(body?.error?.message ?? `Google delete failed (HTTP ${res.status})`)
}
