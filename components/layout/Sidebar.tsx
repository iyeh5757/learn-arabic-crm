'use client'
// components/layout/Sidebar.tsx
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, CreditCard,
  BarChart3, LogOut, UserCheck, TrendingUp, Bell
} from 'lucide-react'

// Using only confirmed-working icons, leads use text emoji
const NAV: Record<string, { label: string; href: string; icon: any; isLead?: boolean }[]> = {
  admin: [
    { label: 'Dashboard',      href: '/admin',              icon: LayoutDashboard },
    { label: 'Students',       href: '/admin/students',     icon: UserCheck },
    { label: 'Sessions',       href: '/admin/sessions',     icon: BookOpen },
    { label: 'Payments',       href: '/admin/payments',     icon: CreditCard },
    { label: 'Teachers',       href: '/admin/teachers',     icon: GraduationCap },
    { label: 'Users',          href: '/admin/users',        icon: Users },
    { label: 'Reminders',      href: '/admin/reminders',    icon: Bell },
    { label: 'Reports',        href: '/admin/reports',      icon: BarChart3 },
    { label: 'Analytics',      href: '/admin/analytics',    icon: TrendingUp },
    { label: '📤 Upload Leads',  href: '/admin/leads/upload', icon: null, isLead: true },
    { label: '📋 Leads Pipeline',href: '/admin/leads',        icon: null, isLead: true },
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
    { label: '📋 My Leads',  href: '/sales/leads',       icon: null, isLead: true },
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
  const regularNav = nav.filter(i => !i.isLead)
  const leadsNav = nav.filter(i => i.isLead)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const renderItem = (item: any) => {
    const Icon = item.icon
    const active = pathname === item.href || (
      item.href !== `/${profile.role}` && pathname.startsWith(item.href)
    )
    return (
      <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 10px', borderRadius: '7px', marginBottom: '1px',
          background: active ? 'rgba(201,168,76,0.2)' : 'transparent',
          color: active ? '#E8C97A' : '#9CA3AF',
          fontSize: '13px', fontWeight: active ? '600' : '400',
          transition: 'all 0.15s',
        }}>
          {Icon && <Icon size={15} style={{ color: active ? '#C9A84C' : '#6B7280', flexShrink: 0 }} />}
          {item.label}
        </div>
      </Link>
    )
  }

  return (
    <aside style={{
      width: '220px', display: 'flex', flexDirection: 'column',
      background: '#0D1B2A', color: '#fff', flexShrink: 0,
      height: '100vh', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '14px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px', color: '#C9A84C', fontFamily: 'serif' }}>تعلم</span>
          <div>
            <p style={{ fontWeight: '700', fontSize: '13px', color: '#fff', margin: 0, lineHeight: 1.2 }}>Learn Arabic</p>
            <p style={{ fontSize: '10px', color: '#9CA3AF', margin: 0 }}>CRM System</p>
          </div>
        </div>
      </div>

      {/* Regular Nav */}
      <nav style={{ padding: '6px 8px', flex: 1, overflowY: 'auto' }}>
        {regularNav.map(renderItem)}
      </nav>

      {/* Leads Section — always visible, pinned above user info */}
      {leadsNav.length > 0 && (
        <div style={{ padding: '0 8px 6px', marginTop: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '6px 10px 4px', fontSize: '10px', fontWeight: '700', color: 'rgba(201,168,76,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Leads
          </div>
          <div style={{ borderTop: '1px solid rgba(201,168,76,0.2)', paddingTop: '6px' }}>
            {leadsNav.map(renderItem)}
          </div>
        </div>
      )}

      {/* User info */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C', fontWeight: '700', fontSize: '11px', flexShrink: 0 }}>
            {profile.name[0].toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded capitalize font-medium ${ROLE_COLORS[profile.role]}`}>{profile.role}</span>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '5px 8px', color: '#6B7280', background: 'transparent', border: 'none', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>
          <LogOut size={12} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
