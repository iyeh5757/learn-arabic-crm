'use client'
// app/(dashboard)/sales/leads/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Every possible status value mapped to a tab ────────────────────────────
const TABS = [
  {
    key: 'new',
    label: 'New',
    statuses: ['new'],
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    key: 'attempting',
    label: 'First Call',
    statuses: ['attempting'],
    color: '#C2410C',
    bg: '#FFF7ED',
  },
  {
    key: 'interested',
    label: 'Interested',
    statuses: ['interested'],
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    key: 'price_objection',
    label: 'Price Objection',
    statuses: ['price_objection'],
    color: '#9333EA',
    bg: '#FDF4FF',
  },
  {
    key: 'partial',
    label: 'Partial',
    statuses: ['partial'],
    color: '#B45309',
    bg: '#FFFBEB',
  },
  {
    key: 'post_trial',
    label: 'Post-Trial',
    statuses: ['post_trial', 'trial_scheduled', 'trial_done'],
    color: '#D97706',
    bg: '#FFFBEB',
  },
  {
    key: 'cold',
    label: 'Cold / Lost',
    statuses: ['cold', 'not_interested'],
    color: '#6B7280',
    bg: '#F3F4F6',
  },
  {
    key: 'renewal',
    label: 'Renewals',
    statuses: ['renewal', 'converted'],
    color: '#0F766E',
    bg: '#F0FDFA',
  },
]

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  attempting: 'Attempting',
  interested: 'Interested',
  price_objection: 'Price Objection',
  partial: 'Partial',
  post_trial: 'Post-Trial',
  trial_scheduled: 'Trial Scheduled',
  trial_done: 'Trial Done',
  cold: 'Cold',
  not_interested: 'Not Interested',
  renewal: 'Renewal',
  converted: 'Converted',
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  new:             { bg: '#EFF6FF', color: '#2563EB' },
  attempting:      { bg: '#FFF7ED', color: '#C2410C' },
  interested:      { bg: '#ECFDF5', color: '#059669' },
  price_objection: { bg: '#FDF4FF', color: '#9333EA' },
  partial:         { bg: '#FFFBEB', color: '#B45309' },
  post_trial:      { bg: '#FFFBEB', color: '#D97706' },
  trial_scheduled: { bg: '#F0FDFA', color: '#0F766E' },
  trial_done:      { bg: '#F0FDF4', color: '#16A34A' },
  cold:            { bg: '#F3F4F6', color: '#6B7280' },
  not_interested:  { bg: '#FEF2F2', color: '#DC2626' },
  renewal:         { bg: '#F0FDFA', color: '#0F766E' },
  converted:       { bg: '#ECFDF5', color: '#059669' },
}

// Status options for the "Log Contact" outcome dropdown
const OUTCOME_OPTIONS = [
  { value: 'attempting',      label: 'No Answer — Try Again' },
  { value: 'interested',      label: 'Interested' },
  { value: 'price_objection', label: 'Price Objection' },
  { value: 'partial',         label: 'Partial Interest' },
  { value: 'post_trial',      label: 'Trial Booked' },
  { value: 'not_interested',  label: 'Not Interested' },
  { value: 'cold',            label: 'Mark as Cold' },
]

