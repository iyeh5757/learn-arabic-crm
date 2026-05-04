// app/api/users/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Verify caller is admin
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - not logged in' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })
    }

    const body = await req.json()
    const { name, email, password, role, rate_per_session_usd, languages, specialties, commission_amount, commission_currency } = body

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields: name, email, password, role' }, { status: 400 })
    }

    // Use service role key directly for admin operations
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Create auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (authErr) {
      return NextResponse.json({ error: `Auth error: ${authErr.message}` }, { status: 400 })
    }

    const userId = authData.user.id

    // Upsert profile with correct role
    const { error: profileUpsertError } = await admin
      .from('profiles')
      .upsert({ id: userId, name, email, role, is_active: true })

    if (profileUpsertError) {
      return NextResponse.json({ error: `Profile error: ${profileUpsertError.message}` }, { status: 400 })
    }

    // Teacher setup
    if (role === 'teacher') {
      const { error: teacherErr } = await admin.from('teachers').insert({
        user_id: userId,
        rate_per_session_usd: Number(rate_per_session_usd) || 0,
        languages: languages || [],
        specialties: specialties || [],
      })
      if (teacherErr) {
        return NextResponse.json({ error: `Teacher setup error: ${teacherErr.message}` }, { status: 400 })
      }
    }

    // Sales commission
    if (role === 'sales' && commission_amount) {
      const { error: salesErr } = await admin.from('sales_config').upsert({
        sales_user_id: userId,
        commission_amount: Number(commission_amount),
        commission_currency: commission_currency || 'USD',
      })
      if (salesErr) {
        return NextResponse.json({ error: `Commission setup error: ${salesErr.message}` }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true, userId })

  } catch (err: any) {
    return NextResponse.json({ error: `Unexpected error: ${err.message}` }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  return NextResponse.json(profiles)
}
