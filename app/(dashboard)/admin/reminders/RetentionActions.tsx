'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }
const card: React.CSSProperties = { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '460px', padding: '22px', maxHeight: '88vh', overflowY: 'auto' }
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }

export function MarkInactiveButton({ studentId, name }: { studentId: string; name: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!reason.trim()) { alert('Please add a comment.'); return }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('students').update({
      student_status: 'inactive', recontact_date: date || null, inactive_reason: reason,
    }).eq('id', studentId)
    if (!error) {
      // start the contact-history log with this first note
      await supabase.from('student_followups').insert({
        student_id: studentId, note: reason, next_recontact_date: date || null, created_by: user?.id ?? null,
      })
    }
    setBusy(false)
    if (error) { alert(`Failed: ${error.message}`); return }
    setOpen(false); router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ background: '#FEF3C7', color: '#92400E', padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
        Mark Inactive
      </button>
      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div style={card} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginBottom: '4px' }}>Mark {name} as inactive</div>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>They'll stop counting as an active student. Set a follow-up date and a note.</div>
            <label style={lbl}>Recontact date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, marginBottom: '12px' }} />
            <label style={lbl}>Comment</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. On hold — travelling, follow up in July"
              style={{ ...inp, minHeight: '64px', marginBottom: '16px', resize: 'vertical' }} />
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
    const { error } = await supabase.from('students').update({ student_status: 'active', recontact_date: null }).eq('id', studentId)
    setBusy(false)
    if (error) { alert(`Failed: ${error.message}`); return }
    router.refresh()
  }
  return (
    <button onClick={reactivate} disabled={busy} style={{ background: '#059669', color: '#fff', padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
      Reactivate
    </button>
  )
}

// Contact-history log: view all follow-up notes for a student and add new ones.
export function FollowupsButton({ studentId, name }: { studentId: string; name: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('student_followups')
      .select('id, note, next_recontact_date, created_at')
      .eq('student_id', studentId).order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  function openModal() { setOpen(true); load() }

  async function addNote() {
    if (!note.trim()) { alert('Write a note first.'); return }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('student_followups').insert({
      student_id: studentId, note, next_recontact_date: nextDate || null, created_by: user?.id ?? null,
    })
    // keep the student row summary current (latest note + next date)
    if (!error) {
      await supabase.from('students').update({ inactive_reason: note, recontact_date: nextDate || null }).eq('id', studentId)
    }
    setBusy(false)
    if (error) { alert(`Failed: ${error.message}`); return }
    setNote(''); setNextDate(''); await load(); router.refresh()
  }

  return (
    <>
      <button onClick={openModal} style={{ background: '#EEF2FF', color: '#3730A3', padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
        📝 Notes
      </button>
      {open && (
        <div style={overlay} onClick={() => setOpen(false)}>
          <div style={card} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Follow-up history — {name}</div>
              <button onClick={() => setOpen(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '28px', height: '28px', fontSize: '15px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>

            {/* Add note */}
            <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <label style={lbl}>Log a new contact</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What happened / what was said…"
                style={{ ...inp, minHeight: '56px', resize: 'vertical', marginBottom: '8px' }} />
              <label style={lbl}>Next recontact date (optional)</label>
              <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} style={{ ...inp, marginBottom: '10px' }} />
              <button onClick={addNote} disabled={busy} style={{ padding: '8px 16px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                {busy ? 'Saving…' : 'Add note'}
              </button>
            </div>

            {/* History */}
            {loading ? (
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#94A3B8' }}>No contact notes yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(it => (
                  <div key={it.id} style={{ borderLeft: '3px solid #C7D2FE', background: '#fff', padding: '8px 12px' }}>
                    <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>{it.note}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                      {new Date(it.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {it.next_recontact_date && ` · next: ${new Date(it.next_recontact_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
