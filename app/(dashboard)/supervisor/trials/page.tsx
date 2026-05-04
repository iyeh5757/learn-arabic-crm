// app/(dashboard)/supervisor/trials/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SupervisorTrialsPage() {
  const supabase = createClient()

  const { data: trials } = await supabase
    .from('sessions')
    .select('*, student:students(name, phone, email, currency), teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
    .eq('session_type', 'trial')
    .order('session_date', { ascending: false })

  const pending = (trials ?? []).filter(t => !t.trial_status || t.trial_status === 'pending')
  const converted = (trials ?? []).filter(t => t.trial_status === 'converted')
  const lost = (trials ?? []).filter(t => t.trial_status === 'lost')

  const convRate = converted.length + lost.length > 0
    ? Math.round((converted.length / (converted.length + lost.length)) * 100)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Trial Sessions</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>{trials?.length ?? 0} total trials</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Pending Decision', value: pending.length, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Converted', value: converted.length, color: '#059669', bg: '#ECFDF5' },
          { label: 'Lost', value: lost.length, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Conversion Rate', value: `${convRate}%`, color: '#2563EB', bg: '#EFF6FF' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #FEF3C7', background: '#FFFBEB', fontWeight: '600', fontSize: '15px', color: '#92400E' }}>
            ⏳ Awaiting Your Decision ({pending.length})
          </div>
          <TrialTable trials={pending} />
        </div>
      )}

      {/* All trials table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', fontWeight: '600', fontSize: '15px', color: '#111827' }}>All Trials</div>
        <TrialTable trials={trials ?? []} showAll />
      </div>
    </div>
  )
}

function TrialTable({ trials, showAll }: { trials: any[]; showAll?: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#F9FAFB' }}>
          {['Date', 'Student', 'Teacher', 'Attendance', 'Outcome', 'Action'].map(h => (
            <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {trials.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF' }}>No trials</td></tr>}
          {trials.map((t: any) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#374151' }}>{new Date(t.session_date).toLocaleDateString('en-GB')}</td>
              <td style={{ padding: '12px 16px', fontWeight: '600', color: '#111827', fontSize: '14px' }}>{t.student?.name}</td>
              <td style={{ padding: '12px 16px', color: '#374151', fontSize: '13px' }}>{t.teacher?.profile?.name}</td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{ background: t.attendance_status === 'attended' ? '#ECFDF5' : '#FEF2F2', color: t.attendance_status === 'attended' ? '#059669' : '#DC2626', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{t.attendance_status}</span>
              </td>
              <td style={{ padding: '12px 16px' }}>
                {t.trial_status
                  ? <span style={{ background: t.trial_status === 'converted' ? '#ECFDF5' : t.trial_status === 'lost' ? '#FEF2F2' : '#FFFBEB', color: t.trial_status === 'converted' ? '#059669' : t.trial_status === 'lost' ? '#DC2626' : '#D97706', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{t.trial_status}</span>
                  : <span style={{ background: '#FFFBEB', color: '#D97706', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>pending</span>}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <Link href={`/supervisor/sessions/${t.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>
                  {!t.trial_status || t.trial_status === 'pending' ? '⚡ Decide' : 'Edit'}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
