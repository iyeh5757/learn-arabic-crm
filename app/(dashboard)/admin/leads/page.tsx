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
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [{ data: l }, { data: a }] = await Promise.all([
      supabase.from('leads')
        .select('*, assigned_agent:profiles!leads_assigned_to_fkey(id, name), logs:lead_contact_logs(id, log_date, note, attempt_number)')
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
    setLeads(prev => prev.map(l => l.id === leadId
      ? { ...l, assigned_agent: agents.find(a => a.id === agentId) || null }
      : l
    ))
    setAssigning(null)
  }

  const filtered = leads.filter(l => {
    if (filter.status && l.status !== filter.status) return false
    if (filter.agent && l.assigned_to !== filter.agent) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (!l.name?.toLowerCase().includes(q) && !l.email?.toLowerCase().includes(q) && !l.phone?.includes(q)) return false
    }
    return true
  })

  // Stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    attempting: leads.filter(l => l.status === 'attempting').length,
    cold: leads.filter(l => l.status === 'cold').length,
    converted: leads.filter(l => l.status === 'converted').length,
    trial: leads.filter(l => l.status === 'trial_scheduled').length,
    reflag: leads.filter(l => l.status === 'cold' && l.cold_since && (new Date().getTime() - new Date(l.cold_since).getTime()) >= 7 * 86400000).length,
  }

  if (loading) return <div style={{ padding: '32px', color: '#6B7280' }}>Loading leads…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>Leads Pipeline</h1>
        <a href="/admin/leads/upload" style={{ padding: '10px 20px', background: '#0D1B2A', color: '#E8C97A', borderRadius: '10px', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}>
          + Upload Leads
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total', value: stats.total, color: '#2563EB' },
          { label: 'New', value: stats.new, color: '#0891B2' },
          { label: 'In Pipeline', value: stats.attempting, color: '#D97706' },
          { label: 'Trials', value: stats.trial, color: '#0F766E' },
          { label: 'Converted', value: stats.converted, color: '#059669' },
          { label: 'Cold', value: stats.cold, color: '#6B7280' },
          { label: '⚑ Re-flag', value: stats.reflag, color: '#DC2626' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
          <option value="unassigned">Unassigned</option>
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
                {['Name','Phone','Country','Wants','For','Status','Stage','Agent','Last Contact','Actions'].map(h => (
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
                const lastLog = lead.logs?.sort((a: any, b: any) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime())[0]
                const isColdReflag = lead.status === 'cold' && lead.cold_since && (new Date().getTime() - new Date(lead.cold_since).getTime()) >= 7 * 86400000
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid #F3F4F6', background: isColdReflag ? '#FEF2F2' : 'transparent' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{lead.name}</div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{lead.email || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{lead.phone || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#374151' }}>{lead.country || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#374151' }}>{lead.want_to_learn || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#374151' }}>{lead.for_whom || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: sc.bg, color: sc.text, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {isColdReflag ? '⚑ Re-flag' : lead.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#6B7280' }}>
                      {STAGE_LABELS[lead.pipeline_stage] ?? `Stage ${lead.pipeline_stage}`}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {assigning === lead.id ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <select defaultValue={lead.assigned_to || ''}
                            onChange={e => handleAssign(lead.id, e.target.value)}
                            style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: '6px' }}>
                            <option value="">Unassigned</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          <button onClick={() => setAssigning(null)} style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setAssigning(lead.id)}
                          style={{ fontSize: '12px', color: lead.assigned_agent ? '#374151' : '#DC2626', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                          {lead.assigned_agent?.name || '⚑ Unassigned'}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '11px', color: '#9CA3AF' }}>
                      {lastLog ? (
                        <div>
                          <div>{new Date(lastLog.log_date).toLocaleDateString()}</div>
                          {lastLog.note && <div style={{ color: '#6B7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastLog.note}</div>}
                        </div>
                      ) : 'Never'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <a href={`/admin/leads/${lead.id}`}
                          style={{ padding: '4px 10px', background: '#EFF6FF', color: '#2563EB', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }}>
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
