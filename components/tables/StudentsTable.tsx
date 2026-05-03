'use client'
// components/tables/StudentsTable.tsx
import Link from 'next/link'
import { Eye, Edit, AlertTriangle } from 'lucide-react'
import type { Role } from '@/types'

const STATUS_BADGE = {
  active:   'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',
  trial:    'bg-blue-100 text-blue-800',
}
const PAYMENT_BADGE = {
  paid:     'bg-green-100 text-green-700',
  pending:  'bg-yellow-100 text-yellow-700',
  declined: 'bg-red-100 text-red-700',
}

export default function StudentsTable({ students, role }: { students: any[]; role: Role }) {
  const basePath = `/${role}/students`

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Status</th>
              <th className="table-header">Teacher</th>
              <th className="table-header">Country</th>
              <th className="table-header">Currency</th>
              <th className="table-header text-center">Classes</th>
              <th className="table-header text-center">Remaining</th>
              <th className="table-header">Payment</th>
              <th className="table-header">Added By</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.length === 0 && (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">No students found</td></tr>
            )}
            {students.map((s: any) => {
              const remaining = s.remaining_classes ?? (s.total_paid_classes - s.consumed_classes)
              const needsRenewal = remaining <= 2 && s.student_status !== 'inactive'
              return (
                <tr key={s.id} className={`hover:bg-gray-50 ${needsRenewal ? 'bg-amber-50/40' : ''}`}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {needsRenewal && <AlertTriangle size={13} className="text-amber-500 shrink-0" />}
                      <div>
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${STATUS_BADGE[s.student_status as keyof typeof STATUS_BADGE]}`}>
                      {s.student_status}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600">
                    {s.assigned_teacher?.profile?.name ?? <span className="text-gray-300">Unassigned</span>}
                  </td>
                  <td className="table-cell text-gray-600">{s.country ?? '—'}</td>
                  <td className="table-cell">
                    <span className="badge bg-gray-100 text-gray-700">{s.currency}</span>
                  </td>
                  <td className="table-cell text-center">
                    <span className="text-sm text-gray-700">{s.consumed_classes} / {s.total_paid_classes}</span>
                  </td>
                  <td className="table-cell text-center">
                    <span className={`font-bold text-sm ${remaining <= 0 ? 'text-red-600' : remaining <= 2 ? 'text-amber-600' : 'text-green-700'}`}>
                      {remaining}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${PAYMENT_BADGE[s.payment_status as keyof typeof PAYMENT_BADGE]}`}>
                      {s.payment_status}
                    </span>
                  </td>
                  <td className="table-cell text-gray-500 text-xs">{s.added_by_sales?.name ?? '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Link href={`${basePath}/${s.id}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
                        <Eye size={15} />
                      </Link>
                      <Link href={`${basePath}/${s.id}/edit`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
                        <Edit size={15} />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
