'use client'
// components/CountryAssignments.tsx
// Admin: assign which countries each sales rep handles. A rep with no countries
// assigned sees every conversation (safe default); once countries are set, their
// inbox is scoped to those countries (+ new/unmatched leads + chats assigned to them).
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Rep = { id: string; name: string; countries: string[] | null }

export default function CountryAssignments({ countries }: { countries: string[] }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [reps, setReps] = useState<Rep[]>([])
  const [repId, setRepId] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.from('profiles').select('id, name, countries').eq('role', 'sales').order('name')
      .then(({ data }) => setReps((data ?? []) as Rep[]))
  }, [open])

  function selectRep(id: string) {
    setRepId(id); setSaved(false)
    const rep = reps.find(r => r.id === id)
    setPicked(new Set(rep?.countries ?? []))
  }

  function toggle(c: string) {
    setPicked(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })
  }

  async function save() {
    if (!repId) return
    setSaving(true)
    const arr = Array.from(picked)
    const { error } = await supabase.from('profiles').update({ countries: arr.length ? arr : null }).eq('id', repId)
    setSaving(false)
    if (error) { alert(`Couldn't save: ${error.message}`); return }
    setReps(prev => prev.map(r => r.id === repId ? { ...r, countries: arr } : r))
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const box: React.CSSProperties = { padding: '7px 9px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none' }

  return (
    <div style={{ marginTop: '10px' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '7px 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
        🌍 Country assignments {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{ marginTop: '10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px', maxWidth: '640px' }}>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 10px' }}>
            Pick a sales rep, tick the countries they handle, and save. A rep with no countries ticked sees all chats.
          </p>
          <select value={repId} onChange={e => selectRep(e.target.value)} style={{ ...box, width: '100%', marginBottom: '12px' }}>
            <option value="">Select a sales rep…</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.name}{r.countries?.length ? ` (${r.countries.length} countries)` : ''}</option>)}
          </select>

          {repId && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '220px', overflowY: 'auto', padding: '4px', border: '1px solid #F1F5F9', borderRadius: '8px' }}>
                {countries.length === 0 && <span style={{ fontSize: '12px', color: '#9CA3AF' }}>No countries in the system yet.</span>}
                {countries.map(c => {
                  const on = picked.has(c)
                  return (
                    <button key={c} type="button" onClick={() => toggle(c)}
                      style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                        border: on ? '1.5px solid #065F46' : '1px solid #E2E8F0',
                        background: on ? '#065F46' : '#fff', color: on ? '#fff' : '#475569', fontWeight: on ? 700 : 500 }}>
                      {on ? '✓ ' : ''}{c}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                <button onClick={save} disabled={saving}
                  style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '9px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Save countries'}
                </button>
                <span style={{ fontSize: '12px', color: '#64748B' }}>{picked.size} selected</span>
                {saved && <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>✅ Saved</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
