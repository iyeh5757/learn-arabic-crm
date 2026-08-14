// app/(dashboard)/admin/meta-log/page.tsx
// Read-only view of what we sent to Meta and whether it worked.
// Answers "did last night's send work?" without reading Vercel logs.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const OUTCOME_STYLE: Record<string, { bg: string; c: string; label: string }> = {
  sent:                 { bg: '#ECFDF5', c: '#059669', label: 'Sent' },
  failed:               { bg: '#FEF2F2', c: '#DC2626', label: 'Failed' },
  skipped_too_old:      { bg: '#FFFBEB', c: '#B45309', label: 'Too old (>7d)' },
  skipped_no_match_key: { bg: '#F1F5F9', c: '#475569', label: 'No email/phone' },
}

export default async function MetaLogPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin') redirect('/dashboard')

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const [{ data: recent }, { data: window7 }] = await Promise.all([
    supabase.from('meta_send_log')
      .select('id, event_name, entity_id, event_id, event_time, outcome, http_status, error, has_country, test_event, created_at')
      .order('created_at', { ascending: false }).limit(200),
    supabase.from('meta_send_log').select('outcome, created_at, has_country').gte('created_at', since),
  ])

  const rows = recent ?? []
  const w = window7 ?? []
  const count = (o: string) => w.filter((r: any) => r.outcome === o).length
  const lastRun = rows[0]?.created_at ? new Date(rows[0].created_at) : null
  const lastRunRows = lastRun
    ? rows.filter((r: any) => Math.abs(new Date(r.created_at).getTime() - lastRun.getTime()) < 10 * 60 * 1000)
    : []
  const lastRunFailed = lastRunRows.filter((r: any) => r.outcome === 'failed').length
  const lastRunSent = lastRunRows.filter((r: any) => r.outcome === 'sent').length
  const hoursAgo = lastRun ? Math.round((Date.now() - lastRun.getTime()) / 3600000) : null
  const stale = hoursAgo !== null && hoursAgo > 26   // daily cron runs every 24h

  const withCountry = w.filter((r: any) => r.outcome === 'sent' && r.has_country).length
  const sentTotal = count('sent')

  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #F3F4F6' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>📋 Meta Send Log</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
          Every event we attempted to send to Meta, and whether it worked. <Link href="/admin/meta-export" style={{ color: '#2563EB' }}>Meta Conversions →</Link>
        </p>
      </div>

      {/* Did the last run work? */}
      {rows.length === 0 ? (
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', fontSize: '14px', color: '#475569' }}>
          No sends recorded yet. The daily job runs at 06:00 UTC — this will fill in after the next run (or after you use “Send to Meta now”).
        </div>
      ) : (
        <div style={{
          background: lastRunFailed > 0 ? '#FEF2F2' : stale ? '#FFFBEB' : '#ECFDF5',
          border: `1px solid ${lastRunFailed > 0 ? '#FECACA' : stale ? '#FDE68A' : '#A7F3D0'}`,
          borderRadius: '12px', padding: '16px 20px',
        }}>
          <div style={{ fontWeight: 800, fontSize: '15px', color: lastRunFailed > 0 ? '#B91C1C' : stale ? '#92400E' : '#065F46' }}>
            {lastRunFailed > 0
              ? `⚠️ Last run had ${lastRunFailed} failure${lastRunFailed === 1 ? '' : 's'}`
              : stale ? `⚠️ No send in ${hoursAgo} hours — the daily job may not be running`
              : `✅ Last run OK — ${lastRunSent} event${lastRunSent === 1 ? '' : 's'} sent`}
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
            Last activity {hoursAgo === 0 ? 'less than an hour' : `${hoursAgo} hour${hoursAgo === 1 ? '' : 's'}`} ago
            {lastRun ? ` · ${lastRun.toLocaleString('en-GB')}` : ''}
          </div>
        </div>
      )}

      {/* 7-day summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Sent (7d)', value: sentTotal, color: '#059669', bg: '#ECFDF5' },
          { label: 'Failed (7d)', value: count('failed'), color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Dropped: too old', value: count('skipped_too_old'), color: '#B45309', bg: '#FFFBEB' },
          { label: 'Dropped: no email/phone', value: count('skipped_no_match_key'), color: '#475569', bg: '#F1F5F9' },
          { label: 'Sent with country', value: sentTotal ? `${Math.round((withCountry / sentTotal) * 100)}%` : '—', color: '#2563EB', bg: '#EFF6FF' },
        ].map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: '10px', color: k.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, marginTop: '3px' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {count('skipped_too_old') > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#92400E' }}>
          ⚠️ {count('skipped_too_old')} event(s) were older than Meta&apos;s 7-day limit and could not be sent. These are permanently unsendable via the API.
        </div>
      )}

      {/* Recent rows */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', borderBottom: '1px solid #F3F4F6', fontWeight: 700, fontSize: '14px', color: '#111827' }}>
          Recent activity ({rows.length})
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>Nothing logged yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['When', 'Event', 'Outcome', 'Country?', 'HTTP', 'Error', 'Event ID'].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => {
                  const st = OUTCOME_STYLE[r.outcome] ?? { bg: '#F3F4F6', c: '#374151', label: r.outcome }
                  return (
                    <tr key={r.id}>
                      <td style={{ ...td, whiteSpace: 'nowrap', color: '#64748B' }}>
                        {new Date(r.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>
                        {r.event_name}{r.test_event && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#EFF6FF', color: '#2563EB', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>TEST</span>}
                      </td>
                      <td style={td}>
                        <span style={{ background: st.bg, color: st.c, padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{st.label}</span>
                      </td>
                      <td style={{ ...td, color: r.has_country ? '#059669' : '#94A3B8' }}>{r.has_country ? '✓' : '—'}</td>
                      <td style={{ ...td, color: '#64748B' }}>{r.http_status ?? '—'}</td>
                      <td style={{ ...td, color: '#B91C1C', maxWidth: '320px' }}>{r.error ?? ''}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8' }}>{r.event_id}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>
        No access token or unhashed personal data is stored here. “Country?” shows whether a mapped country was included — students whose country is “Other” or blank send none.
      </p>
    </div>
  )
}
