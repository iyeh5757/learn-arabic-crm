'use client'
// components/dashboard/MonthPicker.tsx
// Drop this component into any dashboard — it reads/sets ?month=YYYY-MM in the URL

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function MonthPicker() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const now = new Date()
  const currentParam = params.get('month') // e.g. "2025-03"
  const activeDate = currentParam
    ? new Date(`${currentParam}-01`)
    : new Date(now.getFullYear(), now.getMonth(), 1)

  function navigate(offsetMonths: number) {
    const d = new Date(activeDate)
    d.setMonth(d.getMonth() + offsetMonths)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const p = new URLSearchParams(params.toString())
    p.set('month', `${y}-${m}`)
    router.push(`${pathname}?${p.toString()}`)
  }

  const isCurrentMonth =
    activeDate.getFullYear() === now.getFullYear() &&
    activeDate.getMonth() === now.getMonth()

  const label = activeDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '6px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280', padding: '4px', borderRadius: '6px' }}
        title="Previous month"
      >
        <ChevronLeft size={16} />
      </button>

      <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827', minWidth: '130px', textAlign: 'center', userSelect: 'none' }}>
        {label}
      </span>

      <button
        onClick={() => navigate(1)}
        disabled={isCurrentMonth}
        style={{ background: 'none', border: 'none', cursor: isCurrentMonth ? 'default' : 'pointer', display: 'flex', alignItems: 'center', color: isCurrentMonth ? '#D1D5DB' : '#6B7280', padding: '4px', borderRadius: '6px' }}
        title="Next month"
      >
        <ChevronRight size={16} />
      </button>

      {!isCurrentMonth && (
        <button
          onClick={() => {
            const p = new URLSearchParams(params.toString())
            p.delete('month')
            router.push(`${pathname}?${p.toString()}`)
          }}
          style={{ fontSize: '11px', fontWeight: '600', color: '#C9A84C', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          Back to Now
        </button>
      )}
    </div>
  )
}
