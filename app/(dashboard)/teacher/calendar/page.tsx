// app/(dashboard)/teacher/calendar/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TeacherCalendar from './TeacherCalendar'

export default async function TeacherCalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'teacher') redirect('/dashboard')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: 0 }}>📅 My Calendar</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Your sessions and availability — Cairo time</p>
      </div>
      <TeacherCalendar />
    </div>
  )
}
