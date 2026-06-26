'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function MarkInactiveButton({ studentId, name }: { studentId: string; name: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { error } = await supabase.from('students').update({
      student_status: 'inactive',
      recontact_date: date || null,
      inactive_reason: reason || null,
    }).eq('id', studentId)
    setBusy(false)
    if (error) { alert(`Failed: ${error.message}`); return }
    setOpen(false); router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ background: '#FEF3C7', color: '#92400E', padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
        Mark Inactive
      </button>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setOpen(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '22px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>Mark {name} as inactive</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>They'll stop counting as an active student. Set a date to follow up and a note.</div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>Recontact date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', marginBottom: '12px', outline: 'none' }} />
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }}>Comment</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. On hold — travelling, follow up in July"
              style={{ width: '100%', minHeight: '64px', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', marginBottom: '16px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '9px 18px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', color: '#475569' }}>Cancel</button>
              <button onClick={save} disabled={busy} style={{ padding: '9px 18px', background: '#B45309', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                {busy ? 'Saving…' : 'Mark Inactive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function ReactivateButton({ studentId }: { studentId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  async function reactivate() {
    if (!confirm('Reactivate this student? They will count as active again.')) return
    setBusy(true)
    const { error } = await supabase.from('students').update({
      student_status: 'active', recontact_date: null,
    }).eq('id', studentId)
    setBusy(false)
    if (error) { alert(`Failed: ${error.message}`); return }
    router.refresh()
  }
  return (
    <button onClick={reactivate} disabled={busy}
      style={{ background: '#059669', color: '#fff', padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
      Reactivate
    </button>
  )
}
