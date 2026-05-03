// app/(dashboard)/admin/users/page.tsx
import { createClient } from '@/lib/supabase/server'
import CreateUserForm from '@/components/forms/CreateUserForm'
import { Shield } from 'lucide-react'

const ROLE_BADGE: Record<string, string> = {
  admin:       'bg-purple-100 text-purple-800',
  teacher:     'bg-blue-100 text-blue-800',
  supervisor:  'bg-orange-100 text-orange-800',
  sales:       'bg-green-100 text-green-800',
  accountant:  'bg-red-100 text-red-800',
}

export default async function AdminUsersPage() {
  const supabase = createClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: salesConfigs } = await supabase
    .from('sales_config')
    .select('sales_user_id, commission_amount, commission_currency')

  const configMap = Object.fromEntries((salesConfigs ?? []).map(c => [c.sales_user_id, c]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <span className="badge bg-gray-100 text-gray-700">{users?.length ?? 0} users</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create User Form */}
        <div className="lg:col-span-1">
          <CreateUserForm />
        </div>

        {/* Users Table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="card-header">
            <h3 className="font-semibold flex items-center gap-2"><Shield size={16} /> All Users</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Commission</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users?.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#0D1B2A] flex items-center justify-center text-[#C9A84C] text-xs font-bold shrink-0">
                          {u.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="table-cell text-gray-500 text-xs">{u.email}</td>
                    <td className="table-cell">
                      <span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {u.role === 'sales' && configMap[u.id]
                        ? `${configMap[u.id].commission_currency} ${configMap[u.id].commission_amount}`
                        : u.role === 'sales' ? <span className="text-amber-600">Not set</span> : '—'}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
