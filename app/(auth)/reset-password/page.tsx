'use client'
// app/(auth)/reset-password/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) { setError(updateError.message); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2500)
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl text-[#C9A84C] mb-2" style={{ fontFamily: 'serif' }}>تعلم</div>
          <h1 className="text-2xl font-bold text-white">Learn Arabic CRM</h1>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {!done ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Set new password</h2>
              <p className="text-gray-500 text-sm mb-6">Choose a strong password for your account.</p>
              <form onSubmit={handleReset} className="space-y-5">
                <div>
                  <label className="label">New Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="input" placeholder="At least 6 characters" required />
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                    className="input" placeholder="Repeat password" required />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                  {loading ? 'Saving…' : 'Set New Password'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-gray-500 text-sm">Redirecting you to sign in…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
