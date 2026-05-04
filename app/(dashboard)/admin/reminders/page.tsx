// app/(dashboard)/admin/reminders/page.tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminRemindersPage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: lowStudents } = await supabase
    .from('students')
    .select('id, name, phone, email, country, currency, total_paid_classes, consumed_classes, reminder_date, payment_method, notes, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name)), added_by_sales:profiles!students_added_by_sales_id_fkey(name)')
    .neq('student_status', 'inactive')
    .order('consumed_classes', { ascending: false })

  const { data: todayReminders } = await supabase
    .from('students')
    .select('id, name, phone, email, reminder_date, notes, currency, assigned_teacher:teachers(profile:profiles!teachers_user_id_fkey(name))')
    .eq('reminder_date', today)

  const outOfClasses = (lowStudents ?? []).filter(s => (s.total_paid_classes - s.consumed_classes) <= 0)
  const oneLast = (lowStudents ?? []).filter(s => (s.total_paid_classes - s.consumed_classes) === 1)
  const twoLeft = (lowStudents ?? []).filter(s => (s.total_paid_classes - s.consumed_classes) === 2)

  const rowStyle = { borderBottom: '1px solid #F3F4F6' }

  function StudentRow({ s }: { s: any }) {
    const rem = s.total_paid_classes - s.consumed_classes
    return (
      <tr style={rowStyle}>
        <td style={{ padding: '14px 16px' }}>
          <p style={{ fontWeight: '600', color: '#111827', margin: 0, fontSize: '14px' }}>{s.name}</p>
          {s.email && <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{s.email}</p>}
        </td>
        <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{(s.assigned_teacher as any)?.profile?.name ?? '—'}</td>
        <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>{s.phone ?? '—'}</td>
        <td style={{ padding: '14px 16px' }}><span style={{ background: '#F3F4F6', color: '#374151', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{s.currency}</span></td>
        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
          <span style={{ fontWeight: '700', fontSize: '16px', color: rem <= 0 ? '#DC2626' : rem === 1 ? '#EA580C' : '#D97706' }}>{rem}</span>
        </td>
        <td style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href={`/admin/students/${s.id}/edit`} style={{ background: '#0D1B2A', color: '#E8C97A', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>Edit</Link>
            <Link href={`/admin/payments/new`} style={{ background: '#059669', color: '#fff', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>+ Pay</Link>
          </div>
        </td>
      </tr>
    )
  }

  const TableHeader = () => (
    <thead>
      <tr style={{ background: '#F9FAFB' }}>
        {['Student', 'Teacher', 'Phone', 'Currency', 'Classes Left', 'Actions'].map(h => (
          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: 0 }}>Reminders & Renewals</h1>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0 0' }}>Students needing attention today</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Out of Classes', value: outOfClasses.length, color: '#DC2626', bg: '#FEF2F2' },
          { label: '1 Class Left', value: oneLast.length, color: '#EA580C', bg: '#FFF7ED' },
          { label: '2 Classes Left', value: twoLeft.length, color: '#D97706', bg: '#FFFBEB' },
          { label: "Today's Reminders", value: todayReminders?.length ?? 0, color: '#2563EB', bg: '#EFF6FF' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: `1px solid ${k.bg}`, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: '700', color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Today's reminders */}
      {(todayReminders?.length ?? 0) > 0 && (
        <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '14px', padding: '16px 20px' }}>
          <p style={{ fontWeight: '700', color: '#1E40AF', margin: '0 0 12px 0' }}>🔔 Today's Reminders</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayReminders?.map(s => (
              <div key={s.id} style={{ background: '#fff', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: '600', color: '#111827', margin: 0 }}>{s.name}</p>
                  <p style={{ color: '#6B7280', fontSize: '12px', margin: '2px 0 0 0' }}>{s.phone ?? s.email ?? '—'} · {(s.assigned_teacher as any)?.profile?.name ?? 'No teacher'}</p>
                  {s.notes && <p style={{ color: '#9CA3AF', fontSize: '11px', margin: '2px 0 0 0' }}>{s.notes}</p>}
                </div>
                <Link href={`/admin/students/${s.id}/edit`} style={{ background: '#1D4ED8', color: '#fff', padding: '5px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '600' }}>View</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Out of classes */}
      {outOfClasses.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #FEE2E2', background: '#FEF2F2', fontWeight: '600', fontSize: '15px', color: '#DC2626' }}>
            🚨 Out of Classes ({outOfClasses.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHeader />
              <tbody>{outOfClasses.map(s => <StudentRow key={s.id} s={s} />)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1 left */}
      {oneLast.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FED7AA', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #FFEDD5', background: '#FFF7ED', fontWeight: '600', fontSize: '15px', color: '#EA580C' }}>
            ⚠️ 1 Class Remaining ({oneLast.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHeader />
              <tbody>{oneLast.map(s => <StudentRow key={s.id} s={s} />)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2 left */}
      {twoLeft.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #FCD34D', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #FEF3C7', background: '#FFFBEB', fontWeight: '600', fontSize: '15px', color: '#D97706' }}>
            📋 2 Classes Remaining ({twoLeft.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <TableHeader />
              <tbody>{twoLeft.map(s => <StudentRow key={s.id} s={s} />)}</tbody>
            </table>
          </div>
        </div>
      )}

      {outOfClasses.length === 0 && oneLast.length === 0 && twoLeft.length === 0 && (todayReminders?.length ?? 0) === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '48px', margin: '0 0 12px 0' }}>🎉</p>
          <p style={{ fontSize: '18px', fontWeight: '600', color: '#374151', margin: 0 }}>All clear! No reminders today.</p>
        </div>
      )}
    </div>
  )
}
