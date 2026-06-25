// app/(dashboard)/sales/calendar/availability/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AvailabilityBoardClient from '../../../admin/calendar/availability/AvailabilityBoardClient'

export default async function SalesAvailabilityPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'sales') redirect('/dashboard')

  const { data: teacherRows } = await supabase
    .from('teachers')
    .select('id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)')
    .order('id')
  const teachers = (teacherRows ?? []).map((t: any) => ({
    id: t.id, name: t.profile?.name ?? 'Unknown', specialties: t.specialties ?? [], languages: t.languages ?? [],
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: '0 0 4px' }}>🔍 Availability Search Board</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Find available teachers by dialect, language, date — Cairo time</p>
      </div>
      <AvailabilityBoardClient teachers={teachers} />
    </div>
  )
}
