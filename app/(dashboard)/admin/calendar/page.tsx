// app/(dashboard)/admin/calendar/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarClient from './CalendarClient'
import TestWhatsApp from './TestWhatsApp'
import GoogleStatus from './GoogleStatus'
import WipeButton from './WipeButton'

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Fetch session types, teachers, students for the booking modal
  const [
    { data: sessionTypes },
    { data: teacherRows },
    { data: students },
    { data: supervisorRows },
  ] = await Promise.all([
    supabase.from('session_type_config').select('id, name, color').eq('is_active', true).order('sort_order'),
    supabase.from('teachers').select('id, supervisor_id, profile:profiles!teachers_user_id_fkey(name, email)').order('id'),
    supabase.from('students').select('id, name, email, phone').in('student_status', ['active', 'trial']).order('name'),
    supabase.from('profiles').select('id, name').eq('role', 'supervisor').order('name'),
  ])

  const teachers = (teacherRows ?? []).map((t: any) => ({
    id:            t.id,
    name:          t.profile?.name ?? 'Unknown',
    email:         t.profile?.email ?? '',
    supervisor_id: t.supervisor_id ?? null,
  }))

  const supervisors = (supervisorRows ?? []).map((s: any) => ({ id: s.id, name: s.name }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Integration status / tests */}
      <TestWhatsApp />
      <GoogleStatus />
      <WipeButton />

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0 }}>📅 Calendar & Scheduling Hub</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Academy-wide session scheduling — Cairo time (UTC+2)</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="/admin/calendar/availability" style={{ padding: '8px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#374151', textDecoration: 'none' }}>
            🔍 Availability Board
          </a>
        </div>
      </div>

      {/* Session type legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {(sessionTypes ?? []).map((t: any) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '20px', fontSize: '12px', fontWeight: '500', color: '#374151' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: t.color, display: 'inline-block', flexShrink: 0 }} />
            {t.name}
          </div>
        ))}
      </div>

      {/* Calendar */}
      <CalendarClient
        sessionTypes={sessionTypes ?? []}
        teachers={teachers}
        supervisors={supervisors}
        students={(students ?? []).map((s: any) => ({ id: s.id, name: s.name, email: s.email ?? '', phone: s.phone ?? '' }))}
      />
    </div>
  )
}
