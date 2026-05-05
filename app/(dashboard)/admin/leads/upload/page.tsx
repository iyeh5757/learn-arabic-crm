'use client'
// app/(dashboard)/admin/leads/upload/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const HEADERS = ['Created', 'Name', 'Email address', 'Phone', 'For whom', 'Want to Learn', 'Country']

function parseDateSafe(raw: string): string | null {
  if (!raw) return null
  // Handle formats like "04/21/2026 7:33pm" or "04/21/2026 10:03am"
  // Try standard parse first
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toISOString()
  // Try MM/DD/YYYY HH:MMam/pm
  const match = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(am|pm)?/i)
  if (match) {
    let [, month, day, year, hour, min, ampm] = match
    let h = parseInt(hour)
    if (ampm?.toLowerCase() === 'pm' && h < 12) h += 12
    if (ampm?.toLowerCase() === 'am' && h === 12) h = 0
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(min))
    if (!isNaN(date.getTime())) return date.toISOString()
  }
  return null
}

function parseExcelPaste(text: string) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  const rows: any[] = []
  const errors: string[] = []

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]
    // Split by tab (Excel copy-paste format)
    const cells = line.split('\t').map(c => c.trim())

    // Skip header rows
    if (
      cells[0]?.toLowerCase().includes('created') ||
      cells[1]?.toLowerCase() === 'name' ||
      cells[0]?.toLowerCase() === 'date'
    ) continue

    // Need at least name
    if (!cells[1]?.trim()) continue

    // If only 1 cell found (no tabs), data may be space-separated - skip
    if (cells.length < 3) {
      errors.push(`Row ${lineNum + 1}: Could not parse (no tab separators found). Make sure to copy from Excel, not a PDF or text file.`)
      continue
    }

    rows.push({
      submitted_date: parseDateSafe(cells[0]),
      name: cells[1] || '',
      email: cells[2] || null,
      phone: cells[3] || null,
      for_whom: cells[4]?.trim() === 'ME' || cells[4]?.trim() === 'Me' ? 'ME' :
                cells[4]?.trim() === 'Child' ? 'Child' : null,
      want_to_learn: cells[5] || null,
      country: cells[6] || null,
    })
  }
  return { rows, errors }
}

export default function LeadsUploadPage() {
  const [pasteText, setPasteText] = useState('')
  const [preview, setPreview] = useState<any[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [assignTo, setAssignTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().from('profiles').select('id, name')
      .eq('role', 'sales').eq('is_active', true)
      .then(({ data }) => setAgents(data ?? []))
  }, [])

  function handleParse() {
    setError(''); setResult('')
    if (!pasteText.trim()) { setError('Please paste your data first.'); return }

    const { rows, errors } = parseExcelPaste(pasteText)
    setParseErrors(errors)

    if (!rows.length) {
      setError('No valid rows found. Make sure you copy directly from Excel (not a PDF or plain text) so the columns are separated by tabs.')
      setPreview([])
      return
    }
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
    setResult(`✅ Successfully imported ${json.count} leads${assignTo ? ' and assigned to agent' : ' (unassigned)'}.`)
    setPasteText(''); setPreview([]); setParseErrors([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827' }}>Upload Leads</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', marginTop: '4px' }}>
          In Excel: select all rows including the header → Ctrl+C → paste below.
        </p>
      </div>

      {/* Step 1 */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ fontWeight: '700', color: '#111827', marginBottom: '8px' }}>Step 1 — Paste from Excel</h3>
        <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '12px' }}>
          Expected columns: <strong>Created | Name | Email address | Phone | For whom | Want to Learn | Country</strong>
        </p>
        <textarea
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); setPreview([]); setError('') }}
          placeholder={'Paste Excel rows here...\nExample:\n04/21/2026 7:33pm\tmohammed abo ceesay\temail@gmail.com\t306939558943\tMe\tLevantine\tEU'}
          style={{ width: '100%', height: '200px', padding: '12px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <button
          onClick={handleParse}
          disabled={!pasteText.trim()}
          style={{ marginTop: '12px', padding: '10px 24px', background: '#0D1B2A', color: '#E8C97A', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: pasteText.trim() ? 'pointer' : 'not-allowed', opacity: pasteText.trim() ? 1 : 0.5 }}>
          Parse &amp; Preview
        </button>

        {error && (
          <div style={{ marginTop: '12px', padding: '12px 16px', background: '#FEF2F2', color: '#DC2626', borderRadius: '10px', fontSize: '13px' }}>
            ❌ {error}
          </div>
        )}
        {parseErrors.length > 0 && (
          <div style={{ marginTop: '10px', padding: '10px 14px', background: '#FFFBEB', color: '#B45309', borderRadius: '8px', fontSize: '12px' }}>
            ⚠️ {parseErrors.length} row(s) skipped: {parseErrors[0]}
          </div>
        )}
      </div>

      {/* Step 2 Preview */}
      {preview.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontWeight: '700', color: '#111827' }}>Step 2 — Preview ({preview.length} rows)</h3>
            <span style={{ background: '#ECFDF5', color: '#059669', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
              {preview.length} leads ready
            </span>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '20px', border: '1px solid #F3F4F6', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {HEADERS.map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 15).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>
                      {row.submitted_date ? new Date(row.submitted_date).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374151', fontWeight: '500' }}>{row.name || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{row.email || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{row.phone || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{row.for_whom || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{row.want_to_learn || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{row.country || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 15 && (
              <div style={{ padding: '10px 12px', color: '#9CA3AF', fontSize: '12px', textAlign: 'center' }}>
                ...and {preview.length - 15} more rows
              </div>
            )}
          </div>

          {/* Step 3 */}
          <h3 style={{ fontWeight: '700', color: '#111827', marginBottom: '12px' }}>Step 3 — Assign &amp; Import</h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Assign to Sales Agent (optional)
              </label>
              <select
                value={assignTo}
                onChange={e => setAssignTo(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '13px' }}>
                <option value="">Leave unassigned (assign later)</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button
              onClick={handleImport}
              disabled={loading}
              style={{ padding: '11px 28px', background: '#059669', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Importing…' : `Import ${preview.length} Leads`}
            </button>
          </div>

          {result && (
            <div style={{ marginTop: '16px', padding: '14px 18px', background: '#ECFDF5', color: '#065F46', borderRadius: '10px', fontSize: '14px', fontWeight: '500' }}>
              {result}
            </div>
          )}
          {error && (
            <div style={{ marginTop: '12px', padding: '12px 16px', background: '#FEF2F2', color: '#DC2626', borderRadius: '10px', fontSize: '13px' }}>
              ❌ {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
