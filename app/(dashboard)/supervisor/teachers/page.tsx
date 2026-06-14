// app/(dashboard)/supervisor/teachers/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function SupervisorTeachersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const { data: teachers } = await supabase
    .from('teachers')
    .select(`id, rate_per_session_usd, languages, specialties, is_active,
      profile:profiles!teachers_user_id_fkey(name, email),
      students:students(id, name, student_status, total_paid_classes, consumed_classes),
      sessions:sessions(id, session_type, attendance_status, session_date, trial_status)`)
    .eq('is_active', true)
    .eq('supervisor_id', user.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Teachers Overview</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{teachers?.length ?? 0} active teachers</p>
      </div>

      {(teachers ?? []).map((t: any) => {
        const activeStudents = (t.students ?? []).filter((s: any) => s.student_status === 'active')
        const trialStudents = (t.students ?? []).filter((s: any) => s.student_status === 'trial')
        const monthSessions = (t.sessions ?? []).filter((s: any) => s.session_type === 'paid' && s.attendance_status === 'attended' && s.session_date >= monthStart)
        const trialsConverted = (t.sessions ?? []).filter((s: any) => s.trial_status === 'converted').length
        const trialsLost = (t.sessions ?? []).filter((s: any) => s.trial_status === 'lost').length
        const needsRenewal = activeStudents.filter((s: any) => (s.total_paid_classes - s.consumed_classes) <= 2)

        return (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ background: '#0D1B2A', padding: '16px 22px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(201,168,76,0.2)', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8C97A', fontWeight: '700', fontSize: '18px', flexShrink: 0 }}>
                {t.profile?.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '700', color: '#fff', margin: 0, fontSize: '16px' }}>{t.profile?.name}</p>
                <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '2px 0 0 0' }}>{(t.specialties ?? []).join(', ')} · {(t.languages ?? []).join(', ')}</p>
              </div>
              <div style={{ display: 'flex', gap: '12px', textAlign: 'right' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#9CA3AF', fontSize: '10px', margin: '0 0 2px 0', textTransform: 'uppercase' }}>Sessions/Mo</p>
                  <p style={{ color: '#E8C97A', fontSize: '18px', fontWeight: '700', margin: 0 }}>{monthSessions.length}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0', borderBottom: '1px solid #F3F4F6' }}>
              {[
                { label: 'Active Students', value: activeStudents.length, color: '#059669' },
                { label: 'Trial Students', value: trialStudents.length, color: '#2563EB' },
                { label: 'Trials Converted', value: trialsConverted, color: '#059669' },
                { label: 'Trials Lost', value: trialsLost, color: '#DC2626' },
                { label: 'Needs Renewal', value: needsRenewal.length, color: needsRenewal.length > 0 ? '#D97706' : '#6B7280' },
              ].map((stat, i) => (
                <div key={stat.label} style={{ padding: '14px 20px', borderRight: '1px solid #F3F4F6', textAlign: 'center' }}>
                  <p style={{ fontSize: '22px', fontWeight: '700', color: stat.color, margin: 0 }}>{stat.value}</p>
                  <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0 0' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Students list */}
            {activeStudents.length > 0 && (
              <div style={{ padding: '14px 22px' }}>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0' }}>Active Students</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {activeStudents.map((s: any) => {
                    const rem = s.total_paid_classes - s.consumed_classes
                    return (
                      <div key={s.id} style={{ background: rem <= 2 ? '#FFFBEB' : '#F9FAFB', border: `1px solid ${rem <= 2 ? '#FCD34D' : '#E5E7EB'}`, borderRadius: '8px', padding: '6px 12px', fontSize: '13px' }}>
                        <span style={{ fontWeight: '500', color: '#111827' }}>{s.name}</span>
                        <span style={{ color: rem <= 2 ? '#D97706' : '#6B7280', marginLeft: '6px', fontSize: '12px' }}>{rem} left</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
