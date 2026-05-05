'use client'
// app/(dashboard)/sales/leads/page.tsx
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const TABS = [
  { key: 'new',        label: 'New',          stage: 0,    statuses: ['new'] },
  { key: 'first_call', label: 'First Call',   stage: 1,    statuses: ['attempting'] },
  { key: 'fu1',        label: '1st Follow Up',stage: 2,    statuses: ['attempting'] },
  { key: 'fu2',        label: '2nd Follow Up',stage: 3,    statuses: ['attempting'] },
  { key: 'fu3',        label: '3rd Follow Up',stage: 4,    statuses: ['attempting'] },
  { key: 'partial',    label: 'Partial',      stage: null, statuses: ['partial'] },
  { key: 'post_trial', label: 'Post-Trial',   stage: null, statuses: ['post_trial','trial_done'] },
  { key: 'cold',       label: 'Cold',         stage: null, statuses: ['cold'] },
  { key: 'renewals',   label: 'Renewals',     stage: null, statuses: null }, // special
]

const OUTCOME_OPTIONS = [
  { value: '', label: '— No status change —' },
  { value: 'partial', label: 'Partially responded (went quiet)' },
  { value: 'interested', label: 'Interested — in conversation' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'price_objection', label: 'Price Objection' },
  { value: 'convert_trial', label: '🎯 Move to Trial' },
]

const LESSON_OPTIONS = ['Egyptian','Gulf','Levantine','MSA','Quran','Islamic and Tajweed']
const CURRENCY_OPTIONS = ['USD','GBP','EUR','AED']

