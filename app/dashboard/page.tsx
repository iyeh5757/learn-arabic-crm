import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

  redirect(ROLE_HOME[profile?.role ?? ''] ?? '/login')
}
