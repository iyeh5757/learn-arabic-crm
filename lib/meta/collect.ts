// lib/meta/collect.ts
// Builds Meta CAPI events from existing students + payments for a time window.
// Trial = new student created; Purchase = a student's 1st paid payment;
// Renewal = their 2nd+ paid payment. Same logic as the manual CSV export.
import type { CapiEvent } from './capi'

function splitName(n: string | null) {
  const parts = (n ?? '').trim().split(/\s+/)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

export async function collectConversionEvents(
  supabase: any, fromISO: string, toISO: string
): Promise<CapiEvent[]> {
  const [{ data: students }, { data: payments }] = await Promise.all([
    supabase.from('students').select('id, name, email, phone, created_at'),
    supabase.from('payments').select('id, student_id, amount, currency, status, created_at').eq('status', 'paid').order('created_at'),
  ])
  const stById = new Map((students ?? []).map((s: any) => [s.id, s]))
  const inRange = (iso: string) => { const t = new Date(iso).toISOString(); return t >= fromISO && t <= toISO }
  const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

  const events: CapiEvent[] = []

  // Trial = student created in the window
  for (const s of (students ?? []) as any[]) {
    if (!s.created_at || !inRange(s.created_at)) continue
    if (!s.email && !s.phone) continue
    const nm = splitName(s.name)
    events.push({
      event_name: 'StartTrial', event_time: unix(s.created_at), event_id: `${s.id}_trial`,
      email: s.email, phone: s.phone, first_name: nm.first, last_name: nm.last,
    })
  }

  // Payments: 1st paid = Purchase, 2nd+ = Renewal (chronological, per student)
  const ordinal = new Map<string, number>()
  for (const p of (payments ?? []) as any[]) {
    const n = (ordinal.get(p.student_id) ?? 0) + 1
    ordinal.set(p.student_id, n)
    if (!p.created_at || !inRange(p.created_at)) continue
    const s: any = stById.get(p.student_id)
    if (!s || (!s.email && !s.phone)) continue
    const nm = splitName(s.name)
    const isRenewal = n >= 2
    events.push({
      event_name: isRenewal ? 'Renewal' : 'Purchase',
      event_time: unix(p.created_at),
      event_id: isRenewal ? `${p.student_id}_renewal_${p.id}` : `${p.student_id}_purchase`,
      email: s.email, phone: s.phone, first_name: nm.first, last_name: nm.last,
      value: p.amount, currency: p.currency,
    })
  }

  return events
}
