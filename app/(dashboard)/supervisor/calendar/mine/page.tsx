// app/(dashboard)/supervisor/calendar/mine/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarClient from '../../../admin/calendar/CalendarClient'

export default async function SupervisorMyCalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'supervisor') redirect('/dashboard')

  const { data: teacherRows } = await supabase
    .from('teachers').select('id, profile:profiles!teachers_user_id_fkey(name, email)')
    .eq('supervisor_id', user.id).order('id')
  const teachers = (teacherRows ?? []).map((t: any) => ({ id: t.id, name: t.profile?.name ?? 'Unknown', email: t.profile?.email ?? '', supervisor_id: user.id }))
  const teacherIds = teachers.map(t => t.id)

  const [{ data: sessionTypes }, { data: students }] = await Promise.all([
    supabase.from('session_type_config').select('id, name, color').eq('is_active', true).order('sort_order'),
    teacherIds.length
      ? supabase.from('students').select('id, name, email, phone').in('assigned_teacher_id', teacherIds).order('name')
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0 }}>🗓️ My Calendar</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Only the sessions you booked — Cairo time</p>
      </div>
      <CalendarClient
        sessionTypes={sessionTypes ?? []}
        teachers={teachers}
        supervisors={[]}
        students={(students ?? []).map((s: any) => ({ id: s.id, name: s.name, email: s.email ?? '', phone: s.phone ?? '' }))}
        mineOnly
        showBlocks={false}
        showSupervisorFilter={false}
        canDelete={false}
      />
    </div>
  )
}
