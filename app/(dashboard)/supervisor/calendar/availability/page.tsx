// app/(dashboard)/supervisor/calendar/availability/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AvailabilityBoardClient from '../../../admin/calendar/availability/AvailabilityBoardClient'

export default async function SupervisorAvailabilityPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'supervisor') redirect('/dashboard')

  // Only this supervisor's teachers
  const { data: teacherRows } = await supabase
    .from('teachers')
    .select('id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)')
    .eq('supervisor_id', user.id)
    .order('id')
  const teachers = (teacherRows ?? []).map((t: any) => ({
    id: t.id, name: t.profile?.name ?? 'Unknown', specialties: t.specialties ?? [], languages: t.languages ?? [],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 4px' }}>🔍 Availability Search Board</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Free slots for your assigned teachers — Cairo time</p>
      </div>
      {teachers.length === 0 ? (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '16px', color: '#B91C1C', fontSize: '14px' }}>
          No teachers are assigned to you yet. Ask an admin to assign teachers to your account.
        </div>
      ) : (
        <AvailabilityBoardClient teachers={teachers} />
      )}
    </div>
  )
}
