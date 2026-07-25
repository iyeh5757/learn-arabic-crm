// lib/meta/capi.ts
// Meta Conversions API sender. Hashes PII (SHA256), builds the event payload per
// Meta's spec, and POSTs to the dataset's /events endpoint. Token comes from the
// META_CONVERSIONS_TOKEN env var (never hardcoded).
import crypto from 'crypto'

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

export async function sendCapiEvents(
  events: CapiEvent[], opts?: { testEventCode?: string }
): Promise<{ ok: boolean; sent: number; error?: string; response?: any }> {
  const token = (process.env.META_CONVERSIONS_TOKEN ?? '').trim()
  if (!token) return { ok: false, sent: 0, error: 'META_CONVERSIONS_TOKEN is not set (add it in Vercel).' }
  if (events.length === 0) return { ok: true, sent: 0 }

  // Only include events that have at least one match key
  const usable = events.filter(e => e.email || (e.phone && normPhone(e.phone)))
  if (usable.length === 0) return { ok: true, sent: 0 }

  const body: Record<string, any> = { data: usable.map(buildEvent) }
  if (opts?.testEventCode) body.test_event_code = opts.testEventCode

  try {
    const res = await fetch(`${GRAPH}/${API_VERSION}/${DATASET_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) return { ok: false, sent: 0, error: json?.error?.message ?? `HTTP ${res.status}`, response: json }
    return { ok: true, sent: usable.length, response: json }
  } catch (e: any) {
    return { ok: false, sent: 0, error: e?.message ?? 'Network error' }
  }
}
