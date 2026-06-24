'use client'
import { useState } from 'react'

export default function WipeButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function wipe() {
    const typed = window.prompt('This permanently deletes ALL calendar sessions and their Google Meet events (use only to clear test data).\n\nType DELETE to confirm:')
    if (typed !== 'DELETE') return
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/calendar/wipe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg(`✅ Cleared ${data.sessionsDeleted} sessions (${data.googleDeleted} Google events removed). Refresh to see the empty calendar.`)
      } else {
        setMsg(`❌ ${data.error ?? 'Failed'}`)
      }
    } catch (e: any) { setMsg(`❌ ${e?.message ?? 'Network error'}`) }
    setBusy(false)
  }

  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '13px', fontWeight: '700', color: '#991B1B' }}>🧹 Clear all sessions (testing)</span>
      <button onClick={wipe} disabled={busy}
        style={{ padding: '6px 14px', background: '#B91C1C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
        {busy ? 'Clearing…' : 'Delete all sessions'}
      </button>
      {msg && <span style={{ fontSize: '12px', color: msg.startsWith('✅') ? '#15803D' : '#B91C1C', fontWeight: '600' }}>{msg}</span>}
    </div>
  )
}
