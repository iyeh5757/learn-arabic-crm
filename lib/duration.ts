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
  { value: 60,  label: '60 minutes (1 hour)' },
  { value: 90,  label: '90 minutes (1.5 hours)' },
  { value: 120, label: '120 minutes (2 hours)' },
]

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
