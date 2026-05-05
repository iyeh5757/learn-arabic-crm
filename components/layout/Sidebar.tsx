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

const NAV: Record<string, { label: string; icon: any; href: string; section?: string }[]> = {
  admin: [
    { label: 'Dashboard',      icon: LayoutDashboard, href: '/admin' },
    { label: 'Users',          icon: Users,           href: '/admin/users' },
    { label: 'Teachers',       icon: GraduationCap,   href: '/admin/teachers' },
    { label: 'Students',       icon: UserCheck,       href: '/admin/students' },
    { label: 'Sessions',       icon: BookOpen,        href: '/admin/sessions' },
    { label: 'Payments',       icon: CreditCard,      href: '/admin/payments' },
    { label: 'Reminders',      icon: Bell,            href: '/admin/reminders' },
    { label: 'Reports',        icon: BarChart3,       href: '/admin/reports' },
    { label: '── Leads ──',    icon: Inbox,           href: '#', section: 'divider' },
    { label: 'Upload Leads',   icon: Upload,          href: '/admin/leads/upload' },
    { label: 'Leads Pipeline', icon: Inbox,           href: '/admin/leads' },
  ],
  teacher: [
    { label: 'Dashboard',   icon: LayoutDashboard, href: '/teacher' },
    { label: 'My Students', icon: UserCheck,        href: '/teacher/students' },
    { label: 'Sessions',    icon: BookOpen,         href: '/teacher/sessions' },
  ],
  supervisor: [
    { label: 'Dashboard',   icon: LayoutDashboard, href: '/supervisor' },
    { label: 'Teachers',    icon: GraduationCap,   href: '/supervisor/teachers' },
    { label: 'Sessions',    icon: BookOpen,        href: '/supervisor/sessions' },
    { label: 'Trials',      icon: TrendingUp,      href: '/supervisor/trials' },
  ],
  sales: [
    { label: 'Dashboard',    icon: LayoutDashboard, href: '/sales' },
    { label: 'Students',     icon: UserCheck,       href: '/sales/students' },
    { label: 'Payments',     icon: CreditCard,      href: '/sales/payments' },
    { label: 'Commissions',  icon: TrendingUp,      href: '/sales/commissions' },
    { label: '── Leads ──',  icon: Inbox,           href: '#', section: 'divider' },
    { label: 'My Leads',     icon: Inbox,           href: '/sales/leads' },
  ],
  accountant: [
    { label: 'Dashboard',  icon: LayoutDashboard, href: '/accountant' },
    { label: 'Renewals',   icon: TrendingUp,      href: '/accountant/renewals' },
    { label: 'Payments',   icon: CreditCard,      href: '/accountant/payments' },
    { label: 'Students',   icon: UserCheck,       href: '/accountant/students' },
    { label: 'Reminders',  icon: Bell,            href: '/accountant/reminders' },
  ],
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  teacher: 'bg-blue-100 text-blue-800',
  supervisor: 'bg-orange-100 text-orange-800',
  sales: 'bg-green-100 text-green-800',
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

  return (
    <aside className="w-64 flex flex-col bg-[#0D1B2A] text-white shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl text-[#C9A84C]" style={{ fontFamily: 'serif' }}>تعلم</span>
          <div>
            <p className="font-bold text-sm text-white leading-tight">Learn Arabic</p>
            <p className="text-xs text-gray-400">CRM System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item, i) => {
          // Divider
          if (item.section === 'divider') {
            return (
              <div key={i} style={{ padding: '12px 8px 6px', fontSize: '10px', fontWeight: '700', color: 'rgba(201,168,76,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Leads Pipeline
              </div>
            )
          }
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== `/${profile.role}` && item.href !== '#' && pathname.startsWith(item.href))
          return (
            <Link key={item.href + i} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                ${active ? 'bg-[#C9A84C]/20 text-[#E8C97A]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={17} className={active ? 'text-[#C9A84C]' : 'text-gray-500 group-hover:text-gray-300'} />
              {item.label}
              {active && <ChevronRight size={14} className="ml-auto text-[#C9A84C]" />}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center text-[#C9A84C] font-bold text-sm shrink-0">
            {profile.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
            <span className={`badge ${ROLE_COLORS[profile.role]} text-xs capitalize`}>{profile.role}</span>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-all">
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}