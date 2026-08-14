// lib/meta/capi.ts
// Meta Conversions API sender. Hashes PII (SHA256), builds the event payload per
// Meta's spec, and POSTs to the dataset's /events endpoint. Token comes from the
// META_CONVERSIONS_TOKEN env var (never hardcoded).
import crypto from 'crypto'
import { toIso2 } from './countries'

const GRAPH = 'https://graph.facebook.com'
const API_VERSION = 'v25.0'
const DATASET_ID = '1080439971325299'
const LEAD_SOURCE = 'Learn Arabic CRM'

function sha256(v: string): string { return crypto.createHash('sha256').update(v).digest('hex') }
function normEmail(e: string): string { return e.trim().toLowerCase() }
function normPhone(p: string): string { let d = (p || '').replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); return d }
function normName(n: string): string { return (n || '').trim().toLowerCase().replace(/\s+/g, ' ') }

export type CapiEvent = {
  event_name: string        // 'StartTrial' | 'Purchase' | 'Renewal'
  event_time: number        // unix seconds
  event_id: string          // deterministic, for dedup
  email?: string | null
  phone?: string | null
  first_name?: string | null
  last_name?: string | null
  country?: string | null      // full country name; converted to ISO2 here
  external_id?: string | null  // our student UUID (hashed before sending)
  value?: number | null
  currency?: string | null
}

function buildUserData(e: CapiEvent) {
  const ud: Record<string, string[]> = {}
  if (e.email) ud.em = [sha256(normEmail(e.email))]
  const ph = e.phone ? normPhone(e.phone) : ''
  if (ph) ud.ph = [sha256(ph)]
  const fn = e.first_name ? normName(e.first_name) : ''
  const ln = e.last_name ? normName(e.last_name) : ''
  if (fn) ud.fn = [sha256(fn)]
  if (ln) ud.ln = [sha256(ln)]
  // Country: Meta requires lowercase ISO-3166-1 alpha-2, hashed. Names we can't
  // map (e.g. the selectable "Other") are omitted rather than sent wrong.
  const cc = toIso2(e.country)
  if (cc) ud.country = [sha256(cc)]
  // Stable pseudonymous id — hashed, so no raw identifier leaves our system.
  if (e.external_id) ud.external_id = [sha256(String(e.external_id))]
  return ud
}

function buildEvent(e: CapiEvent) {
  const custom: Record<string, any> = { event_source: 'crm', lead_event_source: LEAD_SOURCE }
  if (e.value != null && !Number.isNaN(Number(e.value))) custom.value = Number(e.value)
  if (e.currency) custom.currency = e.currency
  return {
    action_source: 'system_generated',
    event_name: e.event_name,
    event_time: e.event_time,
    event_id: e.event_id,
    custom_data: custom,
    user_data: buildUserData(e),
  }
}

// Fire-and-forget audit trail. A logging failure must NEVER affect a send, so
// every call is fully wrapped: errors are logged to the console and swallowed.
async function logSend(rows: Record<string, any>[]): Promise<void> {
  if (!rows.length) return
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    await createAdminClient().from('meta_send_log').insert(rows)
  } catch (e: any) {
    console.error('[MetaLog] write failed (send unaffected):', e?.message)
  }
}

// Shared row shape — never includes the token or unhashed PII.
function logRow(e: CapiEvent, outcome: string, extra: Record<string, any> = {}) {
  return {
    event_name:  e.event_name,
    entity_id:   e.external_id ?? null,
    event_id:    e.event_id,
    event_time:  new Date(e.event_time * 1000).toISOString(),
    outcome,
    has_country: !!toIso2(e.country),
    ...extra,
  }
}

export async function sendCapiEvents(
  events: CapiEvent[], opts?: { testEventCode?: string }
): Promise<{ ok: boolean; sent: number; skippedOld?: number; error?: string; response?: any }> {
  const token = (process.env.META_CONVERSIONS_TOKEN ?? '').trim()
  if (!token) return { ok: false, sent: 0, error: 'META_CONVERSIONS_TOKEN is not set (add it in Vercel).' }
  if (events.length === 0) return { ok: true, sent: 0 }

  // Only events with at least one match key…
  const usable = events.filter(e => e.email || (e.phone && normPhone(e.phone)))
  // …and within Meta's accepted window. The Conversions API HARD-limits event_time
  // to the last 7 days (the 90-day "historical" allowance is only for Meta's manual
  // Import-events upload, not this API). Override via META_CAPI_MAX_AGE_DAYS.
  const maxAgeDays = Number(process.env.META_CAPI_MAX_AGE_DAYS) || 7
  const now = Math.floor(Date.now() / 1000)
  const minTime = now - maxAgeDays * 24 * 3600 + 120
  const fresh = usable
    .filter(e => e.event_time >= minTime && e.event_time <= now + 120)
    .sort((a, b) => b.event_time - a.event_time)   // newest first — protects recent events if an old batch is rejected
  const skippedOld = usable.length - fresh.length
  const isTest = !!opts?.testEventCode

  // Record what we're dropping instead of discarding it silently.
  const freshSet = new Set(fresh)
  const droppedOld = usable.filter(e => !freshSet.has(e))
  const noMatchKey = events.filter(e => !usable.includes(e))
  await logSend([
    ...droppedOld.map(e => logRow(e, 'skipped_too_old', { test_event: isTest })),
    ...noMatchKey.map(e => logRow(e, 'skipped_no_match_key', { test_event: isTest })),
  ])

  if (fresh.length === 0) return { ok: true, sent: 0, skippedOld }

  const url = `${GRAPH}/${API_VERSION}/${DATASET_ID}/events?access_token=${encodeURIComponent(token)}`
  let sent = 0
  try {
    // Meta caps ~1000 events per request — send in batches.
    for (let i = 0; i < fresh.length; i += 1000) {
      const batch = fresh.slice(i, i + 1000)
      const body: Record<string, any> = { data: batch.map(buildEvent) }
      if (opts?.testEventCode) body.test_event_code = opts.testEventCode
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const err = json?.error
        const msg = err?.error_user_msg ?? err?.message ?? `HTTP ${res.status}`
        await logSend(batch.map(e => logRow(e, 'failed', {
          http_status: res.status, response: json, error: msg,
          batch_size: batch.length, test_event: isTest,
        })))
        return { ok: false, sent, skippedOld, error: msg, response: json }
      }
      await logSend(batch.map(e => logRow(e, 'sent', {
        http_status: res.status, response: json,
        batch_size: batch.length, test_event: isTest,
      })))
      sent += batch.length
    }
    return { ok: true, sent, skippedOld }
  } catch (err: any) {
    const msg = err?.message ?? 'Network error'
    await logSend(fresh.map(ev => logRow(ev, 'failed', { error: msg, test_event: isTest })))
    return { ok: false, sent, skippedOld, error: msg }
  }
}
