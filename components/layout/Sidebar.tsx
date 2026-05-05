'use client'
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CreditCard,
  BarChart3, LogOut, ChevronRight, UserCheck, TrendingUp,
  Upload, Inbox, Bell
} from 'lucide-react'

const NAV: Record<string, { label: string; href: string; icon: any; sub?: boolean }[]> = {
  admin: [
    { label: 'Dashboard',      href: '/admin',                icon: LayoutDashboard },
    { label: 'Students',       href: '/admin/students',       icon: UserCheck },
    { label: 'Sessions',       href: '/admin/sessions',       icon: BookOpen },
    { label: 'Payments',       href: '/admin/payments',       icon: CreditCard },
    { label: 'Teachers',       href: '/admin/teachers',       icon: GraduationCap },
    { label: 'Users',          href: '/admin/users',          icon: Users },
    { label: 'Reminders',      href: '/admin/reminders',      icon: Bell },
    { label: 'Reports',        href: '/admin/reports',        icon: BarChart3 },
    { label: 'Upload Leads',   href: '/admin/leads/upload',   icon: Upload, sub: true },
    { label: 'Leads Pipeline', href: '/admin/leads',          icon: Inbox, sub: true },
  ],
  teacher: [
    { label: 'Dashboard',   href: '/teacher',          icon: LayoutDashboard },
    { label: 'My Students', href: '/teacher/students', icon: UserCheck },
    { label: 'Sessions',    href: '/teacher/sessions', icon: BookOpen },
  ],
  supervisor: [
    { label: 'Dashboard', href: '/supervisor',          icon: LayoutDashboard },
    { label: 'Teachers',  href: '/supervisor/teachers', icon: GraduationCap },
    { label: 'Sessions',  href: '/supervisor/sessions', icon: BookOpen },
    { label: 'Trials',    href: '/supervisor/trials',   icon: TrendingUp },
  ],
  sales: [
    { label: 'Dashboard',   href: '/sales',             icon: LayoutDashboard },
    { label: 'Students',    href: '/sales/students',    icon: UserCheck },
    { label: 'Payments',    href: '/sales/payments',    icon: CreditCard },
    { label: 'Commissions', href: '/sales/commissions', icon: TrendingUp },
    { label: 'My Leads',    href: '/sales/leads',       icon: Inbox, sub: true },
  ],
  accountant: [
    { label: 'Dashboard', href: '/accountant',           icon: LayoutDashboard },
    { label: 'Renewals',  href: '/accountant/renewals',  icon: TrendingUp },
    { label: 'Payments',  href: '/accountant/payments',  icon: CreditCard },
    { label: 'Students',  href: '/accountant/students',  icon: UserCheck },
    { label: 'Reminders', href: '/accountant/reminders', icon: Bell },
  ],
}

const ROLE_COLORS: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-800',
  teacher:    'bg-blue-100 text-blue-800',
  supervisor: 'bg-orange-100 text-orange-800',
  sales:      'bg-green-100 text-green-800',
  accountant: 'bg-red-100 text-red-800',
}

export default function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = NAV[profile.role] ?? []

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Find index of first sub item to render divider before it
  const firstSubIndex = nav.findIndex(i => i.sub)

  return (
    <aside className="w-64 flex flex-col bg-[#0D1B2A] text-white shrink-0">
      {/* Logo */}
      <div className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl text-[#C9A84C]" style={{ fontFamily: 'serif' }}>تعلم</span>
          <div>
            <p className="font-bold text-sm text-white leading-tight">Learn Arabic</p>
            <p className="text-xs text-gray-400">CRM System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {nav.map((item, i) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== `/${profile.role}` && pathname.startsWith(item.href))

          return (
            <div key={item.href}>
              {/* Divider before first leads item */}
              {i === firstSubIndex && (
                <div style={{ padding: '10px 8px 4px', fontSize: '10px', fontWeight: '700', color: 'rgba(201,168,76,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Leads
                </div>
              )}
              <Link href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: item.sub ? '7px 10px' : '8px 10px',
                  borderRadius: '8px', fontSize: item.sub ? '12px' : '13px',
                  fontWeight: '500', textDecoration: 'none', transition: 'all 0.15s',
                  background: active ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color: active ? '#E8C97A' : item.sub ? 'rgba(156,163,175,0.9)' : '#9CA3AF',
                }}>
                <Icon size={item.sub ? 14 : 16} style={{ color: active ? '#C9A84C' : item.sub ? 'rgba(107,114,128,0.9)' : '#6B7280', flexShrink: 0 }} />
                {item.label}
                {active && <ChevronRight size={12} style={{ marginLeft: 'auto', color: '#C9A84C' }} />}
              </Link>
            </div>
          )
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] font-bold text-xs shrink-0">
            {profile.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{profile.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded capitalize font-medium ${ROLE_COLORS[profile.role]}`}>{profile.role}</span>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-xs transition-all">
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