export default function SalesLeadsPage() {
  const [activeTab, setActiveTab]   = useState('new')
  const [leads, setLeads]           = useState<any[]>([])
  const [userId, setUserId]         = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logOpen, setLogOpen]       = useState<string | null>(null)
  const [logForm, setLogForm]       = useState({ outcome: '', note: '', whatsapp_sent: false })
  const [saving, setSaving]         = useState(false)

  // ─── Load current user then their leads ───────────────────────────────────
  const load = useCallback(async () => {
    const supabase = createClient()

    // 1. Get logged-in user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    // 2. Fetch only leads assigned to this user
    const { data, error } = await supabase
      .from('leads')
      .select(`
        id, name, email, phone, for_whom, want_to_learn,
        country, status, pipeline_stage, cold_since,
        submitted_date, created_at, updated_at,
        logs:lead_contact_logs(
          id, log_date, note, outcome, whatsapp_sent, attempt_number,
          call_1, call_2,
          agent:profiles!lead_contact_logs_agent_id_fkey(name)
        )
      `)
      .eq('assigned_to', user.id)          // ← only MY leads
      .order('updated_at', { ascending: false })

    if (error) console.error('Leads fetch error:', error)
    setLeads(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Tab counts ───────────────────────────────────────────────────────────
  const tabCounts = TABS.reduce((acc, tab) => {
    acc[tab.key] = leads.filter(l => tab.statuses.includes(l.status)).length
    return acc
  }, {} as Record<string, number>)

  const currentTab   = TABS.find(t => t.key === activeTab)!
  const visibleLeads = leads.filter(l => currentTab.statuses.includes(l.status))

  // ─── Log contact submit ───────────────────────────────────────────────────
  async function submitLog(leadId: string) {
    if (!logForm.outcome) return
    setSaving(true)
    const supabase = createClient()

    const lead = leads.find(l => l.id === leadId)
    const attemptNumber = (lead?.logs?.length ?? 0) + 1

    // Insert log
    await supabase.from('lead_contact_logs').insert({
      lead_id:        leadId,
      agent_id:       userId,
      outcome:        logForm.outcome,
      note:           logForm.note || null,
      whatsapp_sent:  logForm.whatsapp_sent,
      attempt_number: attemptNumber,
      log_date:       new Date().toISOString().split('T')[0],
    })

    // Update lead status
    const updates: any = { status: logForm.outcome, updated_at: new Date().toISOString() }
    if (logForm.outcome === 'cold') updates.cold_since = new Date().toISOString().split('T')[0]

    await supabase.from('leads').update(updates).eq('id', leadId)

    setLogOpen(null)
    setLogForm({ outcome: '', note: '', whatsapp_sent: false })
    setSaving(false)
    load()
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#6B7280' }}>
      Loading your leads…
    </div>
  )

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>My Leads</h1>
        <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
          {leads.length} lead{leads.length !== 1 ? 's' : ''} assigned to you
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px', borderBottom: '2px solid #F3F4F6', paddingBottom: '0' }}>
        {TABS.map(tab => {
          const count   = tabCounts[tab.key] ?? 0
          const isActive = tab.key === activeTab
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: isActive ? '700' : '500',
              color: isActive ? tab.color : '#6B7280',
              background: isActive ? tab.bg : 'transparent',
              border: 'none',
              borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-2px',
              transition: 'all 0.15s',
            }}>
              {tab.label}
              {count > 0 && (
                <span style={{
                  background: isActive ? tab.color : '#E5E7EB',
                  color: isActive ? '#fff' : '#374151',
                  borderRadius: '999px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: '700',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lead cards */}
      {visibleLeads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
          <div style={{ fontSize: '14px' }}>No leads in this stage</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleLeads.map(lead => {
            const sc       = STATUS_COLOR[lead.status] ?? { bg: '#F3F4F6', color: '#374151' }
            const lastLog  = lead.logs?.sort((a: any, b: any) =>
              new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
            )[0]
            const isExpanded = expandedId === lead.id
            const isLogging  = logOpen === lead.id

            return (
              <div key={lead.id} style={{
                background: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: isExpanded ? '0 4px 16px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                {/* Lead row */}
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{lead.name}</div>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                      {lead.country} · {lead.for_whom === 'child' ? '👶 For child' : '🧑 For self'} · {lead.want_to_learn}
                    </div>
                  </div>

                  {/* Contact */}
                  <div style={{ fontSize: '12px', color: '#6B7280', minWidth: '140px' }}>
                    {lead.phone && <div>📞 {lead.phone}</div>}
                    {lead.email && <div style={{ marginTop: '2px' }}>✉️ {lead.email}</div>}
                  </div>

                  {/* Status badge */}
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: sc.bg,
                    color: sc.color,
                    whiteSpace: 'nowrap',
                  }}>
                    {STATUS_LABEL[lead.status] ?? lead.status}
                  </span>

                  {/* Attempts */}
                  <div style={{ fontSize: '11px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                    {lead.logs?.length ?? 0} attempt{lead.logs?.length !== 1 ? 's' : ''}
                  </div>

                  {/* Last contact */}
                  <div style={{ fontSize: '11px', color: '#9CA3AF', minWidth: '80px', textAlign: 'right' }}>
                    {lastLog
                      ? new Date(lastLog.log_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : 'Never contacted'}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : lead.id)} style={{
                      padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                      background: '#F3F4F6', color: '#374151',
                      border: 'none', borderRadius: '7px', cursor: 'pointer',
                    }}>
                      {isExpanded ? 'Close' : 'View'}
                    </button>
                    <button onClick={() => { setLogOpen(isLogging ? null : lead.id); setExpandedId(lead.id) }} style={{
                      padding: '5px 12px', fontSize: '11px', fontWeight: '600',
                      background: '#2563EB', color: '#fff',
                      border: 'none', borderRadius: '7px', cursor: 'pointer',
                    }}>
                      Log Contact
                    </button>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #F3F4F6', padding: '16px 18px', background: '#FAFAFA' }}>

                    {/* Log contact form */}
                    {isLogging && (
                      <div style={{
                        background: '#fff', border: '1px solid #E5E7EB',
                        borderRadius: '10px', padding: '16px', marginBottom: '16px',
                      }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', marginBottom: '12px', color: '#111827' }}>
                          Log Contact Attempt #{(lead.logs?.length ?? 0) + 1}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <div style={{ flex: 1, minWidth: '180px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '4px' }}>OUTCOME *</label>
                            <select
                              value={logForm.outcome}
                              onChange={e => setLogForm(f => ({ ...f, outcome: e.target.value }))}
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '7px', background: '#fff' }}
                            >
                              <option value=''>Select outcome…</option>
                              {OUTCOME_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 2, minWidth: '200px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', display: 'block', marginBottom: '4px' }}>NOTE</label>
                            <input
                              value={logForm.note}
                              onChange={e => setLogForm(f => ({ ...f, note: e.target.value }))}
                              placeholder='What did they say?'
                              style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '7px' }}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer' }}>
                            <input
                              type='checkbox'
                              checked={logForm.whatsapp_sent}
                              onChange={e => setLogForm(f => ({ ...f, whatsapp_sent: e.target.checked }))}
                            />
                            WhatsApp message sent
                          </label>
                          <button onClick={() => submitLog(lead.id)} disabled={!logForm.outcome || saving} style={{
                            padding: '7px 18px', fontSize: '12px', fontWeight: '600',
                            background: logForm.outcome ? '#2563EB' : '#E5E7EB',
                            color: logForm.outcome ? '#fff' : '#9CA3AF',
                            border: 'none', borderRadius: '7px', cursor: logForm.outcome ? 'pointer' : 'default',
                          }}>
                            {saving ? 'Saving…' : 'Save Log'}
                          </button>
                          <button onClick={() => setLogOpen(null)} style={{
                            padding: '7px 14px', fontSize: '12px', background: 'transparent',
                            color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: '7px', cursor: 'pointer',
                          }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {/* Lead details */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                      {[
                        { label: 'Email', value: lead.email },
                        { label: 'Phone', value: lead.phone },
                        { label: 'Country', value: lead.country },
                        { label: 'For Whom', value: lead.for_whom === 'child' ? 'Child' : 'Self' },
                        { label: 'Wants to Learn', value: lead.want_to_learn },
                        { label: 'Submitted', value: lead.submitted_date ? new Date(lead.submitted_date).toLocaleDateString('en-GB') : '—' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: '13px', color: '#111827' }}>{value || '—'}</div>
                        </div>
                      ))}
                    </div>

                    {/* Contact log history */}
                    {lead.logs?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          Contact History ({lead.logs.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {[...lead.logs]
                            .sort((a: any, b: any) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime())
                            .map((log: any) => {
                              const lsc = STATUS_COLOR[log.outcome] ?? { bg: '#F3F4F6', color: '#374151' }
                              return (
                                <div key={log.id} style={{
                                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                                  padding: '8px 12px', background: '#fff',
                                  border: '1px solid #F3F4F6', borderRadius: '8px', flexWrap: 'wrap',
                                }}>
                                  <div style={{ fontSize: '11px', color: '#9CA3AF', whiteSpace: 'nowrap', minWidth: '80px' }}>
                                    {new Date(log.log_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                                  </div>
                                  <span style={{
                                    padding: '1px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '700',
                                    background: lsc.bg, color: lsc.color, whiteSpace: 'nowrap',
                                  }}>
                                    {STATUS_LABEL[log.outcome] ?? log.outcome}
                                  </span>
                                  {log.whatsapp_sent && (
                                    <span style={{ background: '#ECFDF5', color: '#059669', padding: '1px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: '600' }}>
                                      WhatsApp ✓
                                    </span>
                                  )}
                                  {log.note && (
                                    <div style={{ flex: 1, fontSize: '12px', color: '#374151', fontStyle: 'italic', minWidth: '160px' }}>
                                      "{log.note}"
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
