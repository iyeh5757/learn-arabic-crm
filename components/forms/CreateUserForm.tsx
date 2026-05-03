'use client'
// components/forms/CreateUserForm.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'

export default function CreateUserForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'sales',
    commission_amount: '', commission_currency: 'USD',
    rate_per_session_usd: '',
    languages: [] as string[],
    specialties: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const LANGUAGES = ['English','German','French','Spanish','Arabic','Italian','Dutch','Turkish','Russian']
  const SPECIALTIES = ['Egyptian','Gulf','Levantine','MSA','Quran','Islamic','Children']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to create user'); setLoading(false); return }
    setSuccess(`${form.name} created successfully!`)
    setForm({ name:'', email:'', password:'', role:'sales', commission_amount:'', commission_currency:'USD', rate_per_session_usd:'', languages:[], specialties:[] })
    setLoading(false)
    router.refresh()
  }

  function toggleArray(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold flex items-center gap-2"><UserPlus size={16} /> Create New User</h3>
      </div>
      <form onSubmit={handleSubmit} className="card-body space-y-4">
        <div>
          <label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required />
        </div>
        <div>
          <label className="label">Email *</label>
          <input type="email" className="input" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} required />
        </div>
        <div>
          <label className="label">Temporary Password *</label>
          <input type="password" className="input" value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} minLength={8} required />
        </div>
        <div>
          <label className="label">Role *</label>
          <select className="input" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="supervisor">Supervisor</option>
            <option value="sales">Sales / Call Center</option>
            <option value="accountant">Accountant</option>
          </select>
        </div>

        {/* Teacher-specific */}
        {form.role === 'teacher' && (
          <>
            <div>
              <label className="label">Rate per Session (USD) *</label>
              <input type="number" step="0.01" className="input" value={form.rate_per_session_usd}
                onChange={e => setForm(f=>({...f,rate_per_session_usd:e.target.value}))} required />
            </div>
            <div>
              <label className="label">Languages</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LANGUAGES.map(l => (
                  <button key={l} type="button"
                    onClick={() => setForm(f=>({...f,languages:toggleArray(f.languages,l)}))}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${form.languages.includes(l) ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Specialties</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SPECIALTIES.map(s => (
                  <button key={s} type="button"
                    onClick={() => setForm(f=>({...f,specialties:toggleArray(f.specialties,s)}))}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${form.specialties.includes(s) ? 'bg-[#0D1B2A] text-[#E8C97A] border-[#0D1B2A]' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Sales-specific */}
        {form.role === 'sales' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Commission Amount</label>
              <input type="number" step="0.01" className="input" value={form.commission_amount}
                onChange={e => setForm(f=>({...f,commission_amount:e.target.value}))} placeholder="e.g. 10" />
            </div>
            <div className="w-28">
              <label className="label">Currency</label>
              <select className="input" value={form.commission_currency} onChange={e => setForm(f=>({...f,commission_currency:e.target.value}))}>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
            </div>
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs">{success}</div>}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Creating…' : 'Create User'}
        </button>
      </form>
    </div>
  )
}
