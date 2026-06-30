'use client'
// components/BrowseGroupsModal.tsx
// Shared "Browse WhatsApp Groups" picker. Fetches the group list from
// /api/whatsapp/groups (cached server-side), lets the user search and select a
// group, and returns its JID via onSelect. Usable by admin and sales pages.
import { useState, useEffect } from 'react'

export default function BrowseGroupsModal({ onSelect, onClose }: { onSelect: (id: string) => void; onClose: () => void }) {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  function load(refresh = false) {
    setLoading(true); setError('')
    fetch(`/api/whatsapp/groups${refresh ? '?refresh=1' : ''}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setGroups(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load(false) }, [])

  const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '480px', maxWidth: '92vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>📱 Browse WhatsApp Groups</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #F3F4F6', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input placeholder="Search groups…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          <button type="button" onClick={() => load(true)} disabled={loading} title="Re-fetch from WhatsApp (use after creating a new group)"
            style={{ whiteSpace: 'nowrap', background: '#F0FDF4', color: '#065F46', border: '1px solid #BBF7D0', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            ↻ Refresh
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: '32px', textAlign: 'center', color: '#6B7280' }}>Loading groups…</div>}
          {error && <div style={{ padding: '24px', color: '#DC2626', fontSize: '14px' }}>Error: {error}</div>}
          {!loading && !error && filtered.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: '#9CA3AF' }}>No groups found</div>}
          {filtered.map(g => (
            <div key={g.id} onClick={() => { onSelect(g.id); onClose() }}
              style={{ padding: '12px 22px', cursor: 'pointer', borderBottom: '1px solid #F9FAFB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F0FDF4')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>{g.name}</div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', fontFamily: 'monospace' }}>{g.id}</div>
              </div>
              <span style={{ background: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px' }}>Select</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
