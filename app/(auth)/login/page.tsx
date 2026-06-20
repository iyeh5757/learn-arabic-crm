'use client'
// app/(auth)/login/page.tsx
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'


export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError(authError.message); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (resetError) { setError(resetError.message); return }
    setResetSent(true)
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl text-[#C9A84C] mb-2" style={{ fontFamily: 'serif' }}>تعلم</div>
          <h1 className="text-2xl font-bold text-white">Learn Arabic CRM</h1>
          <p className="text-gray-400 text-sm mt-1">Internal Operations System</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">

          {mode === 'login' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Sign in to your account</h2>
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input" placeholder="you@learnarabic.com" required />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="input" placeholder="••••••••" required />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <button onClick={() => { setMode('forgot'); setError(''); setResetSent(false) }}
                  className="text-sm text-[#C9A84C] hover:underline">
                  Forgot your password?
                </button>
              </div>
            </>
          )}

          {mode === 'forgot' && !resetSent && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Reset your password</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input" placeholder="you@learnarabic.com" required />
                </div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
              <div className="mt-4 text-center">
                <button onClick={() => { setMode('login'); setError('') }} className="text-sm text-gray-500 hover:underline">
                  ← Back to sign in
                </button>
              </div>
            </>
          )}

          {mode === 'forgot' && resetSent && (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm mb-6">
                We sent a reset link to <strong>{email}</strong>. Click it to set a new password.
              </p>
              <button onClick={() => { setMode('login'); setResetSent(false) }}
                className="text-sm text-[#C9A84C] hover:underline">← Back to sign in</button>
            </div>
          )}
        </div>
        <p className="text-center text-gray-500 text-xs mt-6">Access restricted to authorised staff only.</p>
      </div>
    </div>
  )
}
