'use client'
// app/(dashboard)/sales/payments/new/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SalesNewPaymentInner() {
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  

  const router = useRouter()
  const searchParams = useSearchParams()
  const preStudentId = searchParams.get('student_id') ?? ''
  const preStudentName = searchParams.get('student_name') ?? ''
  const supabase = createClient()

    const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [form, setForm] = useState({
    student_id: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('student_id') ?? '' : '', number_of_classes: 16, amount: '',
    currency: 'USD', payment_method: '', status: 'pending',
    payment_date: today,
    is_renewal: false, notes: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? ''
      setCurrentUserId(uid)
      const { data: s } = await supabase.from('students').select('id, name, currency, total_paid_classes, consumed_classes, payment_method').eq('added_by_sales_id', uid).order('name')
      setStudents(s ?? [])
    })
  }, [])

  const selectedStudent = students.find(s => s.id === form.student_id)
  const sym = form.currency === 'USD' ? '$' : form.currency === 'GBP' ? '£' : form.currency === 'EUR' ? '€' : form.currency === 'AED' ? 'AED ' : 'EGP '

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.student_id) { setError('Select a student'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.from('payments').insert({
      student_id: form.student_id, number_of_classes: Number(form.number_of_classes),
      amount: Number(form.amount), currency: form.currency,
      payment_method: form.payment_method, status: form.status,
      payment_date: form.payment_date, is_renewal: form.is_renewal,
      notes: form.notes || null, added_by: currentUserId,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/sales/payments')
    router.refresh()
  }

  const inp = { width:'100%', padding:'9px 14px', border:'1.5px solid #E5E7EB', borderRadius:'8px', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }
  const lbl = { display:'block', fontSize:'11px', fontWeight:'600' as const, color:'#6B7280', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:'6px' }
  const grid = { padding:'20px 22px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'16px' }

  return (
    <div style={{ maxWidth:'860px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#111827', margin:0 }}>Add Payment</h1>
        <p style={{ color:'#6B7280', fontSize:'14px', margin:'4px 0 0 0' }}>Record a payment for one of your students</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:'14px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'20px' }}>
          <div style={{ padding:'14px 22px', borderBottom:'1px solid #F3F4F6', fontWeight:'600', fontSize:'15px', color:'#111827' }}>💳 Payment Details</div>
          <div style={grid}>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={lbl}>Student *</label>
              <select style={inp} value={form.student_id} onChange={e => {
                const s = students.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, student_id: e.target.value, currency: s?.currency ?? f.currency }))
              }} required>
                <option value="">Select your student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.currency} — {s.total_paid_classes - s.consumed_classes} remaining</option>)}
              </select>
            </div>
            <div><label style={lbl}>Number of Classes</label>
              <select style={inp} value={form.number_of_classes} onChange={e=>setForm(f=>({...f,number_of_classes:Number(e.target.value)}))}>
                {[4,8,12,16,20].map(n=><option key={n} value={n}>{n} sessions{n===16?' ⭐':''}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Amount</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#6B7280' }}>{sym}</span>
                <input type="number" step="0.01" style={{ ...inp, paddingLeft:'36px' }} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} required />
              </div>
            </div>
            <div><label style={lbl}>Currency</label>
              <select style={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
                <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option><option value="EGP">EGP</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Method</label>
              <select style={inp} value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))} required>
                <option value="">Select method</option>
                {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Status</label>
              <select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="paid">✅ Paid</option>
                <option value="declined">❌ Declined</option>
              </select>
            </div>
            <div><label style={lbl}>Date</label>
              <input type="date" style={inp} value={form.payment_date} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', paddingTop:'20px' }}>
              <input type="checkbox" id="renewal" checked={form.is_renewal} onChange={e=>setForm(f=>({...f,is_renewal:e.target.checked}))} style={{ width:'16px', height:'16px', accentColor:'#C9A84C' }} />
              <label htmlFor="renewal" style={{ fontSize:'14px', fontWeight:'500', color:'#374151', cursor:'pointer' }}>Renewal payment</label>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, minHeight:'60px', resize:'vertical' }} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
            </div>
          </div>
        </div>
        {form.status==='paid' && (
          <div style={{ background:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', fontSize:'13px', color:'#065F46' }}>
            ⚡ Marking as <strong>Paid</strong> adds <strong>{form.number_of_classes} classes</strong> and generates your commission.
          </div>
        )}
        {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'12px 16px', borderRadius:'8px', fontSize:'14px', marginBottom:'16px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'12px' }}>
          <button type="submit" disabled={loading} style={{ background:'#0D1B2A', color:'#E8C97A', padding:'12px 28px', borderRadius:'10px', border:'none', fontWeight:'600', fontSize:'14px', cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1 }}>
            {loading?'Saving…':'Add Payment'}
          </button>
          <button type="button" onClick={()=>router.back()} style={{ background:'transparent', color:'#6B7280', padding:'12px 22px', borderRadius:'10px', border:'1.5px solid #E5E7EB', fontWeight:'500', fontSize:'14px', cursor:'pointer' }}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

export default function SalesNewPaymentPage() {
  return <Suspense fallback={<div style={{padding:'60px',textAlign:'center',color:'#6B7280'}}>Loading…</div>}><SalesNewPaymentInner /></Suspense>
}
