'use client'
import { useState } from 'react'

export default function TestWhatsApp() {
  const [phone, setPhone]   = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [msg, setMsg]       = useState('')

  async function send() {
    setStatus('sending'); setMsg('')
    try {
      const res = await fetch('/api/calendar/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('ok'); setMsg('✅ Sent! Check your WhatsApp.')
      } else {
        setStatus('error'); setMsg(`❌ ${data.error ?? 'Failed to send'}`)
      }
    } catch (e: any) {
      setStatus('error'); setMsg(`❌ ${e?.message ?? 'Network error'}`)
    }
  }

  return (
    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', padding: '14px 18px' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: '#065F46', marginBottom: '8px' }}>
        🧪 Test WhatsApp Connection
      </div>
      <div style={{ fontSize: '12px', color: '#047857', marginBottom: '10px' }}>
        Enter a phone number with country code (e.g. 201234567890) to send a test reminder.
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="201234567890"
          style={{ padding: '8px 12px', border: '1px solid #A7F3D0', borderRadius: '8px', fontSize: '13px', outline: 'none', minWidth: '200px' }}
        />
        <button
          onClick={send}
          disabled={!phone || status === 'sending'}
          style={{ padding: '8px 18px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: phone && status !== 'sending' ? 'pointer' : 'not-allowed', opacity: phone && status !== 'sending' ? 1 : 0.6 }}
        >
          {status === 'sending' ? 'Sending…' : 'Send Test'}
        </button>
        {msg && (
          <span style={{ fontSize: '13px', fontWeight: '600', color: status === 'ok' ? '#065F46' : '#DC2626' }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  )
}
