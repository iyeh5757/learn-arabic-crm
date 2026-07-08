// app/api/whatsapp/groups/create/route.ts
// Create a WhatsApp group via Evolution (the business number becomes admin).
// Optionally link the new group to a student so reminders go there.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function clean(v?: string): string { return (v ?? '').replace(/[^\x20-\x7E]/g, '').trim() }
function withScheme(url: string): string { return !url ? '' : /^https?:\/\//i.test(url) ? url : 'https://' + url }
function digits(p: string): string { let d = p.replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); return d }

const API_URL  = withScheme(clean(process.env.EVOLUTION_API_URL)).replace(/\/+$/, '')
const API_KEY  = clean(process.env.EVOLUTION_API_KEY)
const INSTANCE = clean(process.env.EVOLUTION_INSTANCE)

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'supervisor', 'sales'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  if (!API_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 })
  }

  const { subject, participants, student_id } = await req.json()
  const nums = (Array.isArray(participants) ? participants : []).map((p: string) => digits(String(p))).filter(Boolean)
  if (!subject?.trim() || nums.length === 0) {
    return NextResponse.json({ error: 'A group name and at least one participant number are required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${API_URL}/group/create/${INSTANCE}`, {
      method: 'POST',
      headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), participants: nums }),
    })
    const raw = await res.text()
    let j: any = null; try { j = JSON.parse(raw) } catch {}
    if (!res.ok) {
      const detail = j?.response?.message ?? j?.message ?? j?.error ?? raw.slice(0, 200)
      return NextResponse.json({ error: Array.isArray(detail) ? detail.join('; ') : (detail || `HTTP ${res.status}`) }, { status: 400 })
    }

    // Extract the new group JID across possible response shapes
    const jid: string | undefined = j?.id ?? j?.groupJid ?? j?.gid ?? j?.key?.remoteJid ?? j?.group?.id
    if (!jid) return NextResponse.json({ error: 'Group created but no group ID returned', raw: j }, { status: 200 })

    if (student_id) {
      await supabase.from('students').update({ whatsapp_group_id: jid }).eq('id', student_id)
    }
    return NextResponse.json({ ok: true, jid })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Network error' }, { status: 500 })
  }
}
