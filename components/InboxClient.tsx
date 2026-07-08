'use client'
// components/InboxClient.tsx
// Shared WhatsApp team inbox. Lists conversations (filter by country / status /
// assignee), shows the chat thread, and lets staff reply — all through the one
// business number via Evolution. Polls every few seconds for new messages.
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Conv = {
  id: string; wa_jid: string; name: string | null; phone: string | null; is_group: boolean
  student_id: string | null; country: string | null; assigned_to: string | null
  status: string; last_message_at: string | null; last_message_preview: string | null
  last_direction: string | null; unread_count: number
}
type Msg = { id: string; direction: string; body: string | null; media_type: string | null; sender_name: string | null; created_at: string }
type Rep = { id: string; name: string }
type StudentCtx = { id: string; name: string; student_status: string | null; total_paid_classes: number | null; consumed_classes: number | null; recontact_date: string | null }
type QuickReply = { id: string; label: string; text: string }

export default function InboxClient({ currentUserId, reps, countries, rolePrefix }: { currentUserId: string; reps: Rep[]; countries: string[]; rolePrefix: string }) {
  const supabase = createClient()
  const [convs, setConvs] = useState<Conv[]>([])
  const [selected, setSelected] = useState<Conv | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [fCountry, setFCountry] = useState('')
  const [fStatus, setFStatus] = useState('open')
  const [fAssignee, setFAssignee] = useState('')       // '', 'me', 'unassigned'
  const [student, setStudent] = useState<StudentCtx | null>(null)
  const [savingCtx, setSavingCtx] = useState(false)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([])
  const [manageQR, setManageQR] = useState(false)
  const [qrLabel, setQrLabel] = useState(''); const [qrText, setQrText] = useState('')
  const [newGroup, setNewGroup] = useState(false)
  const [ngName, setNgName] = useState(''); const [ngNumbers, setNgNumbers] = useState(''); const [ngBusy, setNgBusy] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const selectedId = selected?.id

  const loadConvs = useCallback(async () => {
    let q = supabase.from('wa_conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(300)
    if (fStatus) q = q.eq('status', fStatus)
    if (fCountry) q = q.eq('country', fCountry)
    if (fAssignee === 'me') q = q.eq('assigned_to', currentUserId)
    else if (fAssignee === 'unassigned') q = q.is('assigned_to', null)
    const { data } = await q
    setConvs(data ?? [])
  }, [fStatus, fCountry, fAssignee, currentUserId])

  const loadMsgs = useCallback(async (convId: string) => {
    const { data } = await supabase.from('wa_messages').select('*').eq('conversation_id', convId).order('created_at').limit(500)
    setMsgs(data ?? [])
  }, [])

  const loadQuickReplies = useCallback(async () => {
    const { data } = await supabase.from('wa_quick_replies').select('id, label, text').order('created_at')
    setQuickReplies(data ?? [])
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])
  useEffect(() => { loadQuickReplies() }, [loadQuickReplies])
  useEffect(() => { if (selectedId) loadMsgs(selectedId) }, [selectedId, loadMsgs])

  // Load the linked customer's CRM context when a conversation is opened
  useEffect(() => {
    const sid = selected?.student_id
    if (!sid) { setStudent(null); return }
    supabase.from('students').select('id, name, student_status, total_paid_classes, consumed_classes, recontact_date').eq('id', sid).single()
      .then(({ data }) => setStudent(data as StudentCtx ?? null))
  }, [selected?.student_id])

  // Keep the latest loaders/selection in refs so the realtime subscription
  // (mounted once) always calls the current versions.
  const loadConvsRef = useRef(loadConvs); loadConvsRef.current = loadConvs
  const loadMsgsRef = useRef(loadMsgs); loadMsgsRef.current = loadMsgs
  const selIdRef = useRef(selectedId); selIdRef.current = selectedId

  // Real-time: refresh instantly when messages/conversations change (RLS-scoped)
  useEffect(() => {
    const ch = supabase.channel('wa-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_messages' }, () => {
        loadConvsRef.current(); const s = selIdRef.current; if (s) loadMsgsRef.current(s)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => {
        loadConvsRef.current()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // Safety-net poll in case a realtime event is missed
  useEffect(() => {
    const t = setInterval(() => { loadConvs(); if (selectedId) loadMsgs(selectedId) }, 20000)
    return () => clearInterval(t)
  }, [loadConvs, loadMsgs, selectedId])

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }) }, [msgs])

  async function openConv(c: Conv) {
    setSelected(c)
    if (c.unread_count > 0) {
      await supabase.from('wa_conversations').update({ unread_count: 0 }).eq('id', c.id)
      setConvs(prev => prev.map(x => x.id === c.id ? { ...x, unread_count: 0 } : x))
    }
  }

  async function send() {
    if (!selected || !reply.trim() || sending) return
    setSending(true)
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: selected.id, text: reply.trim() }),
    })
    const data = await res.json()
    setSending(false)
    if (res.ok) { setReply(''); loadMsgs(selected.id); loadConvs() }
    else alert(`Failed to send: ${data?.error ?? 'unknown error'}`)
  }

  async function setAssignee(convId: string, to: string) {
    await supabase.from('wa_conversations').update({ assigned_to: to || null }).eq('id', convId)
    setConvs(prev => prev.map(x => x.id === convId ? { ...x, assigned_to: to || null } : x))
    if (selected?.id === convId) setSelected(s => s && { ...s, assigned_to: to || null })
  }
  async function setStatus(convId: string, status: string) {
    await supabase.from('wa_conversations').update({ status }).eq('id', convId)
    setConvs(prev => prev.filter(x => fStatus ? x.status === fStatus || x.id !== convId : true).map(x => x.id === convId ? { ...x, status } : x))
    if (selected?.id === convId) setSelected(s => s && { ...s, status })
  }

  async function saveStudent(patch: Partial<StudentCtx>) {
    if (!student) return
    setSavingCtx(true)
    const { error } = await supabase.from('students').update(patch).eq('id', student.id)
    setSavingCtx(false)
    if (error) { alert(`Couldn't update customer: ${error.message}`); return }
    setStudent(s => s && { ...s, ...patch })
  }

  async function addQuickReply() {
    if (!qrLabel.trim() || !qrText.trim()) return
    const { error } = await supabase.from('wa_quick_replies').insert({ label: qrLabel.trim(), text: qrText.trim(), created_by: currentUserId })
    if (error) { alert(`Couldn't save: ${error.message}`); return }
    setQrLabel(''); setQrText(''); loadQuickReplies()
  }
  async function deleteQuickReply(id: string) {
    await supabase.from('wa_quick_replies').delete().eq('id', id)
    loadQuickReplies()
  }

  async function createGroup() {
    const numbers = ngNumbers.split(',').map(s => s.trim()).filter(Boolean)
    if (!ngName.trim() || numbers.length === 0) return
    setNgBusy(true)
    const res = await fetch('/api/whatsapp/groups/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: ngName.trim(), participants: numbers }),
    })
    const data = await res.json()
    setNgBusy(false)
    if (res.ok && data.jid) {
      setNewGroup(false); setNgName(''); setNgNumbers(''); loadConvs()
      alert(`✅ Group created — it now shows in your conversation list.${data.inviteUrl ? '\n\nAn invite link was sent to the participants so anyone whose privacy blocks direct adds can join.' : ''}`)
    } else alert(`Couldn't create group: ${data?.error ?? 'unknown error'}`)
  }

  const filtered = convs.filter(c => !search || (c.name ?? '').toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search))
  const repName = (id: string | null) => id ? (reps.find(r => r.id === id)?.name ?? '—') : null
  const fmtTime = (iso: string | null) => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

  const sel: React.CSSProperties = { padding: '7px 9px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', background: '#fff', outline: 'none' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '14px', height: 'calc(100vh - 150px)' }}>
      {/* Conversation list */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>Conversations</span>
            <button type="button" onClick={() => setNewGroup(true)}
              style={{ fontSize: '11px', color: '#065F46', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontWeight: 700 }}>
              ＋ New group
            </button>
          </div>
          <input placeholder="Search name or number…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...sel, width: '100%', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ ...sel, flex: 1 }}>
              <option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option><option value="">All</option>
            </select>
            <select value={fAssignee} onChange={e => setFAssignee(e.target.value)} style={{ ...sel, flex: 1 }}>
              <option value="">Everyone</option><option value="me">Mine</option><option value="unassigned">Unassigned</option>
            </select>
          </div>
          <select value={fCountry} onChange={e => setFCountry(e.target.value)} style={{ ...sel, width: '100%' }}>
            <option value="">All countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No conversations</div>}
          {filtered.map(c => (
            <div key={c.id} onClick={() => openConv(c)}
              style={{ padding: '11px 13px', cursor: 'pointer', borderBottom: '1px solid #F8FAFC',
                background: selectedId === c.id ? '#EFF6FF' : c.unread_count > 0 ? '#F0FDF4' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.is_group ? '👥 ' : ''}{c.name || c.phone || 'Unknown'}
                </span>
                <span style={{ fontSize: '10px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtTime(c.last_message_at)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                <span style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.last_direction === 'out' ? '↩ ' : ''}{c.last_message_preview ?? ''}
                </span>
                {c.unread_count > 0 && <span style={{ background: '#16A34A', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '10px', padding: '1px 7px' }}>{c.unread_count}</span>}
              </div>
              <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                {c.country && <span style={{ fontSize: '10px', color: '#475569', background: '#F1F5F9', borderRadius: '6px', padding: '1px 6px' }}>{c.country}</span>}
                {c.assigned_to && <span style={{ fontSize: '10px', color: '#3730A3', background: '#E0E7FF', borderRadius: '6px', padding: '1px 6px' }}>{repName(c.assigned_to)}</span>}
                {!c.student_id && !c.is_group && <span style={{ fontSize: '10px', color: '#B45309', background: '#FEF3C7', borderRadius: '6px', padding: '1px 6px' }}>new</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ margin: 'auto', color: '#9CA3AF', fontSize: '14px' }}>Select a conversation</div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#0F172A' }}>{selected.is_group ? '👥 ' : ''}{selected.name || selected.phone}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{selected.phone}{selected.country ? ` · ${selected.country}` : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select value={selected.assigned_to ?? ''} onChange={e => setAssignee(selected.id, e.target.value)} style={sel} title="Assign to">
                  <option value="">Unassigned</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select value={selected.status} onChange={e => setStatus(selected.id, e.target.value)} style={sel} title="Status">
                  <option value="open">Open</option><option value="pending">Pending</option><option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Customer CRM context */}
            {student ? (
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', background: '#FCFCFD', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={`${rolePrefix}/students/${student.id}/edit`} style={{ fontSize: '12px', fontWeight: 700, color: '#0D1B2A', textDecoration: 'none' }}>
                  👤 {student.name} ↗
                </a>
                <span style={{ fontSize: '11px', color: '#475569' }}>
                  {Math.max(0, (student.total_paid_classes ?? 0) - (student.consumed_classes ?? 0))} classes left
                </span>
                <label style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Status
                  <select value={student.student_status ?? ''} onChange={e => saveStudent({ student_status: e.target.value })} disabled={savingCtx} style={{ ...sel, padding: '4px 6px' }}>
                    <option value="trial">Trial</option><option value="active">Active</option><option value="inactive">Inactive</option>
                  </select>
                </label>
                <label style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  Follow-up
                  <input type="date" value={student.recontact_date ?? ''} onChange={e => saveStudent({ recontact_date: e.target.value || null })} disabled={savingCtx} style={{ ...sel, padding: '4px 6px' }} />
                </label>
              </div>
            ) : !selected.is_group && (
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9', background: '#FFFBEB', fontSize: '11px', color: '#92400E' }}>
                ⚠️ Not linked to a saved customer — add them in Students (phone {selected.phone}) to track status & follow-ups.
              </div>
            )}

            <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {msgs.map(m => {
                const mediaSrc = m.media_type ? `/api/whatsapp/media/${m.id}` : null
                return (
                <div key={m.id} style={{ alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                  <div style={{ background: m.direction === 'out' ? '#0D1B2A' : '#fff', color: m.direction === 'out' ? '#fff' : '#0F172A',
                    border: m.direction === 'out' ? 'none' : '1px solid #E5E7EB', borderRadius: '12px', padding: '9px 12px', fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {mediaSrc && m.media_type === 'image' && (
                      <a href={mediaSrc} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mediaSrc} alt="photo" style={{ maxWidth: '240px', maxHeight: '280px', borderRadius: '8px', display: 'block' }} />
                      </a>
                    )}
                    {mediaSrc && m.media_type === 'audio' && (
                      <audio controls src={mediaSrc} style={{ maxWidth: '240px' }} />
                    )}
                    {mediaSrc && m.media_type === 'video' && (
                      <video controls src={mediaSrc} style={{ maxWidth: '260px', borderRadius: '8px' }} />
                    )}
                    {mediaSrc && m.media_type === 'document' && (
                      <a href={mediaSrc} target="_blank" rel="noreferrer" style={{ color: m.direction === 'out' ? '#E8C97A' : '#2563EB', fontWeight: 600 }}>📎 {m.body || 'Document'}</a>
                    )}
                    {(!m.media_type || m.media_type === 'document') ? (m.media_type === 'document' ? null : m.body)
                      : <div style={{ marginTop: m.body ? '5px' : 0, fontSize: '12px' }}>{m.body && m.body !== '📷 Photo' && m.body !== '🎤 Voice message' && m.body !== '🎥 Video' ? m.body : ''}</div>}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px', textAlign: m.direction === 'out' ? 'right' : 'left' }}>
                    {m.direction === 'out' && m.sender_name ? `${m.sender_name} · ` : ''}{fmtTime(m.created_at)}
                  </div>
                </div>
                )
              })}
            </div>

            {/* Quick replies */}
            <div style={{ padding: '8px 12px 0', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {quickReplies.map(q => (
                <button key={q.id} type="button" onClick={() => setReply(r => (r ? r + '\n' : '') + q.text)}
                  title={q.text}
                  style={{ fontSize: '11px', color: '#334155', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '4px 10px', cursor: 'pointer' }}>
                  {q.label}
                </button>
              ))}
              <button type="button" onClick={() => setManageQR(true)} title="Manage quick replies"
                style={{ fontSize: '11px', color: '#065F46', background: '#F0FDF4', border: '1px dashed #86EFAC', borderRadius: '20px', padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
                ＋ Quick reply
              </button>
            </div>

            <div style={{ padding: '12px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Type a reply…" rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit', maxHeight: '120px' }} />
              <button onClick={send} disabled={sending || !reply.trim()}
                style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending || !reply.trim() ? 0.6 : 1 }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* New group */}
      {newGroup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setNewGroup(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '4px' }}>➕ New WhatsApp group</div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 12px' }}>Your business number becomes the group admin.</p>
            <label style={{ fontSize: '11px', color: '#64748B' }}>Group name</label>
            <input value={ngName} onChange={e => setNgName(e.target.value)} placeholder="e.g. Support · Ahmed"
              style={{ width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', margin: '3px 0 10px' }} />
            <label style={{ fontSize: '11px', color: '#64748B' }}>Participant numbers (comma-separated, with country code)</label>
            <textarea value={ngNumbers} onChange={e => setNgNumbers(e.target.value)} placeholder="201001234567, 447700900123" rows={2}
              style={{ width: '100%', padding: '9px 11px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', margin: '3px 0 12px', resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setNewGroup(false)} disabled={ngBusy}
                style={{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '9px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={createGroup} disabled={ngBusy || !ngName.trim() || !ngNumbers.trim()}
                style={{ background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '9px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: (ngBusy || !ngName.trim() || !ngNumbers.trim()) ? 0.6 : 1 }}>
                {ngBusy ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage quick replies */}
      {manageQR && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setManageQR(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '460px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>⚡ Quick replies</div>
              <button onClick={() => setManageQR(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {quickReplies.map(q => (
                <div key={q.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', border: '1px solid #F1F5F9', borderRadius: '10px', padding: '9px 11px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#0F172A' }}>{q.label}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{q.text}</div>
                  </div>
                  <button onClick={() => deleteQuickReply(q.id)} title="Delete"
                    style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '7px', padding: '4px 9px', fontSize: '12px', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                </div>
              ))}
              {quickReplies.length === 0 && <div style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', padding: '12px' }}>No quick replies yet — add one below.</div>}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', background: '#FCFCFD' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '6px' }}>ADD NEW</div>
              <input value={qrLabel} onChange={e => setQrLabel(e.target.value)} placeholder="Label (e.g. 💷 Pricing)"
                style={{ width: '100%', padding: '8px 11px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
              <textarea value={qrText} onChange={e => setQrText(e.target.value)} placeholder="Message text…" rows={3}
                style={{ width: '100%', padding: '8px 11px', border: '1px solid #E2E8F0', borderRadius: '9px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              <button onClick={addQuickReply} disabled={!qrLabel.trim() || !qrText.trim()}
                style={{ marginTop: '8px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '9px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!qrLabel.trim() || !qrText.trim()) ? 0.6 : 1 }}>
                Add quick reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
