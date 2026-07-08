import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/InboxClient'

export default async function SupervisorInboxPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'supervisor') redirect('/dashboard')

  const [{ data: repRows }, { data: countryRows }] = await Promise.all([
    supabase.from('profiles').select('id, name').in('role', ['admin', 'supervisor', 'sales']).order('name'),
    supabase.from('students').select('country').not('country', 'is', null),
  ])
  const reps = (repRows ?? []).map((r: any) => ({ id: r.id, name: r.name }))
  const countries = Array.from(new Set((countryRows ?? []).map((c: any) => c.country).filter(Boolean))).sort() as string[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>💬 Team Inbox</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>Reply to customers on the business WhatsApp — assign, filter by country, track status.</p>
      </div>
      <InboxClient currentUserId={user.id} reps={reps} countries={countries} />
    </div>
  )
}
