import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin',
  teacher: '/teacher',
  supervisor: '/supervisor',
  sales: '/sales',
  accountant: '/accountant',
}

export default async function DashboardRedirect() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const role = profile?.role ?? ''
  const home = ROLE_HOME[role] ?? '/login'

  // Store role in a cookie so middleware can enforce route-level access
  cookies().set('user-role', role, { path: '/', httpOnly: false, sameSite: 'lax' })

  redirect(home)
}
