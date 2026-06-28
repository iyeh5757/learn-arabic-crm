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
    const res = await fetch(
      `${API_URL}/group/fetchAllGroups/${INSTANCE}?getParticipants=false`,
      { headers: { apikey: API_KEY } }
    )
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ error: json?.message ?? `HTTP ${res.status}` }, { status: 400 })

    const groups = (Array.isArray(json) ? json : [])
      .map((g: any) => ({ id: g.id ?? '', name: g.subject ?? g.name ?? g.id ?? '' }))
      .filter((g: any) => g.id.endsWith('@g.us'))   // groups only
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    return NextResponse.json(groups)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Network error' }, { status: 500 })
  }
}
