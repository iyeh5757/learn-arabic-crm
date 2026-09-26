'use client'
// components/PlanDurationCheck.tsx
// Shown on every payment form. The number of classes is converted into real
// teaching time using the student's profile session_duration, so a wrong
// duration here silently mis-prices the whole package (and, once balances are
// tracked in minutes, locks that error in permanently).
//
// Display-only: it changes no data and never blocks submission.
import Link from 'next/link'

export default function PlanDurationCheck({
  sessionDuration, numberOfClasses, editHref,
}: {
  sessionDuration?: number | null
  numberOfClasses?: number | null
  editHref?: string
}) {
  const dur = Number(sessionDuration) || 0
  const n   = Number(numberOfClasses) || 0

  // No duration on the profile => we cannot price the package at all.
  if (!dur) {
    return (
      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '12px 14px', marginTop: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#B91C1C' }}>
          ⚠️ This customer has no session duration set
        </div>
        <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '4px' }}>
          Set the class length on their profile before recording a payment, otherwise the package can&apos;t be priced correctly.
          {editHref && <> <Link href={editHref} style={{ color: '#B91C1C', fontWeight: 700 }}>Edit profile →</Link></>}
        </div>
      </div>
    )
  }

  const totalMinutes = n * dur
  const hours = totalMinutes / 60
  const hoursLabel = Number.isInteger(hours) ? `${hours}` : hours.toFixed(2).replace(/\.?0+$/, '')

  return (
    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 14px', marginTop: '10px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
        ⚠️ Check the class length before saving
      </div>
      <div style={{ fontSize: '13px', color: '#92400E', marginTop: '6px' }}>
        This customer&apos;s profile says <strong>{dur}-minute</strong> classes.
      </div>
      {n > 0 && (
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#92400E', marginTop: '6px' }}>
          {n} × {dur} min = {hoursLabel} {hours === 1 ? 'hour' : 'hours'} of teaching time
        </div>
      )}
      <div style={{ fontSize: '12px', color: '#B45309', marginTop: '6px' }}>
        If that isn&apos;t what the customer bought, fix the class length on their profile first — this payment is converted using it.
        {editHref && <> <Link href={editHref} style={{ color: '#92400E', fontWeight: 700 }}>Edit profile →</Link></>}
      </div>
    </div>
  )
}
