'use client'
// components/CreateGroupButton.tsx
// Create a WhatsApp group for a student straight from the CRM. The business
// number becomes the group admin; the new group is auto-linked to the student
// so reminders go there.
import { useState } from 'react'

export default function CreateGroupButton({
  studentId, studentName, studentPhone, onCreated,
}: {
  studentId: string
  studentName: string
  studentPhone: string | null
  onCreated: (jid: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(`${studentName || 'Student'} · Learn Arabic`)
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!studentPhone) { alert('This student has no phone number — add one first.'); return }
    setBusy(true)
    const participants = [studentPhone, ...extra.split(',').map(s => s.trim()).filter(Boolean)]
    const res = await fetch('/api/whatsapp/groups/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: name, participants, student_id: studentId }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok && data.jid) {
      onCreated(data.jid); setOpen(false)
      alert(`✅ Group created and linked — reminders for this student will go here.${data.inviteUrl ? '\n\nAn invite link was sent to the participants so anyone whose privacy blocks direct adds can join with one tap.' : ''}`)
    } else alert(`Couldn't create group: ${data?.error ?? 'unknown error'}`)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ whiteSpace: 'nowrap', background: '#EFF6FF', color: '#2563EB', padding: '9px 14px', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
        ➕ Create group
      </button>
    )
  }

  return (
    <div style={{ width: '100%', border: '1px solid #BFDBFE', background: '#F8FAFF', borderRadius: '10px', padding: '12px', marginTop: '8px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E3A8A', marginBottom: '8px' }}>➕ New WhatsApp group</div>
      <label style={{ fontSize: '11px', color: '#64748B' }}>Group name</label>
      <input value={name} onChange={e => setName(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', margin: '3px 0 10px' }} />
      <label style={{ fontSize: '11px', color: '#64748B' }}>Add more numbers (optional, comma-separated with country code)</label>
      <input value={extra} onChange={e => setExtra(e.target.value)} placeholder="e.g. 201001234567, 447700900123"
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', margin: '3px 0 6px' }} />
      <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 10px' }}>The student ({studentPhone || 'no phone!'}) and your business number are added automatically.</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => setOpen(false)} disabled={busy}
          style={{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={create} disabled={busy}
          style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </div>
  )
}
