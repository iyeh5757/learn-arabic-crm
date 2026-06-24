'use client'
// app/(dashboard)/accountant/payments/new/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function NewPaymentForm() {
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  

  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedStudent = searchParams.get('student')
  const supabase = createClient()

    const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [form, setForm] = useState({
    student_id: preselectedStudent ?? '',
    number_of_classes: 16, amount: '',
    currency: 'USD', payment_method: '',
    status: 'pending', payment_date: today,
    is_renewal: true, notes: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''))
    supabase.from('students').select('id, name, currency, session_duration, total_paid_classes, consumed_classes, payment_method').order('name').then(({ data }) => {
      setStudents(data ?? [])
      if (preselectedStudent) {
        const s = data?.find((x: any) => x.id === preselectedStudent)
        if (s) setForm(f => ({ ...f, currency: s.currency, payment_method: s.payment_method ?? '' }))
      }
    })
  }, [])

  const selectedStudent = students.find(s => s.id === form.student_id)
  const sym = form.currency === 'USD' ? '$' : form.currency === 'GBP' ? '£' : form.currency === 'EUR' ? '€' : form.currency === 'AED' ? 'AED ' : 'EGP '

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.student_id) { setError('Please select a student'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('Please enter a valid amount'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.from('payments').insert({
      student_id: form.student_id,
      number_of_classes: Number(form.number_of_classes),
      amount: Number(form.amount),
      currency: form.currency,
      payment_method: form.payment_method,
      status: form.status,
      payment_date: form.payment_date,
      is_renewal: form.is_renewal,
      notes: form.notes || null,
      added_by: currentUserId,
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/accountant/payments')
    router.refresh()
  }

  const inp = { width:'100%', padding:'9px 14px', border:'1.5px solid #E5E7EB', borderRadius:'8px', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }
  const lbl = { display:'block', fontSize:'11px', fontWeight:'600' as const, color:'#6B7280', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:'6px' }
  const grid = { padding:'20px 22px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'16px' }

  return (
    <div style={{ maxWidth:'860px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#111827', margin:0 }}>Add Renewal Payment</h1>
        <p style={{ color:'#6B7280', fontSize:'14px', margin:'4px 0 0 0' }}>Record a payment or renewal for a student</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:'14px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'20px' }}>
          <div style={{ padding:'14px 22px', borderBottom:'1px solid #F3F4F6', fontWeight:'600', fontSize:'15px', color:'#111827' }}>💳 Payment Details</div>
          <div style={grid}>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={lbl}>Student *</label>
              <select style={inp} value={form.student_id} onChange={e => {
                const s = students.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, student_id: e.target.value, currency: s?.currency ?? f.currency, payment_method: s?.payment_method ?? f.payment_method }))
              }} required>
                <option value="">Select student</option>
                {students.map(s => {
                  const rem = s.total_paid_classes - s.consumed_classes
                  return <option key={s.id} value={s.id}>{s.name} — {s.currency} — {rem} classes remaining</option>
                })}
              </select>
              {selectedStudent && (
                <div style={{ display:'flex', gap:'20px', marginTop:'8px', fontSize:'13px', color:'#6B7280' }}>
                  <span>Total: <strong>{selectedStudent.total_paid_classes}</strong></span>
                  <span>Consumed: <strong>{selectedStudent.consumed_classes}</strong></span>
                  <span>Remaining: <strong style={{ color:(selectedStudent.total_paid_classes-selectedStudent.consumed_classes)<=2?'#D97706':'#059669' }}>{selectedStudent.total_paid_classes-selectedStudent.consumed_classes}</strong></span>
                </div>
              )}
            </div>
            <div><label style={lbl}>Number of Classes *</label>
              <input type="number" min={1} style={inp} value={form.number_of_classes} onChange={e=>setForm(f=>({...f,number_of_classes:Number(e.target.value)}))} placeholder="Enter number of classes, e.g. 10" />
            </div>
            <div><label style={lbl}>Amount *</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#6B7280' }}>{sym}</span>
                <input type="number" step="0.01" min="0.01" style={{ ...inp, paddingLeft:'36px' }} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} required />
              </div>
            </div>
            <div><label style={lbl}>Currency</label>
              <select style={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
                <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option><option value="EGP">EGP</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Method *</label>
              <select style={inp} value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))} required>
                <option value="">Select method</option>
                {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Payment Status</label>
              <select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="paid">✅ Paid</option>
                <option value="declined">❌ Declined</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Date</label>
              <input type="date" style={inp} value={form.payment_date} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', paddingTop:'20px' }}>
              <input type="checkbox" id="renewal" checked={form.is_renewal} onChange={e=>setForm(f=>({...f,is_renewal:e.target.checked}))} style={{ width:'16px', height:'16px', accentColor:'#C9A84C' }} />
              <label htmlFor="renewal" style={{ fontSize:'14px', fontWeight:'500', color:'#374151', cursor:'pointer' }}>This is a renewal</label>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, minHeight:'60px', resize:'vertical' }} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Reference, notes..." />
            </div>
          </div>
        </div>
        {form.status==='paid' && (
          <div style={{ background:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', fontSize:'13px', color:'#065F46' }}>
            ⚡ Marking as <strong>Paid</strong> will automatically add <strong>{form.number_of_classes} classes</strong> to this student.
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

export default function AccountantNewPaymentPage() {
  return <Suspense fallback={<div style={{ padding:'60px', textAlign:'center', color:'#6B7280' }}>Loading…</div>}><NewPaymentForm /></Suspense>
}
