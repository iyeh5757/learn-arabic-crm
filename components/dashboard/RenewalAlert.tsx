'use client'
// components/dashboard/RenewalAlert.tsx
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function RenewalAlert({ students }: { students: any[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" /> Needs Renewal
        </h2>
        <Link href="/admin/students?filter=renewal" className="text-xs text-[#C9A84C] hover:underline font-medium">
          View all
        </Link>
      </div>
      <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {students.length === 0 ? (
          <p className="text-gray-500 text-sm p-6 text-center">All students have sufficient classes 🎉</p>
        ) : students.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50">
            <div>
              <p className="text-sm font-semibold text-gray-900">{s.name}</p>
              <p className="text-xs text-gray-500">{s.currency}</p>
            </div>
            <span className={`badge ${s.remaining_classes <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {s.remaining_classes} left
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
