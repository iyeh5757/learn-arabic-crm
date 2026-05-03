// app/(dashboard)/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Simple sidebar for now */}
      <aside className="w-64 flex flex-col bg-[#0D1B2A] text-white shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-2xl text-[#C9A84C]">تعلم</span>
            <div>
              <p className="font-bold text-sm text-white">Learn Arabic</p>
              <p className="text-xs text-gray-400">CRM System</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <a href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white">
            Dashboard
          </a>
          <a href="/admin/users" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white">
            Users
          </a>
          <a href="/admin/students" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white">
            Students
          </a>
          <a href="/admin/sessions" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white">
            Sessions
          </a>
          <a href="/admin/payments" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-white">
            Payments
          </a>
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] font-bold text-sm">
              {profile.name[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{profile.name}</p>
              <span className="text-xs text-gray-400 capitalize">{profile.role}</span>
            </div>
          </div>
          <a href="/api/auth/signout" className="flex items-center gap-2 w-full px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm">
            Sign out
          </a>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
