// app/(dashboard)/sales/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatCard from '@/components/dashboard/StatCard'
import { Users, TrendingUp, DollarSign, UserPlus, PlusCircle } from 'lucide-react'
import Link from 'next/link'

export default async function SalesDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { data: myStudents },
    { data: myCommissions },
    { data: salesConfig },
  ] = await Promise.all([
    supabase.from('students')
      .select('id, name, student_status, payment_status, currency, created_at, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
      .eq('added_by_sales_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('commissions')
      .select('amount, currency, status, created_at, student:students(name)')
      .eq('sales_user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('sales_config').select('commission_amount, commission_currency').eq('sales_user_id', user.id).single(),
  ])

  const totalAdded = myStudents?.length ?? 0
  const paidConversions = myStudents?.filter(s => s.student_status === 'active').length ?? 0
  const thisMonthStudents = myStudents?.filter(s => s.created_at >= monthStart).length ?? 0

  // Commission totals
  const commissionByCurrency: Record<string, number> = {}
  myCommissions?.forEach(c => {
    commissionByCurrency[c.currency] = (commissionByCurrency[c.currency] ?? 0) + Number(c.amount)
  })
  const pendingCommissions = myCommissions?.filter(c => c.status === 'pending') ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="text-gray-500 text-sm">{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/sales/students/new" className="btn-primary">
          <UserPlus size={16} /> Add Student
        </Link>
      </div>

      {/* Commission Rate Banner */}
      {salesConfig && (
        <div className="bg-[#0D1B2A] rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[#E8C97A] font-semibold">Your Commission Rate</p>
            <p className="text-white text-2xl font-bold mt-0.5">
              {salesConfig.commission_currency} {Number(salesConfig.commission_amount).toFixed(2)} per conversion
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-sm">Pending</p>
            <p className="text-[#E8C97A] font-bold text-lg">{pendingCommissions.length} commissions</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Students Added" value={totalAdded} icon={Users} color="blue" />
        <StatCard label="This Month" value={thisMonthStudents} icon={UserPlus} color="green" />
        <StatCard label="Paid Conversions" value={paidConversions} icon={TrendingUp} color="orange" />
        <StatCard label="Conversion Rate"
          value={`${totalAdded > 0 ? Math.round((paidConversions / totalAdded) * 100) : 0}%`}
          icon={TrendingUp} color="purple" />
      </div>

      {/* Commission breakdown + My students */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commissions */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Commission Breakdown</h3>
            <Link href="/sales/commissions" className="text-xs text-[#C9A84C] hover:underline">Details</Link>
          </div>
          <div className="card-body space-y-3">
            {Object.keys(commissionByCurrency).length === 0 ? (
              <p className="text-gray-400 text-sm">No commissions yet</p>
            ) : Object.entries(commissionByCurrency).map(([cur, amt]) => (
              <div key={cur} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{cur}</span>
                <span className="font-bold text-gray-900">{cur} {amt.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent students */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">My Recent Students</h3>
            <Link href="/sales/students" className="text-xs text-[#C9A84C] hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {myStudents?.slice(0,8).map(s => (
              <div key={s.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400">{(s.assigned_teacher as any)?.profile?.name ?? 'No teacher'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`badge text-xs ${s.student_status === 'active' ? 'bg-green-100 text-green-700' : s.student_status === 'trial' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.student_status}
                  </span>
                  <span className={`badge text-xs ${s.payment_status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                    {s.payment_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
