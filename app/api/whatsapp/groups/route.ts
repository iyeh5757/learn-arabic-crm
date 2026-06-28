// app/api/whatsapp/groups/route.ts
// Returns all WhatsApp groups visible to the Evolution API instance.
// Used by the admin to look up and assign group JIDs to students.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function clean(v?: string): string { return (v ?? '').replace(/[^\x20-\x7E]/g, '').trim() }
function withScheme(url: string): string {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : 'https://' + url
}

const API_URL  = withScheme(clean(process.env.EVOLUTION_API_URL)).replace(/\/+$/, '')
const API_KEY  = clean(process.env.EVOLUTION_API_KEY)
const INSTANCE = clean(process.env.EVOLUTION_INSTANCE)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!API_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json({ error: 'WhatsApp credentials not configured' }, { status: 400 })
  }

  // We only need group names + IDs, never the member lists. Fetching
  // participants makes WhatsApp throttle ("rate-overlimit"), so request
  // getParticipants=false. Some Evolution builds 500 on false, so fall back
  // to true once if needed.
  async function fetchGroups(getParticipants: boolean) {
    const res = await fetch(
      `${API_URL}/group/fetchAllGroups/${INSTANCE}?getParticipants=${getParticipants}`,
      { headers: { apikey: API_KEY } }
    )
    const raw = await res.text()
    let json: any = null
    try { json = JSON.parse(raw) } catch { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, raw, json }
  }

  function extractError(r: { status: number; raw: string; json: any }): string {
    const detail = r.json?.response?.message ?? r.json?.message ?? r.json?.error
    const msg = (Array.isArray(detail) ? detail.join('; ') : detail)
      ?? (r.raw ? r.raw.slice(0, 300) : `HTTP ${r.status}`)
    if (typeof msg === 'string' && /rate.?overlimit|rate.?limit|429/i.test(msg)) {
      return 'WhatsApp is rate-limiting group lookups right now. Please wait ~1 minute and try again.'
    }
    return typeof msg === 'string' ? msg : JSON.stringify(msg)
  }

  try {
    let r = await fetchGroups(false)
    if (!r.ok && r.status >= 500) r = await fetchGroups(true)   // fallback for builds that 500 on false
    if (!r.ok) return NextResponse.json({ error: extractError(r), status: r.status }, { status: 400 })

    const list = Array.isArray(r.json) ? r.json : (r.json?.groups ?? r.json?.data ?? [])
    const groups = list
      .map((g: any) => ({ id: g.id ?? g.jid ?? '', name: g.subject ?? g.name ?? '' }))
      .filter((g: any) => g.id.endsWith('@g.us'))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    return NextResponse.json(groups)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Network error' }, { status: 500 })
  }
}
