'use client'
// components/dashboard/StatCard.tsx
import { LucideIcon } from 'lucide-react'

const COLORS = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-100' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100' },
  gold:   { bg: 'bg-yellow-50', icon: 'text-yellow-600', border: 'border-yellow-100' },
  red:    { bg: 'bg-red-50',    icon: 'text-red-600',    border: 'border-red-100' },
}

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color: keyof typeof COLORS
  sub?: string
  trend?: number
}

export default function StatCard({ label, value, icon: Icon, color, sub, trend }: StatCardProps) {
  const c = COLORS[color]
  return (
    <div className={`card p-5 border ${c.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={c.icon} />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`text-xs mt-2 font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  )
}
