'use client'
// components/dashboard/TeacherEarningsTable.tsx
interface Props {
  earnings: { teacher: any; sessionsThisMonth: number; earningsUSD: number; earningsEGP: number }[]
}

export default function TeacherEarningsTable({ earnings }: Props) {
  if (!earnings.length) return <p className="text-gray-500 text-sm p-6">No sessions recorded this month.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="table-header">Teacher</th>
            <th className="table-header">Specialties</th>
            <th className="table-header text-right">Sessions</th>
            <th className="table-header text-right">Rate / Session</th>
            <th className="table-header text-right">Earnings (USD)</th>
            <th className="table-header text-right">Earnings (EGP)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {earnings.map((e, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="table-cell font-semibold">{e.teacher.profile?.name ?? '—'}</td>
              <td className="table-cell">
                <div className="flex flex-wrap gap-1">
                  {(e.teacher.specialties ?? []).map((s: string) => (
                    <span key={s} className="badge bg-blue-50 text-blue-700">{s}</span>
                  ))}
                </div>
              </td>
              <td className="table-cell text-right font-medium">{e.sessionsThisMonth}</td>
              <td className="table-cell text-right text-gray-600">$ {Number(e.teacher.rate_per_session_usd).toFixed(2)}</td>
              <td className="table-cell text-right font-bold text-gray-900">$ {e.earningsUSD.toFixed(2)}</td>
              <td className="table-cell text-right">
                <span className="font-bold text-green-700">EGP {e.earningsEGP.toLocaleString()}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
