// app/(dashboard)/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const role = profile.role

  // Role-based nav links
  const navLinks: Record<string, { label: string; href: string }[]> = {
    admin: [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Students', href: '/admin/students' },
      { label: 'Sessions', href: '/admin/sessions' },
      { label: 'Payments', href: '/admin/payments' },
      { label: 'Teachers', href: '/admin/teachers' },
      { label: 'Users', href: '/admin/users' },
      { label: 'Reports', href: '/admin/reports' },
    ],
    teacher: [
      { label: 'Dashboard', href: '/teacher' },
      { label: 'My Students', href: '/teacher/students' },
      { label: 'Sessions', href: '/teacher/sessions' },
    ],
    sales: [
      { label: 'Dashboard', href: '/sales' },
      { label: 'My Students', href: '/sales/students' },
      { label: 'Payments', href: '/sales/payments' },
      { label: 'Commissions', href: '/sales/commissions' },
    ],
    accountant: [
      { label: 'Dashboard', href: '/accountant' },
      { label: 'Renewals', href: '/accountant/renewals' },
      { label: 'Payments', href: '/accountant/payments' },
      { label: 'Students', href: '/accountant/students' },
    ],
    supervisor: [
      { label: 'Dashboard', href: '/supervisor' },
      { label: 'Sessions', href: '/supervisor/sessions' },
      { label: 'Teachers', href: '/supervisor/teachers' },
      { label: 'Trials', href: '/supervisor/trials' },
    ],
  }

  const links = navLinks[role] ?? []

  const ROLE_COLORS: Record<string, string> = {
    admin: '#7C3AED', teacher: '#2563EB', sales: '#059669',
    accountant: '#DC2626', supervisor: '#EA580C',
  }
  const roleColor = ROLE_COLORS[role] ?? '#6B7280'

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F9FAFB' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar */}
          <aside style={{ width: '220px', background: '#0D1B2A', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10 }}>
            {/* Logo */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', background: 'rgba(201,168,76,0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>تعلم</div>
                <div>
                  <p style={{ color: '#E8C97A', fontWeight: '700', fontSize: '14px', margin: 0 }}>Learn Arabic</p>
                  <p style={{ color: '#6B7280', fontSize: '11px', margin: 0 }}>CRM System</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
              {links.map(link => (
                <a key={link.href} href={link.href}
                  style={{ display: 'block', padding: '10px 20px', color: '#D1D5DB', textDecoration: 'none', fontSize: '14px', fontWeight: '500', transition: 'background 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                  {link.label}
                </a>
              ))}
            </nav>

            {/* User info */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8C97A', fontWeight: '700', fontSize: '14px' }}>
                  {profile.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600', margin: 0 }}>{profile.name}</p>
                  <span style={{ background: `${roleColor}22`, color: roleColor, padding: '1px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', textTransform: 'capitalize' }}>{role}</span>
                </div>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button type="submit" style={{ width: '100%', background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', border: 'none', padding: '8px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}>
                  Sign out
                </button>
              </form>
            </div>
          </aside>

          {/* Main content */}
          <main style={{ marginLeft: '220px', flex: 1, padding: '28px', maxWidth: '100%', boxSizing: 'border-box' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
