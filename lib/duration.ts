// lib/duration.ts
// Plan lengths vs session lengths are deliberately different sets.
//
// PLAN_DURATIONS — what a customer BUYS. We only sell two models: 30 min and
// 1 hour. This is the rate used to convert a payment into minutes of credit.
//
// SESSION_DURATIONS — how long an individual lesson actually RAN. A customer
// on a 30-minute plan may occasionally take a 90-minute lesson; that simply
// consumes 90 minutes of their balance.
export const PLAN_DURATIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
]

export const SESSION_DURATIONS = [
  { value: 30,  label: '30 minutes' },
  { value: 45,  label: '45 minutes' },
  { value: 60,  label: '60 minutes (1 hour)' },
  { value: 90,  label: '90 minutes (1.5 hours)' },
  { value: 120, label: '120 minutes (2 hours)' },
]

// Sales book on the calendar but don't set lesson-length policy, so 45 minutes
// is reserved for teachers, admins and supervisors.
export const SALES_SESSION_DURATIONS = SESSION_DURATIONS.filter(d => d.value !== 45)

/** Minutes -> "2h 30m" / "45m" / "3h" */
export function fmtHours(minutes?: number | null): string {
  const m = Math.round(Number(minutes) || 0)
  if (m === 0) return '0h'
  const sign = m < 0 ? '-' : ''
  const a = Math.abs(m)
  const h = Math.floor(a / 60), r = a % 60
  if (h === 0) return `${sign}${r}m`
  if (r === 0) return `${sign}${h}h`
  return `${sign}${h}h ${r}m`
}

/** Decimal hours, e.g. 90 -> 1.5 */
export function toHours(minutes?: number | null): number {
  return Math.round(((Number(minutes) || 0) / 60) * 100) / 100
}

/**
 * Remaining time expressed as a count of the customer's OWN sessions.
 * 30 minutes left on a 1-hour plan is half a lesson, so it reads 0.5 — never
 * floored to 0, which would hide credit the customer has actually paid for.
 * Plans are 30/60 and lessons are 30/60/90/120, so in practice this is always
 * a whole number or a clean half.
 */
export function toSessions(minutes?: number | null, planMinutes?: number | null): number | null {
  const m = Number(minutes), p = Number(planMinutes)
  if (!Number.isFinite(m) || !Number.isFinite(p) || p <= 0) return null
  return Math.round((m / p) * 100) / 100
}

/** "2.5" | "0.5" | "3"  (trailing .0 dropped) */
export function fmtSessions(minutes?: number | null, planMinutes?: number | null): string | null {
  const v = toSessions(minutes, planMinutes)
  if (v === null) return null
  return Number.isInteger(v) ? `${v}` : String(v).replace(/0+$/, '').replace(/\.$/, '')
}

/** "2h 30m · 2.5 sessions" — the standard balance label */
export function fmtBalance(minutes?: number | null, planMinutes?: number | null): string {
  const t = fmtHours(minutes)
  const s = fmtSessions(minutes, planMinutes)
  return s === null ? t : `${t} · ${s} ${s === '1' ? 'session' : 'sessions'}`
}
