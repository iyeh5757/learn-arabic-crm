// app/api/whatsapp/setup-webhook/route.ts
// One-click: point the Evolution instance's webhook at THIS app so incoming
// WhatsApp messages flow into the shared inbox. Admin only.
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function clean(v?: string): string { return (v ?? '').replace(/[^\x20-\x7E]/g, '').trim() }
function withScheme(url: string): string { return !url ? '' : /^https?:\/\//i.test(url) ? url : 'https://' + url }

const API_URL  = withScheme(clean(process.env.EVOLUTION_API_URL)).replace(/\/+$/, '')
const API_KEY  = clean(process.env.EVOLUTION_API_KEY)
const INSTANCE = clean(process.env.EVOLUTION_INSTANCE)
const TOKEN    = clean(process.env.WHATSAPP_WEBHOOK_TOKEN)

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  if (!API_URL || !API_KEY || !INSTANCE) {
    return NextResponse.json({ error: 'Evolution credentials are not configured.' }, { status: 400 })
  }

  // Build this app's public webhook URL from the incoming request
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const webhookUrl = `${proto}://${host}/api/whatsapp/webhook${TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : ''}`

  const events = ['MESSAGES_UPSERT']

  // Evolution's webhook payload shape varies by version — try the nested form
  // first (newer), then the flat form (older).
  const variants = [
    { webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: false, events } },
    { url: webhookUrl, webhook_by_events: false, webhook_base64: false, events },
  ]

  let lastErr = ''
  for (const body of variants) {
    try {
      const res = await fetch(`${API_URL}/webhook/set/${INSTANCE}`, {
        method: 'POST',
        headers: { apikey: API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const raw = await res.text()
      if (res.ok) {
        return NextResponse.json({ ok: true, webhookUrl, tokenProtected: !!TOKEN })
      }
      let j: any = null; try { j = JSON.parse(raw) } catch {}
      lastErr = j?.response?.message ?? j?.message ?? j?.error ?? raw.slice(0, 200) ?? `HTTP ${res.status}`
      if (Array.isArray(lastErr)) lastErr = lastErr.join('; ')
    } catch (e: any) { lastErr = e?.message ?? 'Network error' }
  }

  return NextResponse.json({ error: `Could not set webhook: ${lastErr}`, webhookUrl }, { status: 400 })
}
