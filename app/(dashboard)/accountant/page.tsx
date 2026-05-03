// app/(dashboard)/accountant/page.tsx
import { createClient } from '@/lib/supabase/server'
import { AlertCircle, Bell, CreditCard, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function AccountantDashboard() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: renewalStudents },
    { data: pendingPayments },
    { data: reminders },
    { data: declinedPayments },
  ] = await Promise.all([
    supabase.from('students_with_remaining')
      .select('id, name, remaining_classes, student_status, currency, payment_method, phone, email, reminder_date, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
      .lte('remaining_classes', 2).neq('student_status', 'inactive').order('remaining_classes'),
    supabase.from('payments')
      .select('*, student:students(name, currency, phone)')
      .eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('students')
      .select('id, name, reminder_date, phone, email, notes')
      .eq('reminder_date', today).not('reminder_date', 'is', null),
    supabase.from('payments')
      .select('*, student:students(name)')
      .eq('status', 'declined').order('created_at', { ascending: false }).limit(10),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Accountant Dashboard</h1>

      {/* Stat Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Needs Renewal', value: renewalStudents?.length ?? 0, icon: AlertCircle, color: 'bg-amber-50 text-amber-600', border: 'border-amber-100' },
          { label: 'Pending Payments', value: pendingPayments?.length ?? 0, icon: Clock, color: 'bg-yellow-50 text-yellow-600', border: 'border-yellow-100' },
          { label: 'Reminders Today', value: reminders?.length ?? 0, icon: Bell, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100' },
          { label: 'Declined Payments', value: declinedPayments?.length ?? 0, icon: CreditCard, color: 'bg-red-50 text-red-600', border: 'border-red-100' },
        ].map(item => (
          <div key={item.label} className={`card p-5 border ${item.border}`}>
            <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center mb-3`}>
              <item.icon size={18} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{item.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Needs Renewal */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <AlertCircle size={17} className="text-amber-500" /> Students Needing Renewal
          </h2>
          <Link href="/accountant/renewals" className="text-xs text-[#C9A84C] hover:underline">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Student</th>
                <th className="table-header">Teacher</th>
                <th className="table-header text-center">Remaining</th>
                <th className="table-header">Currency</th>
                <th className="table-header">Contact</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {renewalStudents?.map((s: any) => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.remaining_classes <= 0 ? 'bg-red-50/30' : ''}`}>
                  <td className="table-cell font-semibold">{s.name}</td>
                  <td className="table-cell text-gray-600">{s.assigned_teacher?.profile?.name ?? '—'}</td>
                  <td className="table-cell text-center">
                    <span className={`font-bold ${s.remaining_classes <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {s.remaining_classes}
                    </span>
                  </td>
                  <td className="table-cell"><span className="badge bg-gray-100 text-gray-700">{s.currency}</span></td>
                  <td className="table-cell text-xs text-gray-500">{s.phone ?? s.email ?? '—'}</td>
                  <td className="table-cell">
                    <Link href={`/accountant/students/${s.id}/payment`} className="btn-primary py-1 px-3 text-xs">
                      + Add Payment
                    </Link>
                  </td>
                </tr>
              ))}
              {(renewalStudents?.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">🎉 All students have sufficient classes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Payments + Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2"><Clock size={16} className="text-yellow-500" /> Pending Payments</h3>
            <Link href="/accountant/payments?status=pending" className="text-xs text-[#C9A84C] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {pendingPayments?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.student?.name}</p>
                  <p className="text-xs text-gray-500">{p.number_of_classes} classes · {p.currency} {Number(p.amount).toFixed(2)}</p>
                </div>
                <Link href={`/accountant/payments/${p.id}/edit`} className="btn-primary py-1 px-3 text-xs">
                  Mark Paid
                </Link>
              </div>
            ))}
            {(pendingPayments?.length ?? 0) === 0 && (
              <p className="text-gray-400 text-sm p-6 text-center">No pending payments</p>
            )}
          </div>
        </div>

        {/* Reminders */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2"><Bell size={16} className="text-blue-500" /> Today's Reminders</h3>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {reminders?.map((s: any) => (
              <div key={s.id} className="px-6 py-3">
                <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                {s.notes && <p className="text-xs text-gray-500 mt-0.5">{s.notes}</p>}
                <p className="text-xs text-blue-600 mt-0.5">{s.phone ?? s.email}</p>
              </div>
            ))}
            {(reminders?.length ?? 0) === 0 && (
              <p className="text-gray-400 text-sm p-6 text-center">No reminders today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
