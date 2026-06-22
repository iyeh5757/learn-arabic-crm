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

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss:   SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/calendar',
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

// Cancels/deletes a Google Calendar event and notifies attendees.
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  if (!isGoogleConfigured() || !eventId) return
  const token = await getAccessToken()
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${eventId}?sendUpdates=all`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
}
