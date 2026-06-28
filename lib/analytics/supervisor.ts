// lib/analytics/supervisor.ts
// Shared computation for the supervisor / teacher analytics page.
//
// Definitions (per the business rules):
//  - Trial conversion = paying students / all students. A trial counts as
//    "lost" unless that student has paid (payment_status = 'paid').
//  - Renewal rate = students with a renewal payment / paying students
//    ("completed first plan" is approximated as having paid at least once).
//  - Money = sum of PAID payments, converted to USD using live rates.
//  - Month filter scopes students (by created_at) and payments (by created_at).

// rates: units of currency per 1 USD (e.g. exchangerate-api base USD). So an
// amount in currency X is X / rates[X] USD.
export function toUSD(amount: number, currency: string, rates: Record<string, number>): number {
  const r = rates[currency]
  if (!r || r <= 0) return currency === 'USD' ? amount : 0
  return amount / r
}

// Live USD-base exchange rates (units of currency per 1 USD), with a safe fallback.
export async function fetchUsdRates(): Promise<Record<string, number>> {
  const fallback = { USD: 1, GBP: 0.79, EUR: 0.92, AED: 3.67, EGP: 50 }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const r = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: controller.signal, next: { revalidate: 3600 } })
    clearTimeout(timeout)
    if (r.ok) {
      const d = await r.json()
      if (d?.rates) return { USD: 1, ...d.rates }
    }
  } catch { /* fall through */ }
  return fallback
}

export type Teacher = { id: string; name: string; supervisor_id: string | null }
export type Supervisor = { id: string; name: string }
export type Student = {
  id: string; assigned_teacher_id: string | null; added_by_sales_id: string | null
  student_status: string | null; payment_status: string | null; country: string | null; created_at: string
}
export type Payment = { student_id: string; amount: number; currency: string; status: string; is_renewal: boolean | null; created_at: string }
export type SalesProfile = { id: string; name: string }

export interface MetricRow {
  id: string
  name: string
  teacherCount?: number     // supervisors only
  students: number
  inactive: number
  trials: number
  converted: number
  convRate: number          // %
  payers: number
  renewed: number
  renewalRate: number       // %
  revenue: number           // USD
}

function inMonth(iso: string, month: string | null): boolean {
  if (!month) return true
  return (iso ?? '').slice(0, 7) === month   // month = 'YYYY-MM'
}

export interface AnalyticsInput {
  supervisors: Supervisor[]
  teachers: Teacher[]
  students: Student[]
  payments: Payment[]
  sales: SalesProfile[]
}
export interface AnalyticsFilters {
  month?: string | null
  supervisorId?: string | null
  teacherId?: string | null
}

