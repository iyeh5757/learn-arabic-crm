// app/api/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://learn-arabic-crm-git-main-iyeh5757s-projects.vercel.app' : 'http://localhost:3000'))
}
