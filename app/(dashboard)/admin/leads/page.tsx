'use client'
// app/(dashboard)/admin/leads/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new:             { bg: '#EFF6FF', text: '#2563EB' },
  attempting:      { bg: '#FFF7ED', text: '#C2410C' },
  partial:         { bg: '#FFFBEB', text: '#B45309' },
  interested:      { bg: '#ECFDF5', text: '#059669' },
  trial_scheduled: { bg: '#F0FDFA', text: '#0F766E' },
  trial_done:      { bg: '#F0FDF4', text: '#16A34A' },
  post_trial:      { bg: '#FFFBEB', text: '#D97706' },
  not_interested:  { bg: '#FEF2F2', text: '#DC2626' },
  price_objection: { bg: '#FDF4FF', text: '#9333EA' },
  cold:            { bg: '#F3F4F6', text: '#6B7280' },
  converted:       { bg: '#ECFDF5', text: '#059669' },
}

const STAGE_LABELS: Record<number, string> = {
  0: 'New', 1: 'First Call', 2: '1st Follow Up', 3: '2nd Follow Up', 4: '3rd Follow Up'
}

export default function AdminLeadsPipelinePage() {
  const [leads, setLeads] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [filter, setFilter] = useState({ status: '', agent: '', search: '' })
  const [assigning, setAssigning] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [{ data: l }, { data: a }] = await Promise.all([
      supabase.from('leads')
        .select('*, assigned_agent:profiles!leads_assigned_to_fkey(id, name), logs:lead_contact_logs(id, log_date, note, attempt_number, call_1, call_2, whatsapp_sent)')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, name').eq('role', 'sales').eq('is_active', true),
    ])
    setLeads(l ?? [])
    setAgents(a ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAssign(leadId: string, agentId: string) {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: agentId || null }),
    })
    setAssigning(null)
    load()
  }

  async function handleDelete(leadId: string, name: string) {
    if (!confirm(`Delete lead "${name}"? This cannot be undone.`)) return
    setDeleting(leadId)
    const supabase = createClient()
    await supabase.from('lead_contact_logs').delete().eq('lead_id', leadId)
    await supabase.from('leads').delete().eq('id', leadId)
    setLeads(prev => prev.filter(l => l.id !== leadId))
    setDeleting(null)
  }

  const filtered = leads.filter(l => {
    if (filter.status && l.status !== filter.status) return false
    if (filter.agent === 'unassigned' && l.assigned_to) return false
    if (filter.agent && filter.agent !== 'unassigned' && l.assigned_to !== filter.agent) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (!l.name?.toLowerCase().includes(q) && !l.email?.toLowerCase().includes(q) && !l.phone?.includes(q)) return false
    }
    return true
  })

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    attempting: leads.filter(l => l.status === 'attempting').length,
    cold: leads.filter(l => l.status === 'cold').length,
    converted: leads.filter(l => l.status === 'converted').length,
    trial: leads.filter(l => l.status === 'trial_scheduled').length,
    unassigned: leads.filter(l => !l.assigned_to).length,
    reflag: leads.filter(l => l.status === 'cold' && l.cold_since &&
      (new Date().getTime() - new Date(l.cold_since).getTime()) >= 7 * 86400000).length,
  }

  if (loading) return <div style={{ padding: '32px', color: '#6B7280' }}>Loading leads…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>Leads Pipeline</h1>
        <a href="/admin/leads/upload" style={{ padding: '10px 20px', background: '#0D1B2A', color: '#E8C97A', borderRadius: '10px', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}>
          📤 Upload Leads
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
        {[
          { label: 'Total',      value: stats.total,      color: '#2563EB' },
          { label: 'New',        value: stats.new,        color: '#0891B2' },
          { label: 'In Pipeline',value: stats.attempting, color: '#D97706' },
          { label: 'Trials',     value: stats.trial,      color: '#0F766E' },
          { label: 'Converted',  value: stats.converted,  color: '#059669' },
          { label: 'Cold',       value: stats.cold,       color: '#6B7280' },
          { label: 'Unassigned', value: stats.unassigned, color: '#DC2626' },
          { label: '⚑ Re-flag',  value: stats.reflag,    color: '#DC2626' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: '#6B7280', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search name, email, phone…" value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          style={{ flex: 1, minWidth: '180px', padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px' }} />
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          style={{ padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px' }}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filter.agent} onChange={e => setFilter(f => ({ ...f, agent: e.target.value }))}
          style={{ padding: '8px 12px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px' }}>
          <option value="">All Agents</option>
          <option value="unassigned">⚑ Unassigned</option>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span style={{ padding: '8px 14px', background: '#F3F4F6', borderRadius: '8px', fontSize: '13px', color: '#374151', fontWeight: '600' }}>
          {filtered.length} leads
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Name','Phone','Country','Wants','For','Status','Stage','Assigned To','Last Contact','Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>No leads found</td></tr>
              )}
              {filtered.map(lead => {
                const sc = STATUS_COLORS[lead.status] ?? { bg: '#F3F4F6', text: '#374151' }
                const lastLog = lead.logs?.sort((a: any, b: any) =>
                  new Date(b.log_date).getTime() - new Date(a.log_date).getTime())[0]
                const isColdReflag = lead.status === 'cold' && lead.cold_since &&
                  (new Date().getTime() - new Date(lead.cold_since).getTime()) >= 7 * 86400000
                const isExpanded = expandedId === lead.id
                const allLogs = lead.logs?.sort((a: any, b: any) =>
                  new Date(b.log_date).getTime() - new Date(a.log_date).getTime()) ?? []

                return (
                  <>
                    <tr key={lead.id} style={{ borderBottom: isExpanded ? 'none' : '1px solid #F3F4F6', background: isColdReflag ? '#FEF9F9' : isExpanded ? '#FAFAFA' : 'transparent' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{lead.name}</div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{lead.email || ''}</div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{lead.phone || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{lead.country || '—'}</td>
                      <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                        <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                          {lead.want_to_learn || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#6B7280' }}>{lead.for_whom || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: sc.bg, color: sc.text, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {isColdReflag ? '⚑ Re-flag' : lead.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '12px', color: '#6B7280' }}>
                        {STAGE_LABELS[lead.pipeline_stage] ?? `Stage ${lead.pipeline_stage}`}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {assigning === lead.id ? (
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <select
                              defaultValue={lead.assigned_to || ''}
                              onChange={e => handleAssign(lead.id, e.target.value)}
                              style={{ fontSize: '12px', padding: '4px 8px', border: '1.5px solid #C9A84C', borderRadius: '6px' }}>
                              <option value="">Unassigned</option>
                              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <button onClick={() => setAssigning(null)}
                              style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setAssigning(lead.id)}
                            style={{ fontSize: '12px', color: lead.assigned_agent ? '#2563EB' : '#DC2626', background: lead.assigned_agent ? '#EFF6FF' : '#FEF2F2', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '600' }}>
                            {lead.assigned_agent?.name || '⚑ Assign'}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '11px', color: '#9CA3AF' }}>
                        {lastLog ? new Date(lastLog.log_date).toLocaleDateString() : 'Never'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                            style={{ padding: '5px 10px', background: isExpanded ? '#F3F4F6' : '#EFF6FF', color: isExpanded ? '#374151' : '#2563EB', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                            {isExpanded ? 'Close' : 'View'}
                          </button>
                          <button
                            onClick={() => handleDelete(lead.id, lead.name)}
                            disabled={deleting === lead.id}
                            style={{ padding: '5px 10px', background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', opacity: deleting === lead.id ? 0.5 : 1 }}>
                            {deleting === lead.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded view — contact log history */}
                    {isExpanded && (
                      <tr key={lead.id + '-expanded'}>
                        <td colSpan={10} style={{ padding: '0', background: '#FAFAFA', borderBottom: '1px solid #E5E7EB' }}>
                          <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Submitted</div>
                                <div style={{ fontSize: '13px', color: '#111827' }}>{lead.submitted_date ? new Date(lead.submitted_date).toLocaleDateString() : '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>For Whom</div>
                                <div style={{ fontSize: '13px', color: '#111827' }}>{lead.for_whom || '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Email</div>
                                <div style={{ fontSize: '13px', color: '#111827' }}>{lead.email || '—'}</div>
                              </div>
                            </div>

                            {allLogs.length === 0 ? (
                              <div style={{ color: '#9CA3AF', fontSize: '13px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
                                No contact attempts logged yet.
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: '8px' }}>Contact Log ({allLogs.length} attempts)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {allLogs.map((log: any) => (
                                    <div key={log.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                      <div style={{ minWidth: '80px' }}>
                                        <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: '600' }}>Attempt {log.attempt_number}</div>
                                        <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600' }}>{new Date(log.log_date).toLocaleDateString()}</div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ background: log.call_1 === 'answered' ? '#ECFDF5' : log.call_1 === 'no_answer' ? '#FEF2F2' : '#F3F4F6', color: log.call_1 === 'answered' ? '#059669' : log.call_1 === 'no_answer' ? '#DC2626' : '#6B7280', padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                                          Call 1: {log.call_1?.replace('_', ' ') || '—'}
                                        </span>
                                        <span style={{ background: log.call_2 === 'answered' ? '#ECFDF5' : log.call_2 === 'no_answer' ? '#FEF2F2' : '#F3F4F6', color: log.call_2 === 'answered' ? '#059669' : log.call_2 === 'no_answer' ? '#DC2626' : '#6B7280', padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                                          Call 2: {log.call_2?.replace('_', ' ') || '—'}
                                        </span>
                                        {log.whatsapp_sent && (
                                          <span style={{ background: '#ECFDF5', color: '#059669', padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                                            WhatsApp ✓
                                          </span>
                                        )}
                                      </div>
                                      {log.note && (
                                        <div style={{ flex: 1, minWidth: '200px', fontSize: '12px', color: '#374151', fontStyle: 'italic' }}>
                                          "{log.note}"
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
