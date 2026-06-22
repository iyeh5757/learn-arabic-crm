'use client'
import { useState } from 'react'

export default function GoogleStatus() {
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  async function check() {
    setState('checking'); setMsg('')
    try {
      const res = await fetch('/api/calendar/google-status')
      const data = await res.json()
      if (res.ok && data.ok) {
        setState('ok'); setMsg('Google Calendar & Meet connected — new bookings will get Meet links automatically.')
      } else {
        setState('error'); setMsg(data.error ?? 'Not connected')
      }
    } catch (e: any) {
      setState('error'); setMsg(e?.message ?? 'Network error')
    }
  }

  async function syncNow() {
    setSyncing(true); setSyncMsg('')
    try {
      const res = await fetch('/api/calendar/sync-google', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSyncMsg(`✅ Synced — checked ${data.checked}, ${data.removed} removed, ${data.rescheduled} rescheduled from Google.`)
      } else {
        setSyncMsg(`❌ ${data.error ?? 'Sync failed'}`)
      }
    } catch (e: any) {
      setSyncMsg(`❌ ${e?.message ?? 'Network error'}`)
    }
    setSyncing(false)
  }

  const bg = state === 'ok' ? '#ECFDF5' : state === 'error' ? '#FEF2F2' : '#F8FAFC'
  const border = state === 'ok' ? '#A7F3D0' : state === 'error' ? '#FECACA' : '#E2E8F0'

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>🎥 Google Meet Integration</span>
        <button onClick={check} disabled={state === 'checking'}
          style={{ padding: '6px 14px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
          {state === 'checking' ? 'Checking…' : 'Test Connection'}
        </button>
        {state === 'ok'    && <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803D' }}>✅ Connected</span>}
        {state === 'error' && <span style={{ fontSize: '12px', fontWeight: '700', color: '#B91C1C' }}>❌ Not connected</span>}
        <button onClick={syncNow} disabled={syncing}
          style={{ padding: '6px 14px', background: '#fff', color: '#0D1B2A', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
          {syncing ? 'Syncing…' : '🔄 Sync from Google'}
        </button>
      </div>
      {msg && (
        <div style={{ fontSize: '12px', color: state === 'ok' ? '#047857' : '#B91C1C', marginTop: '8px' }}>
          {msg}
        </div>
      )}
      {syncMsg && (
        <div style={{ fontSize: '12px', color: syncMsg.startsWith('✅') ? '#047857' : '#B91C1C', marginTop: '6px' }}>
          {syncMsg}
        </div>
      )}
    </div>
  )
}
