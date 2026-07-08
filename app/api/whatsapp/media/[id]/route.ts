// app/api/whatsapp/media/[id]/route.ts
// Serves a media message's file. On first view it downloads the file from
// Evolution, caches it in the wa-media bucket, and redirects to the public URL.
// Later views redirect straight to the cached file.
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMediaBase64FromEvolution } from '@/lib/notifications/whatsapp'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/amr': 'amr',
  'video/mp4': 'mp4', 'application/pdf': 'pdf',
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'supervisor', 'sales'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: msg } = await admin.from('wa_messages').select('id, media_url, media_type, raw').eq('id', params.id).single()
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (msg.media_url) return NextResponse.redirect(msg.media_url)

  const media = await getMediaBase64FromEvolution(msg.raw)
  if (!media) return NextResponse.json({ error: 'Media unavailable' }, { status: 502 })

  const ext = EXT[media.mimetype] ?? 'bin'
  const path = `${params.id}.${ext}`
  const up = await admin.storage.from('wa-media').upload(path, media.buffer, { contentType: media.mimetype, upsert: true })
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 })

  const publicUrl = admin.storage.from('wa-media').getPublicUrl(path).data.publicUrl
  await admin.from('wa_messages').update({ media_url: publicUrl }).eq('id', params.id)
  return NextResponse.redirect(publicUrl)
}