function ContactPanel({ lead, teachers, onSave, onClose }: any) {
  const [form, setForm] = useState({
    call_1: 'not_done', call_2: 'not_done', whatsapp_sent: false,
    note: lead.last_note || '', outcome: '',
    teacher_id: '', trial_date: '', trial_time: '', session_duration: 60, currency: 'USD',
  })
  const [saving, setSaving] = useState(false)

  const nextStage = Math.min((lead.pipeline_stage ?? 0) + 1, 5)
  const isAttempt5 = (lead.pipeline_stage ?? 0) >= 4

  async function handleSave() {
    setSaving(true)
    const isTrialConvert = form.outcome === 'convert_trial'

    if (isTrialConvert) {
      if (!form.teacher_id || !form.trial_date) {
        alert('Please select a teacher and trial date before converting.')
        setSaving(false); return
      }
      await fetch(`/api/leads/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'convert_trial', ...form }),
      })
    } else {
      const noAnswer = form.call_1 === 'no_answer' && form.call_2 === 'no_answer'
      const newStage = noAnswer && !form.outcome ? (isAttempt5 ? lead.pipeline_stage : nextStage) : lead.pipeline_stage
      const newStatus = form.outcome || (noAnswer && isAttempt5 ? 'cold' : noAnswer ? 'attempting' : lead.status)
      await fetch(`/api/leads/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_number: (lead.pipeline_stage ?? 0) + 1,
          call_1: form.call_1, call_2: form.call_2,
          whatsapp_sent: form.whatsapp_sent, note: form.note,
          new_status: newStatus, new_stage: newStage,
        }),
      })
    }
    setSaving(false)
    onSave()
  }

  return (
    <tr>
      <td colSpan={8} style={{ padding: '0', background: '#F8FAFC' }}>
        <div style={{ padding: '20px 24px', borderTop: '2px solid #C9A84C', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Call 1 */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '6px' }}>Call 1</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['answered','no_answer','not_done'].map(v => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, call_1: v }))}
                    style={{ flex: 1, padding: '7px 4px', fontSize: '11px', fontWeight: '600', borderRadius: '8px', border: '1.5px solid', cursor: 'pointer',
                      background: form.call_1 === v ? (v === 'answered' ? '#059669' : v === 'no_answer' ? '#DC2626' : '#6B7280') : '#fff',
                      color: form.call_1 === v ? '#fff' : '#374151',
                      borderColor: form.call_1 === v ? 'transparent' : '#E5E7EB' }}>
                    {v === 'answered' ? '✓ Ans' : v === 'no_answer' ? '✕ NA' : 'Skip'}
                  </button>
                ))}
              </div>
            </div>
            {/* Call 2 */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '6px' }}>Call 2</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['answered','no_answer','not_done'].map(v => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, call_2: v }))}
                    style={{ flex: 1, padding: '7px 4px', fontSize: '11px', fontWeight: '600', borderRadius: '8px', border: '1.5px solid', cursor: 'pointer',
                      background: form.call_2 === v ? (v === 'answered' ? '#059669' : v === 'no_answer' ? '#DC2626' : '#6B7280') : '#fff',
                      color: form.call_2 === v ? '#fff' : '#374151',
                      borderColor: form.call_2 === v ? 'transparent' : '#E5E7EB' }}>
                    {v === 'answered' ? '✓ Ans' : v === 'no_answer' ? '✕ NA' : 'Skip'}
                  </button>
                ))}
              </div>
            </div>
            {/* WhatsApp */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '6px' }}>WhatsApp</label>
              <button onClick={() => setForm(f => ({ ...f, whatsapp_sent: !f.whatsapp_sent }))}
                style={{ width: '100%', padding: '7px', fontSize: '12px', fontWeight: '600', borderRadius: '8px', border: '1.5px solid', cursor: 'pointer',
                  background: form.whatsapp_sent ? '#059669' : '#fff', color: form.whatsapp_sent ? '#fff' : '#374151',
                  borderColor: form.whatsapp_sent ? 'transparent' : '#E5E7EB' }}>
                {form.whatsapp_sent ? '✓ Sent' : 'Mark Sent'}
              </button>
            </div>
            {/* Outcome */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '6px' }}>Outcome / Status</label>
              <select value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }}>
                {OUTCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Note */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '6px' }}>Note (add to log)</label>
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="What happened? Any discount offered? Customer's objection?..."
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', minHeight: '70px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>

          {/* Trial conversion fields */}
          {form.outcome === 'convert_trial' && (
            <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontWeight: '700', color: '#0F766E', marginBottom: '12px', fontSize: '13px' }}>🎯 Trial Booking — Complete All Fields</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '5px' }}>Teacher *</label>
                  <select value={form.teacher_id} onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }}>
                    <option value="">Select teacher</option>
                    {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.profile?.name || t.id}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '5px' }}>Trial Date *</label>
                  <input type="date" value={form.trial_date} onChange={e => setForm(f => ({ ...f, trial_date: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '5px' }}>Trial Time</label>
                  <input type="time" value={form.trial_time} onChange={e => setForm(f => ({ ...f, trial_time: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '5px' }}>Duration</label>
                  <select value={form.session_duration} onChange={e => setForm(f => ({ ...f, session_duration: Number(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }}>
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: '5px' }}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: '8px', fontSize: '12px' }}>
                    {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '9px 24px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
              {saving ? 'Saving…' : form.outcome === 'convert_trial' ? '🎯 Create Trial' : 'Save Log'}
            </button>
            <button onClick={onClose}
              style={{ padding: '9px 18px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            {form.call_1 === 'no_answer' && form.call_2 === 'no_answer' && !form.outcome && (
              <span style={{ padding: '9px 14px', background: '#FFF7ED', color: '#C2410C', borderRadius: '10px', fontSize: '12px', fontWeight: '600' }}>
                Both calls no answer → will move to {isAttempt5 ? 'Cold Leads' : TABS[(lead.pipeline_stage ?? 0) + 1]?.label}
              </span>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

export default function SalesLeadsPage() {
  const [activeTab, setActiveTab] = useState('new')
  const [leads, setLeads] = useState<any[]>([])
  const [renewals, setRenewals] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [openLog, setOpenLog] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const [{ data: l }, { data: t }, { data: r }] = await Promise.all([
      supabase.from('leads')
        .select('*, logs:lead_contact_logs(id, log_date, note, attempt_number, call_1, call_2, whatsapp_sent)')
        .order('created_at', { ascending: false }),
      supabase.from('teachers').select('id, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true),
      supabase.from('students')
        .select('id, name, phone, country, student_status, total_paid_classes, consumed_classes, added_by_sales_id')
        .in('student_status', ['inactive'])
        .or('total_paid_classes.eq.consumed_classes'),
    ])

    setLeads(l ?? [])
    setTeachers(t ?? [])
    setRenewals(r ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const tab = TABS.find(t => t.key === activeTab)!

  let tabLeads: any[] = []
  if (activeTab === 'renewals') {
    tabLeads = renewals
  } else if (tab.stage !== null) {
    tabLeads = leads.filter(l => l.pipeline_stage === tab.stage && tab.statuses!.includes(l.status))
  } else {
    tabLeads = leads.filter(l => tab.statuses!.includes(l.status))
  }

  // Cold re-flag
  const coldReflag = leads.filter(l => l.status === 'cold' && l.cold_since &&
    (new Date().getTime() - new Date(l.cold_since).getTime()) >= 7 * 86400000)

  function getLastLog(lead: any) {
    if (!lead.logs?.length) return null
    return lead.logs.sort((a: any, b: any) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime())[0]
  }

  if (loading) return <div style={{ padding: '32px', color: '#6B7280' }}>Loading leads…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>My Leads</h1>
          <p style={{ color: '#6B7280', fontSize: '13px', marginTop: '2px' }}>{leads.length} total leads assigned to you</p>
        </div>
        {coldReflag.length > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px 16px', color: '#DC2626', fontSize: '13px', fontWeight: '600' }}>
            ⚑ {coldReflag.length} cold leads ready to re-contact
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '5px', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        {TABS.map(t => {
          let count = 0
          if (t.key === 'renewals') count = renewals.length
          else if (t.stage !== null) count = leads.filter(l => l.pipeline_stage === t.stage && t.statuses!.includes(l.status)).length
          else count = leads.filter(l => t.statuses!.includes(l.status)).length

          return (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setOpenLog(null) }}
              style={{ flex: 1, minWidth: '100px', padding: '9px 10px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.15s',
                background: activeTab === t.key ? '#0D1B2A' : 'transparent',
                color: activeTab === t.key ? '#E8C97A' : '#6B7280' }}>
              {t.label}
              {count > 0 && (
                <span style={{ marginLeft: '5px', background: activeTab === t.key ? 'rgba(201,168,76,0.3)' : '#F3F4F6', color: activeTab === t.key ? '#E8C97A' : '#374151', padding: '1px 7px', borderRadius: '20px', fontSize: '11px' }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }}>
        {tabLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>
              {activeTab === 'cold' ? '❄️' : activeTab === 'renewals' ? '🔄' : '✅'}
            </div>
            <p style={{ fontSize: '15px', fontWeight: '600', color: '#6B7280' }}>
              {activeTab === 'cold' ? 'No cold leads right now' : activeTab === 'renewals' ? 'No inactive students' : 'All clear in this stage!'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Name','Phone','Country','Wants to Learn','For','Last Contact','Note','Action'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabLeads.map((lead: any) => {
                  const lastLog = activeTab !== 'renewals' ? getLastLog(lead) : null
                  const isOpen = openLog === lead.id
                  const isColdReflag = lead.status === 'cold' && lead.cold_since &&
                    (new Date().getTime() - new Date(lead.cold_since).getTime()) >= 7 * 86400000
                  return (
                    <>
                      <tr key={lead.id} style={{ borderBottom: isOpen ? 'none' : '1px solid #F3F4F6', background: isColdReflag ? '#FFF8F8' : isOpen ? '#FFFBEB' : 'transparent' }}>
                        <td style={{ padding: '13px 14px' }}>
                          <div style={{ fontWeight: '600', color: '#111827', fontSize: '13px' }}>{lead.name}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{lead.email || ''}</div>
                        </td>
                        <td style={{ padding: '13px 14px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                          {lead.phone ? (
                            <a href={`tel:${lead.phone}`} style={{ color: '#2563EB', textDecoration: 'none' }}>{lead.phone}</a>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '13px 14px', fontSize: '13px', color: '#374151' }}>{lead.country || '—'}</td>
                        <td style={{ padding: '13px 14px', fontSize: '12px', color: '#374151' }}>
                          <span style={{ background: '#EFF6FF', color: '#2563EB', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                            {lead.want_to_learn || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '13px 14px', fontSize: '12px', color: '#6B7280' }}>{lead.for_whom || '—'}</td>
                        <td style={{ padding: '13px 14px', fontSize: '12px', color: '#9CA3AF' }}>
                          {lastLog ? new Date(lastLog.log_date).toLocaleDateString() : 'Never'}
                          {isColdReflag && <div style={{ color: '#DC2626', fontWeight: '600', fontSize: '11px' }}>⚑ Ready to re-contact</div>}
                        </td>
                        <td style={{ padding: '13px 14px', maxWidth: '180px' }}>
                          <div style={{ fontSize: '12px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lastLog?.note || '—'}
                          </div>
                        </td>
                        <td style={{ padding: '13px 14px' }}>
                          <button
                            onClick={() => setOpenLog(isOpen ? null : lead.id)}
                            style={{ padding: '7px 16px', background: isOpen ? '#FEF2F2' : '#0D1B2A', color: isOpen ? '#DC2626' : '#E8C97A', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {isOpen ? '✕ Close' : '📝 Log Contact'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <ContactPanel
                          lead={{ ...lead, last_note: lastLog?.note || '' }}
                          teachers={teachers}
                          onSave={() => { setOpenLog(null); load() }}
                          onClose={() => setOpenLog(null)}
                        />
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
