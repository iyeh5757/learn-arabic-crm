// app/api/users/route.ts
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })

    const body = await req.json()
    const { name, email, password, role, rate_per_session_usd, languages, specialties, commission_amount, commission_currency, supervisor_id } = body

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = getAdminClient()

    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

    const userId = authData.user.id

    await admin.from('profiles').upsert({ id: userId, name, email, role, is_active: true })

    if (role === 'teacher') {
      await admin.from('teachers').insert({
        user_id: userId,
        rate_per_session_usd: Number(rate_per_session_usd) || 0,
        languages: languages || [],
        specialties: specialties || [],
        supervisor_id: supervisor_id || null,
      })
    }

    if (role === 'sales' && commission_amount) {
      await admin.from('sales_config').upsert({
        sales_user_id: userId,
        commission_amount: Number(commission_amount),
        commission_currency: commission_currency || 'USD',
      })
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unexpected error' }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  return NextResponse.json(profiles)
}
