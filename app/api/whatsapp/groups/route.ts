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

  try {
    // getParticipants is a required query param on Evolution v2
    const res = await fetch(
      `${API_URL}/group/fetchAllGroups/${INSTANCE}?getParticipants=true`,
      { headers: { apikey: API_KEY } }
    )
    const raw = await res.text()
    let json: any = null
    try { json = JSON.parse(raw) } catch { /* non-JSON body */ }
    if (!res.ok) {
      // Evolution nests the real reason in response.message (often an array)
      const detail = json?.response?.message ?? json?.message ?? json?.error
      const msg = (Array.isArray(detail) ? detail.join('; ') : detail)
        ?? (raw ? raw.slice(0, 300) : `HTTP ${res.status}`)
      return NextResponse.json({ error: msg, status: res.status }, { status: 400 })
    }

    const list = Array.isArray(json) ? json : (json?.groups ?? json?.data ?? [])
    const groups = list
      .map((g: any) => ({ id: g.id ?? g.jid ?? '', name: g.subject ?? g.name ?? '' }))
      .filter((g: any) => g.id.endsWith('@g.us'))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    return NextResponse.json(groups)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Network error' }, { status: 500 })
  }
}
