// ============================================================
// types/index.ts — Shared types for the entire CRM
// ============================================================

export type Role = 'admin' | 'teacher' | 'supervisor' | 'sales' | 'accountant'
export type Currency = 'USD' | 'GBP' | 'EUR' | 'AED'
export type PaymentStatus = 'paid' | 'pending' | 'declined'
export type StudentStatus = 'active' | 'inactive' | 'trial'
export type AttendanceStatus = 'attended' | 'no-show' | 'cancelled' | 'scheduled'
export type SessionType = 'trial' | 'paid'
export type TrialStatus = 'pending' | 'converted' | 'lost'
export type CommissionStatus = 'pending' | 'paid'

export type PaymentMethod =
  | 'PayPal' | 'Stripe' | 'EU Bank' | 'UAE Bank' | 'UK Bank'
  | 'US Bank' | 'Western Union' | 'Instapay' | 'Vodafone Cash'

export type Specialty = 'MSA' | 'Egyptian' | 'Gulf' | 'Levantine' | 'Quran' | 'Islamic'

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Teacher {
  id: string
  user_id: string
  rate_per_session_usd: number
  languages: string[]
  specialties: string[]
  supervisor_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // joined
  profile?: Profile
  supervisor?: Profile
}

export interface Student {
  id: string
  name: string
  email: string | null
  country: string | null
  phone: string | null
  payment_method: PaymentMethod | null
  currency: Currency
  total_paid_classes: number
  consumed_classes: number
  remaining_classes?: number // computed
  payment_status: PaymentStatus
  student_status: StudentStatus
  session_duration: 30 | 60
  assigned_teacher_id: string | null
  added_by_sales_id: string | null
  reminder_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  assigned_teacher?: Teacher & { profile: Profile }
  added_by_sales?: Profile
}

export interface Session {
  id: string
  teacher_id: string
  student_id: string
  session_date: string
  session_time: string | null
  duration: 30 | 60
  session_type: SessionType
  attendance_status: AttendanceStatus
  homework: boolean
  feedback: string | null
  student_rating: number | null
  trial_status: TrialStatus | null
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  teacher?: Teacher & { profile: Profile }
  student?: Student
}

export interface Payment {
  id: string
  student_id: string
  number_of_classes: number
  amount: number
  currency: Currency
  payment_method: string
  status: PaymentStatus
  added_by: string | null
  confirmed_by: string | null
  payment_date: string | null
  is_renewal: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // joined
  student?: Student
  added_by_profile?: Profile
}

export interface Commission {
  id: string
  sales_user_id: string
  student_id: string
  payment_id: string | null
  amount: number
  currency: Currency
  status: CommissionStatus
  created_at: string
  // joined
  student?: Student
  payment?: Payment
}

export interface SalesConfig {
  id: string
  sales_user_id: string
  commission_amount: number
  commission_currency: Currency
  created_at: string
  updated_at: string
  // joined
  sales_user?: Profile
}

// Dashboard KPI types
export interface AdminKPIs {
  totalStudents: number
  activeStudents: number
  trialStudents: number
  revenueByMonth: RevenueByCurrency
  teacherEarnings: TeacherEarning[]
  needsRenewal: Student[]
  remindersToday: Student[]
}

export interface RevenueByCurrency {
  USD: number
  GBP: number
  EUR: number
  AED: number
}

export interface TeacherEarning {
  teacher: Teacher & { profile: Profile }
  sessionsThisMonth: number
  earningsUSD: number
  earningsEGP: number
}

export interface TeacherKPIs {
  activeStudents: number
  inactiveStudents: number
  totalHoursThisMonth: number
  totalSessionsThisMonth: number
  earningsThisMonth: number
  trialsConverted: number
  trialsLost: number
}

export interface SalesKPIs {
  studentsAdded: number
  paidConversions: number
  totalCommissions: number
  commissionByCurrency: RevenueByCurrency
}
