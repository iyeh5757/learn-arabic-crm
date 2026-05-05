'use client'
// app/(dashboard)/admin/leads/upload/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const COLUMNS = ['submitted_date','name','email','phone','for_whom','want_to_learn','country']
const HEADERS = ['Created','Name','Email address','Phone','For whom','Want to Learn','Country']

function parseExcelPaste(text: string) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const rows: any[] = []
  for (const line of lines) {
    const cells = line.split('\t').map(c => c.trim())
    // Skip header row
    if (cells[0].toLowerCase().includes('created') || cells[1]?.toLowerCase() === 'name') continue
    if (cells.length < 2 || !cells[1]) continue
    rows.push({
      submitted_date: cells[0] ? new Date(cells[0]).toISOString() : null,
      name:           cells[1] || '',
      email:          cells[2] || null,
      phone:          cells[3] || null,
      for_whom:       cells[4] === 'ME' ? 'ME' : cells[4] === 'Child' ? 'Child' : null,
      want_to_learn:  cells[5] || null,
      country:        cells[6] || null,
    })
  }
  return rows
}

export default function LeadsUploadPage() {
  const [pasteText, setPasteText] = useState('')
  const [preview, setPreview] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [assignTo, setAssignTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().from('profiles').select('id, name').eq('role', 'sales').eq('is_active', true)
      .then(({ data }) => setAgents(data ?? []))
  }, [])

  function handleParse() {
    setError('')
    const rows = parseExcelPaste(pasteText)
    if (!rows.length) { setError('No valid rows found. Make sure you copy directly from Excel including headers.'); return }
    setPreview(rows)
  }

  async function handleImport() {
    if (!preview.length) return
    setLoading(true); setError(''); setResult('')
    const res = await fetch('/api/leads/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: preview, assigned_to: assignTo || null }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || 'Import failed'); return }
    setResult(`✅ Successfully imported ${json.count} leads${assignTo ? ` and assigned to agent` : ' (unassigned)'}.`)
    setPasteText(''); setPreview([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>Upload Leads</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>Copy rows from Excel and paste below. Include the header row.</p>
      </div>

      {/* Step 1: Paste */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ fontWeight: '700', color: '#111827', marginBottom: '8px' }}>Step 1 — Paste from Excel</h3>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
          Expected columns: <strong>Created | Name | Email address | Phone | For whom | Want to Learn | Country</strong>
        </p>
        <textarea
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); setPreview([]) }}
          placeholder="Paste Excel rows here (Ctrl+A in Excel → Ctrl+C → paste here)..."
          style={{ width: '100%', height: '160px', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <button onClick={handleParse} disabled={!pasteText.trim()}
          style={{ marginTop: '12px', padding: '10px 24px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer' }}>
          Parse & Preview
        </button>
        {error && <div style={{ marginTop: '10px', padding: '10px 14px', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', fontSize: '13px' }}>{error}</div>}
      </div>

      {/* Step 2: Preview */}
      {preview.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontWeight: '700', color: '#111827' }}>Step 2 — Preview ({preview.length} rows)</h3>
            <span style={{ background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
              {preview.length} leads ready
            </span>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {HEADERS.map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    {COLUMNS.map(col => (
                      <td key={col} style={{ padding: '8px 12px', color: '#374151' }}>
                        {col === 'submitted_date' && row[col] ? new Date(row[col]).toLocaleDateString() : (row[col] || '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && <p style={{ marginTop: '8px', color: '#6B7280', fontSize: '12px' }}>…and {preview.length - 10} more rows</p>}
          </div>

          {/* Step 3: Assign + Import */}
          <h3 style={{ fontWeight: '700', color: '#111827', marginBottom: '12px' }}>Step 3 — Assign & Import</h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Assign to Sales Agent (optional)
              </label>
              <select value={assignTo} onChange={e => setAssignTo(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '13px' }}>
                <option value="">Leave unassigned (assign later)</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button onClick={handleImport} disabled={loading}
              style={{ padding: '10px 28px', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {loading ? 'Importing…' : `Import ${preview.length} Leads`}
            </button>
          </div>
          {result && <div style={{ marginTop: '14px', padding: '12px 16px', background: '#ECFDF5', color: '#065F46', borderRadius: '10px', fontSize: '13px', fontWeight: '500' }}>{result}</div>}
        </div>
      )}
    </div>
  )
}