export function computeAnalytics(input: AnalyticsInput, filters: AnalyticsFilters, rates: Record<string, number>) {
  const { teachers, supervisors, sales } = input
  const month = filters.month ?? null

  // Scope teachers by the supervisor / teacher filters
  let teacherScope = teachers
  if (filters.supervisorId) teacherScope = teacherScope.filter(t => t.supervisor_id === filters.supervisorId)
  if (filters.teacherId)    teacherScope = teacherScope.filter(t => t.id === filters.teacherId)
  const scopedTeacherIds = new Set(teacherScope.map(t => t.id))

  // When a month is selected: students are scoped to the cohort acquired in that
  // month (created_at in that month), and revenue is scoped to payments in that
  // month. Conversion / renewal are lifetime figures for that cohort.
  // When no month is selected: all students + all payments (lifetime view).
  const allPaid   = input.payments.filter(p => p.status === 'paid')
  const monthPaid = allPaid.filter(p => inMonth(p.created_at, month))
  const students  = month
    ? input.students.filter(s => inMonth(s.created_at, month))
    : input.students

  // How many paid payments each student has made (across their lifetime).
  // 1+ paid = they completed/paid for a plan; 2+ paid = they renewed (paid again
  // after the first plan).
  const paidCount = new Map<string, number>()
  for (const p of allPaid) paidCount.set(p.student_id, (paidCount.get(p.student_id) ?? 0) + 1)
  const paidStudentIds    = new Set(Array.from(paidCount.entries()).filter(([, c]) => c >= 1).map(([id]) => id))
  const renewedStudentIds = new Set(Array.from(paidCount.entries()).filter(([, c]) => c >= 2).map(([id]) => id))

  const studentById = new Map(students.map(s => [s.id, s]))
  const revenueByStudent = new Map<string, number>()
  for (const p of monthPaid) {
    revenueByStudent.set(p.student_id, (revenueByStudent.get(p.student_id) ?? 0) + toUSD(Number(p.amount) || 0, p.currency, rates))
  }

  function rowForStudents(id: string, name: string, sList: Student[], teacherCount?: number): MetricRow {
    const total = sList.length                                                   // all students (every one did a trial)
    const active = sList.filter(s => s.student_status === 'active').length
    const inactive = sList.filter(s => s.student_status === 'inactive').length
    const converted = sList.filter(s => paidStudentIds.has(s.id)).length         // paid at least once
    const payers = converted
    const renewed = sList.filter(s => renewedStudentIds.has(s.id)).length        // paid again after first plan
    const revenue = sList.reduce((sum, s) => sum + (revenueByStudent.get(s.id) ?? 0), 0)
    return {
      id, name, teacherCount, students: active, inactive,
      trials: total, converted, convRate: total ? Math.round((converted / total) * 100) : 0,
      payers, renewed, renewalRate: payers ? Math.round((renewed / payers) * 100) : 0,
      revenue: Math.round(revenue),
    }
  }

  // Teacher-level rows
  const teacherRows: MetricRow[] = teacherScope.map(t =>
    rowForStudents(t.id, t.name, students.filter(s => s.assigned_teacher_id === t.id))
  ).sort((a, b) => b.students - a.students)

  // Supervisor-level rows (aggregate of their teachers' students)
  let supScope = supervisors
  if (filters.supervisorId) supScope = supScope.filter(s => s.id === filters.supervisorId)
  const supervisorRows: MetricRow[] = supScope.map(sup => {
    const myTeachers = teachers.filter(t => t.supervisor_id === sup.id && (!filters.teacherId || t.id === filters.teacherId))
    const myTeacherIds = new Set(myTeachers.map(t => t.id))
    const sList = students.filter(s => s.assigned_teacher_id && myTeacherIds.has(s.assigned_teacher_id))
    return rowForStudents(sup.id, sup.name, sList, myTeachers.length)
  }).sort((a, b) => b.students - a.students)

  // ── Charts (respect the teacher scope) ──────────────────────────────────
  const scopedStudents = students.filter(s => s.assigned_teacher_id && scopedTeacherIds.has(s.assigned_teacher_id))
  const scopedStudentIds = new Set(scopedStudents.map(s => s.id))
  const scopedPayments = monthPaid.filter(p => scopedStudentIds.has(p.student_id))

  // Revenue by country
  const byCountryMap: Record<string, number> = {}
  for (const p of scopedPayments) {
    const c = studentById.get(p.student_id)?.country || 'Unknown'
    byCountryMap[c] = (byCountryMap[c] ?? 0) + toUSD(Number(p.amount) || 0, p.currency, rates)
  }
  const byCountry = Object.entries(byCountryMap).map(([name, v]) => ({ name, value: Math.round(v) }))
    .sort((a, b) => b.value - a.value).slice(0, 12)

  // Revenue + students + renewal by sales rep
  const salesName = new Map(sales.map(s => [s.id, s.name]))
  const salesAgg: Record<string, { revenue: number; students: number; payers: number; renewed: number }> = {}
  for (const s of scopedStudents) {
    const sid = s.added_by_sales_id || 'unassigned'
    salesAgg[sid] ??= { revenue: 0, students: 0, payers: 0, renewed: 0 }
    salesAgg[sid].students++
    if (s.payment_status === 'paid') salesAgg[sid].payers++
    if (renewedStudentIds.has(s.id)) salesAgg[sid].renewed++
  }
  for (const p of scopedPayments) {
    const sid = studentById.get(p.student_id)?.added_by_sales_id || 'unassigned'
    salesAgg[sid] ??= { revenue: 0, students: 0, payers: 0, renewed: 0 }
    salesAgg[sid].revenue += toUSD(Number(p.amount) || 0, p.currency, rates)
  }
  const bySales = Object.entries(salesAgg).map(([id, a]) => ({
    name: id === 'unassigned' ? 'Unassigned' : (salesName.get(id) ?? 'Unknown'),
    revenue: Math.round(a.revenue),
    students: a.students,
    renewalRate: a.payers ? Math.round((a.renewed / a.payers) * 100) : 0,
  })).sort((a, b) => b.revenue - a.revenue)

  return { supervisorRows, teacherRows, byCountry, bySales }
}
