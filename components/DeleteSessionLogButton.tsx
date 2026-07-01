'use client'
// components/DeleteSessionLogButton.tsx
// Deletes a logged session (the `sessions` table — attendance/rating log, not
// the calendar). Used when a teacher logs a session by mistake or picks the
// wrong student. A DB trigger restores any class that the session deducted.
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DeleteSessionLogButton({
  sessionId, studentName, onDeleted,
}: {
  sessionId: string
  studentName?: string
  onDeleted?: (id: string) => void   // client pages update local state; omit to router.refresh()
}) {
  const supabase = createClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function del() {
    if (!confirm(`Delete this logged session${studentName ? ` for ${studentName}` : ''}?\n\nIf it deducted a class, that class is restored to the student. This cannot be undone.`)) return
    setBusy(true)
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
    setBusy(false)
    if (error) { alert(`Failed to delete: ${error.message}`); return }
    if (onDeleted) onDeleted(sessionId); else router.refresh()
  }

  return (
    <button onClick={del} disabled={busy}
      style={{ padding: '5px 12px', background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
      {busy ? '…' : 'Delete'}
    </button>
  )
}
