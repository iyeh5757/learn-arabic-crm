// app/(dashboard)/admin/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {profile?.name ?? 'Admin'} 👋
        </h1>
        <p className="text-gray-500 mt-1">Role: {profile?.role}</p>
        <p className="text-green-600 font-semibold mt-4">
          ✅ CRM is working! Dashboard loading successfully.
        </p>
      </div>
    </div>
  )
}
