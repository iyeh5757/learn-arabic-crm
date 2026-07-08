'use client'
// components/ConnectInboxButton.tsx
// Admin one-click: configure the Evolution webhook to point at this app so
// incoming WhatsApp messages start flowing into the inbox.
import { useState } from 'react'

export default function ConnectInboxButton() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function connect() {
    setBusy(true); setResult(null)
    try {
      const res = await fetch('/api/whatsapp/setup-webhook', { method: 'POST' })
      const data = await res.json()
      if (res.ok) setResult({ ok: true, msg: `Connected! Incoming messages will now appear here${data.tokenProtected ? '' : ' (tip: set WHATSAPP_WEBHOOK_TOKEN in Vercel for security)'}.` })
      else setResult({ ok: false, msg: data?.error ?? 'Failed to connect' })
    } catch (e: any) { setResult({ ok: false, msg: e?.message ?? 'Network error' }) }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <button onClick={connect} disabled={busy}
        style={{ background: '#065F46', color: '#fff', border: 'none', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Connecting…' : '🔌 Connect Inbox'}
      </button>
      {result && (
        <span style={{ fontSize: '12px', color: result.ok ? '#059669' : '#DC2626', fontWeight: 600 }}>
          {result.ok ? '✅ ' : '⚠️ '}{result.msg}
        </span>
      )}
    </div>
  )
}
