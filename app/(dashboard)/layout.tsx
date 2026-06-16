// app/(dashboard)/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ReactNode } from 'react'

const NAV: Record<string, { label: string; href: string; emoji: string }[]> = {
  admin: [
    { label: 'Dashboard',      href: '/admin',              emoji: '📊' },
    { label: 'Students',       href: '/admin/students',     emoji: '👨‍🎓' },
    { label: 'Sessions',       href: '/admin/sessions',     emoji: '📅' },
    { label: 'Payments',       href: '/admin/payments',     emoji: '💳' },
    { label: 'Teachers',       href: '/admin/teachers',     emoji: '👩‍🏫' },
    { label: 'Users',          href: '/admin/users',        emoji: '👥' },
    { label: 'Reminders',      href: '/admin/reminders',    emoji: '🔔' },
    { label: 'Reports',        href: '/admin/reports',      emoji: '📈' },
    { label: 'Analytics',      href: '/admin/analytics',    emoji: '🤖' },
    { label: 'Upload Leads',   href: '/admin/leads/upload', emoji: '📤' },
    { label: 'Leads Pipeline', href: '/admin/leads',        emoji: '📋' },
  ],
  teacher: [
    { label: 'Dashboard',   href: '/teacher',          emoji: '📊' },
    { label: 'My Students', href: '/teacher/students', emoji: '👨‍🎓' },
    { label: 'Sessions',    href: '/teacher/sessions', emoji: '📅' },
  ],
  sales: [
    { label: 'Dashboard',   href: '/sales',             emoji: '📊' },
    { label: 'Students',    href: '/sales/students',    emoji: '👨‍🎓' },
    { label: 'Payments',    href: '/sales/payments',    emoji: '💳' },
    { label: 'Commissions', href: '/sales/commissions', emoji: '💰' },
    { label: 'My Leads',    href: '/sales/leads',       emoji: '📋' },
  ],
  accountant: [
    { label: 'Dashboard', href: '/accountant',           emoji: '📊' },
    { label: 'Renewals',  href: '/accountant/renewals',  emoji: '🔄' },
    { label: 'Payments',  href: '/accountant/payments',  emoji: '💳' },
    { label: 'Students',  href: '/accountant/students',  emoji: '👨‍🎓' },
    { label: 'Reminders', href: '/accountant/reminders', emoji: '🔔' },
  ],
  supervisor: [
    { label: 'Dashboard', href: '/supervisor',           emoji: '📊' },
    { label: 'Sessions',  href: '/supervisor/sessions',  emoji: '📅' },
    { label: 'Teachers',  href: '/supervisor/teachers',  emoji: '👩‍🏫' },
    { label: 'Trials',    href: '/supervisor/trials',    emoji: '🎯' },
    { label: 'Reminders', href: '/supervisor/reminders', emoji: '🔔' },
  ],
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role as string
  const links = NAV[role] ?? []

  // Separate leads links from regular links
  const regularLinks = links.filter(l => !l.href.includes('/leads'))
  const leadsLinks = links.filter(l => l.href.includes('/leads'))

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', background: '#0D1B2A', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontFamily: 'serif', fontSize: '22px', color: '#C9A84C', marginBottom: '2px' }}>تعلم</div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Learn Arabic</div>
          <div style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{role}</div>
        </div>

        {/* Regular Nav links */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          {regularLinks.map(link => (
            <Link key={link.href} href={link.href}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: '500', marginBottom: '2px', transition: 'all 0.15s' }}
              className="sidebar-link">
              <span>{link.emoji}</span>
              <span>{link.label}</span>
            </Link>
          ))}

          {/* Leads section */}
          {leadsLinks.length > 0 && (
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(201,168,76,0.2)', paddingTop: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(201,168,76,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 12px 6px' }}>
                Leads
              </div>
              {leadsLinks.map(link => (
                <Link key={link.href} href={link.href}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', textDecoration: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontWeight: '500', marginBottom: '2px', transition: 'all 0.15s' }}
                  className="sidebar-link">
                  <span>{link.emoji}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* User + signout */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        {children}
      </main>

      <style>{`
        .sidebar-link:hover { background: rgba(255,255,255,0.08); color: #E8C97A !important; }
      `}</style>
    </div>
  )
}
