// app/(dashboard)/admin/teachers/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminTeachersPage() {
  const supabase = createClient()

  const { data: teachers } = await supabase
    .from('teachers')
    .select(`
      id, rate_per_session_usd, languages, specialties, is_active,
      profile:profiles!teachers_user_id_fkey(id, name, email, is_active),
      students:students(id, student_status),
      sessions:sessions(id, session_type, attendance_status, session_date, duration, student:students(student_status))
    `)
    .order('is_active', { ascending: false })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Teachers</h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{teachers?.length ?? 0} teachers</p>
        </div>
        <Link href="/admin/users/new" style={{ background: '#0D1B2A', color: '#E8C97A', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600', fontSize: '14px' }}>
          + Add Teacher
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {(teachers ?? []).map((t: any) => {
          const activeStudents = (t.students ?? []).filter((s: any) => s.student_status === 'active').length
          const trialStudents = (t.students ?? []).filter((s: any) => s.student_status === 'trial').length
          const monthAttended = (t.sessions ?? []).filter((s: any) =>
            (s.attendance_status === 'attended' || s.attendance_status === 'no_show') && s.session_date >= monthStart &&
            (s.session_type === 'paid' || s.session_type === 'trial')
          )
          const paidAttended = monthAttended.filter((s: any) => s.session_type === 'paid' && s.attendance_status === 'attended').length
          const paidNoShow = monthAttended.filter((s: any) => s.session_type === 'paid' && s.attendance_status === 'no_show').length
          const monthSessions = paidAttended + paidNoShow
          const monthTrials = monthAttended.filter((s: any) => s.session_type === 'trial' && s.student?.student_status === 'active').length
          const earningsUSD = monthAttended.reduce((acc: number, s: any) => {
            if (s.session_type === 'trial') {
              if (s.student?.student_status !== 'active') return acc
              return acc + ((s.duration ?? 60) >= 60 ? 5 : 3)
            }
            return acc + Number(t.rate_per_session_usd) * ((s.duration ?? 60) / 60)
          }, 0)

          return (
            <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', opacity: t.is_active ? 1 : 0.6 }}>
              {/* Header */}
              <div style={{ background: '#0D1B2A', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(201,168,76,0.2)', border: '2px solid #C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8C97A', fontWeight: '700', fontSize: '18px', flexShrink: 0 }}>
                  {t.profile?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '700', color: '#fff', margin: 0, fontSize: '16px' }}>{t.profile?.name}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', margin: '2px 0 0 0' }}>{t.profile?.email}</p>
                </div>
                <span style={{ background: t.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)', color: t.is_active ? '#34D399' : '#9CA3AF', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid #F3F4F6' }}>
                {[
                  { label: 'Active', value: activeStudents, color: '#059669' },
                  { label: 'Trial', value: trialStudents, color: '#2563EB' },
                  { label: 'Attended', value: paidAttended, color: '#059669' },
                  { label: 'No Show', value: paidNoShow, color: '#DC2626' },
                  { label: 'Trials (Conv)', value: monthTrials, color: '#0891B2' },
                  { label: 'Total Paid', value: monthSessions, color: '#7C3AED' },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: '14px', textAlign: 'center', borderRight: '1px solid #F3F4F6' }}>
                    <p style={{ fontSize: '20px', fontWeight: '700', color: stat.color, margin: 0 }}>{stat.value}</p>
                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0 0' }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Details */}
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>Rate per session</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#059669' }}>${Number(t.rate_per_session_usd).toFixed(2)} USD</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>Earnings this month</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0D1B2A' }}>${earningsUSD.toFixed(2)}</span>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
                    {paidAttended > 0 && <span style={{ marginRight: '6px' }}>✅ {paidAttended} attended</span>}
                    {paidNoShow > 0 && <span style={{ marginRight: '6px', color: '#DC2626' }}>🚫 {paidNoShow} no-show</span>}
                    {monthTrials > 0 && <span style={{ color: '#0891B2' }}>🎯 {monthTrials} trial</span>}
                  </div>
                </div>
                {(t.specialties ?? []).length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <p style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px 0' }}>Specialties</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(t.specialties ?? []).map((s: string) => (
                        <span key={s} style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(t.languages ?? []).length > 0 && (
                  <div>
                    <p style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px 0' }}>Languages</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(t.languages ?? []).map((l: string) => (
                        <span key={l} style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
