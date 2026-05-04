// components/dashboard/StatCard.tsx
// Server-component safe — no function props

interface Props {
  label: string
  value: string | number
  emoji?: string
  color?: 'green' | 'blue' | 'red' | 'gold' | 'gray'
}

const colors = {
  green: { bg: '#ECFDF5', text: '#059669', border: '#6EE7B7' },
  blue:  { bg: '#EFF6FF', text: '#2563EB', border: '#93C5FD' },
  red:   { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  gold:  { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  gray:  { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' },
}

export default function StatCard({ label, value, emoji, color = 'gray' }: Props) {
  const c = colors[color]
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${c.border}`,
      borderRadius: '14px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0' }}>{label}</p>
        {emoji && <span style={{ fontSize: '18px' }}>{emoji}</span>}
      </div>
      <p style={{ fontSize: '26px', fontWeight: '700', color: c.text, margin: 0 }}>{value}</p>
    </div>
  )
}
