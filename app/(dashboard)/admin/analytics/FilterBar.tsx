'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export default function FilterBar({ availableMonths }: { availableMonths: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selected = searchParams.get('months')?.split(',').filter(Boolean) ?? []

  const toggle = useCallback((month: string) => {
    const next = selected.includes(month)
      ? selected.filter(m => m !== month)
      : [...selected, month].sort()
    const params = new URLSearchParams(searchParams.toString())
    if (next.length === 0) params.delete('months')
    else params.set('months', next.join(','))
    router.push(`${pathname}?${params.toString()}`)
  }, [selected, searchParams, pathname, router])

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('months')
    router.push(`${pathname}?${params.toString()}`)
  }

  const selectLast = (n: number) => {
    const months = availableMonths.slice(0, n)
    const params = new URLSearchParams(searchParams.toString())
    params.set('months', months.join(','))
    router.push(`${pathname}?${params.toString()}`)
  }

  const isAllTime = selected.length === 0

  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>📅 Filter by Month</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={clearAll}
            style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1.5px solid', borderColor: isAllTime ? '#0D1B2A' : '#E5E7EB', background: isAllTime ? '#0D1B2A' : '#fff', color: isAllTime ? '#E8C97A' : '#6B7280' }}>
            All Time
          </button>
          {[3, 6, 12].map(n => (
            <button key={n} onClick={() => selectLast(n)}
              style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1.5px solid #E5E7EB', background: '#F9FAFB', color: '#374151' }}>
              Last {n}m
            </button>
          ))}
        </div>
        {!isAllTime && (
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{selected.length} month{selected.length !== 1 ? 's' : ''} selected</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {availableMonths.map(m => {
          const isSelected = selected.includes(m)
          const [year, month] = m.split('-')
          const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' })
          return (
            <button key={m} onClick={() => toggle(m)}
              style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1.5px solid', transition: 'all 0.1s', borderColor: isSelected ? '#0D1B2A' : '#E5E7EB', background: isSelected ? '#0D1B2A' : '#F9FAFB', color: isSelected ? '#E8C97A' : '#6B7280' }}>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
