'use client'
// app/(dashboard)/admin/meta-export/page.tsx
// Read-only export of conversion events (trial / paid / renewal) as a CSV for
// manual upload to Meta Events Manager. Uses only existing students + payments.
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = {
  event_name: string; event_time: string
  email: string; phone: string; first_name: string; last_name: string; country: string
  value: string; currency: string; event_id: string
}

function iso24hAgo() { const d = new Date(Date.now() - 24 * 3600 * 1000); return d.toISOString().slice(0, 16) }
function isoNow() { return new Date().toISOString().slice(0, 16) }

function csvEscape(v: string) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function MetaExportPage() {
  const supabase = createClient()
  const [from, setFrom] = useState(iso24hAgo())
  const [to, setTo] = useState(isoNow())
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<{ trial: number; purchase: number; renewal: number } | null>(null)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true); setError(''); setSummary(null)
    try {
      const fromISO = new Date(from).toISOString()
      const toISO = new Date(to).toISOString()

      const [{ data: students }, { data: payments }] = await Promise.all([
        supabase.from('students').select('id, name, email, phone, country, created_at'),
        supabase.from('payments').select('id, student_id, amount, currency, status, created_at').eq('status', 'paid').order('created_at'),
      ])
      const stById = new Map((students ?? []).map((s: any) => [s.id, s]))

      const splitName = (n: string | null) => {
        const parts = (n ?? '').trim().split(/\s+/)
        return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
      }
      const inRange = (iso: string) => iso >= fromISO && iso <= toISO

      const rows: Row[] = []
      let trial = 0, purchase = 0, renewal = 0

      // Trial = new student created in the range
      for (const s of (students ?? []) as any[]) {
        if (!s.created_at || !inRange(new Date(s.created_at).toISOString())) continue
        if (!s.email && !s.phone) continue
        const nm = splitName(s.name)
        rows.push({
          event_name: 'trial', event_time: new Date(s.created_at).toISOString(),
          email: s.email ?? '', phone: s.phone ?? '', first_name: nm.first, last_name: nm.last, country: s.country ?? '',
          value: '', currency: '', event_id: `${s.id}_trial`,
        })
        trial++
      }

      // Payments: 1st paid = purchase, 2nd+ = renewal (per student, chronological)
      const ordinal = new Map<string, number>()
      for (const p of (payments ?? []) as any[]) {
        const n = (ordinal.get(p.student_id) ?? 0) + 1
        ordinal.set(p.student_id, n)
        if (!p.created_at || !inRange(new Date(p.created_at).toISOString())) continue
        const s: any = stById.get(p.student_id)
        if (!s || (!s.email && !s.phone)) continue
        const nm = splitName(s.name)
        const isRenewal = n >= 2
        rows.push({
          event_name: isRenewal ? 'renewal' : 'purchase',
          event_time: new Date(p.created_at).toISOString(),
          email: s.email ?? '', phone: s.phone ?? '', first_name: nm.first, last_name: nm.last, country: s.country ?? '',
          value: p.amount != null ? String(p.amount) : '', currency: p.currency ?? '',
          event_id: isRenewal ? `${p.student_id}_renewal_${p.id}` : `${p.student_id}_purchase`,
        })
        if (isRenewal) renewal++; else purchase++
      }

      if (rows.length === 0) { setSummary({ trial: 0, purchase: 0, renewal: 0 }); setBusy(false); return }

      const headers = ['event_name', 'event_time', 'email', 'phone', 'first_name', 'last_name', 'country', 'value', 'currency', 'event_id']
      const lines = [headers.join(',')]
      for (const r of rows) lines.push(headers.map(h => csvEscape((r as any)[h])).join(','))
      const csv = lines.join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meta-conversions-${from.slice(0, 10)}_to_${to.slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setSummary({ trial, purchase, renewal })
    } catch (e: any) { setError(e?.message ?? 'Failed to generate') }
    setBusy(false)
  }

  const inp: React.CSSProperties = { padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', outline: 'none' }

  return (
    <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: 0 }}>🎯 Meta Conversions Export</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
          Download your conversion events (trial / paid / renewal) as a CSV, then upload it to Meta Events Manager. Uses your existing students &amp; payments — nothing is sent automatically.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '5px' }}>From</label>
            <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '5px' }}>To</label>
            <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} style={inp} />
          </div>
          <button onClick={generate} disabled={busy}
            style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', padding: '11px 22px', fontSize: '14px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Generating…' : '⬇ Download CSV'}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#94A3B8', margin: '12px 0 0' }}>Default range = last 24 hours. Run it once a day.</p>

        {error && <div style={{ marginTop: '12px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>{error}</div>}
        {summary && (
          <div style={{ marginTop: '14px', background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#065F46', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
            {summary.trial + summary.purchase + summary.renewal === 0
              ? 'No events in this range.'
              : `Exported ✅ — ${summary.trial} trial, ${summary.purchase} paid, ${summary.renewal} renewal.`}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A', marginBottom: '10px' }}>How to upload to Meta (once a day)</div>
        <ol style={{ margin: 0, paddingLeft: '18px', color: '#475569', fontSize: '13px', lineHeight: 1.7 }}>
          <li>Meta <strong>Events Manager</strong> → open your dataset (ID <code>1080439971325299</code>).</li>
          <li><strong>Add events → Upload events → Upload from file</strong>, choose this CSV.</li>
          <li>Map the columns (email, phone, event name, event time, value, currency). Meta hashes the email/phone for you.</li>
          <li>Review &amp; upload. The <code>event_id</code> column lets Meta ignore duplicates if ranges overlap.</li>
        </ol>
      </div>
    </div>
  )
}
