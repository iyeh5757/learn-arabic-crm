// lib/analytics/supervisor.ts
// Shared computation for the supervisor / teacher analytics page.
//
// Definitions (per the business rules):
//  - Trial conversion = paying students / all students. A trial counts as
//    "lost" unless that student has paid (payment_status = 'paid').
//  - Renewal rate = students with a renewal payment / paying students
//    ("completed first plan" is approximated as having paid at least once).
//  - Money = sum of PAID payments, converted to EGP (approximate fixed rates).
//  - Month filter scopes students (by created_at) and payments (by created_at).

const EGP_RATES: Record<string, number> = { USD: 50, GBP: 63.5, EUR: 54.5, AED: 13.6, EGP: 1 }
export function toEGP(amount: number, currency: string): number {
  return amount * (EGP_RATES[currency] ?? 1)
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
  revenueEGP: number
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

export function computeAnalytics(input: AnalyticsInput, filters: AnalyticsFilters) {
  const { teachers, supervisors, sales } = input
  const month = filters.month ?? null

  // Scope teachers by the supervisor / teacher filters
  let teacherScope = teachers
  if (filters.supervisorId) teacherScope = teacherScope.filter(t => t.supervisor_id === filters.supervisorId)
  if (filters.teacherId)    teacherScope = teacherScope.filter(t => t.id === filters.teacherId)
  const scopedTeacherIds = new Set(teacherScope.map(t => t.id))

  // Month-scoped data
  const students = input.students.filter(s => inMonth(s.created_at, month))
  const payments = input.payments.filter(p => p.status === 'paid' && inMonth(p.created_at, month))

  // Per-student lookups
  const studentById = new Map(students.map(s => [s.id, s]))
  const renewedStudentIds = new Set(payments.filter(p => p.is_renewal).map(p => p.student_id))
  const revenueByStudent = new Map<string, number>()
  for (const p of payments) {
    revenueByStudent.set(p.student_id, (revenueByStudent.get(p.student_id) ?? 0) + toEGP(Number(p.amount) || 0, p.currency))
  }

  function rowForStudents(id: string, name: string, sList: Student[], teacherCount?: number): MetricRow {
    const total = sList.length
    const inactive = sList.filter(s => s.student_status === 'inactive').length
    const converted = sList.filter(s => s.payment_status === 'paid').length
    const payers = converted
    const renewed = sList.filter(s => renewedStudentIds.has(s.id)).length
    const revenueEGP = sList.reduce((sum, s) => sum + (revenueByStudent.get(s.id) ?? 0), 0)
    return {
      id, name, teacherCount, students: total, inactive,
      trials: total, converted, convRate: total ? Math.round((converted / total) * 100) : 0,
      payers, renewed, renewalRate: payers ? Math.round((renewed / payers) * 100) : 0,
      revenueEGP: Math.round(revenueEGP),
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
  const scopedPayments = payments.filter(p => scopedStudentIds.has(p.student_id))

  // Revenue by country
  const byCountryMap: Record<string, number> = {}
  for (const p of scopedPayments) {
    const c = studentById.get(p.student_id)?.country || 'Unknown'
    byCountryMap[c] = (byCountryMap[c] ?? 0) + toEGP(Number(p.amount) || 0, p.currency)
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
    salesAgg[sid].revenue += toEGP(Number(p.amount) || 0, p.currency)
  }
  const bySales = Object.entries(salesAgg).map(([id, a]) => ({
    name: id === 'unassigned' ? 'Unassigned' : (salesName.get(id) ?? 'Unknown'),
    revenue: Math.round(a.revenue),
    students: a.students,
    renewalRate: a.payers ? Math.round((a.renewed / a.payers) * 100) : 0,
  })).sort((a, b) => b.revenue - a.revenue)

  return { supervisorRows, teacherRows, byCountry, bySales }
}
