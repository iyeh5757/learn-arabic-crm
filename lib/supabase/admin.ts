// lib/supabase/admin.ts
// Service-role Supabase client for trusted server-side jobs (cron) that run
// without a logged-in user and therefore can't satisfy RLS via current_user_role().
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
