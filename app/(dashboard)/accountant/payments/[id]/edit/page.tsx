'use client'
// app/(dashboard)/accountant/payments/[id]/edit/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

export default function AccountantPaymentEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<any>(null)
  const [studentInfo, setStudentInfo] = useState<any>(null)

  useEffect(() => {
    supabase.from('payments').select('*, student:students(id, name, currency, total_paid_classes, consumed_classes)').eq('id', id).single().then(({ data }) => {
      if (data) { setForm(data); setStudentInfo(data.student) }
      setLoading(false)
    })
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const { error: err } = await supabase.from('payments').update({
      number_of_classes: Number(form.number_of_classes),
      amount: Number(form.amount),
      currency: form.currency,
      payment_method: form.payment_method,
      status: form.status,
      payment_date: form.payment_date || null,
      is_renewal: form.is_renewal,
      notes: form.notes || null,
    }).eq('id', id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/accountant/payments')
    router.refresh()
  }

  const inp = { width:'100%', padding:'9px 14px', border:'1.5px solid #E5E7EB', borderRadius:'8px', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }
  const lbl = { display:'block', fontSize:'11px', fontWeight:'600' as const, color:'#6B7280', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:'6px' }
  const grid = { padding:'20px 22px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'16px' }

  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:'#6B7280' }}>Loading…</div>
  if (!form) return <div style={{ padding:'60px', textAlign:'center', color:'#DC2626' }}>Payment not found</div>

  const sym = form.currency === 'USD' ? '$' : form.currency === 'GBP' ? '£' : form.currency === 'EUR' ? '€' : 'AED '

  return (
    <div style={{ maxWidth:'860px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#111827', margin:0 }}>Edit Payment</h1>
        <p style={{ color:'#6B7280', fontSize:'14px', margin:'4px 0 0 0' }}>Student: <strong>{studentInfo?.name}</strong></p>
      </div>

      {studentInfo && (
        <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'12px', padding:'16px 20px', marginBottom:'20px', display:'flex', gap:'24px', flexWrap:'wrap' }}>
          <div><p style={{ fontSize:'11px', color:'#6B7280', margin:'0 0 2px 0', textTransform:'uppercase' }}>Total Classes</p><p style={{ fontWeight:'700', color:'#111827', margin:0, fontSize:'18px' }}>{studentInfo.total_paid_classes}</p></div>
          <div><p style={{ fontSize:'11px', color:'#6B7280', margin:'0 0 2px 0', textTransform:'uppercase' }}>Consumed</p><p style={{ fontWeight:'700', color:'#111827', margin:0, fontSize:'18px' }}>{studentInfo.consumed_classes}</p></div>
          <div><p style={{ fontSize:'11px', color:'#6B7280', margin:'0 0 2px 0', textTransform:'uppercase' }}>Remaining</p><p style={{ fontWeight:'700', color:(studentInfo.total_paid_classes-studentInfo.consumed_classes)<=2?'#D97706':'#059669', margin:0, fontSize:'18px' }}>{studentInfo.total_paid_classes-studentInfo.consumed_classes}</p></div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:'14px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'20px' }}>
          <div style={{ padding:'14px 22px', borderBottom:'1px solid #F3F4F6', fontWeight:'600', fontSize:'15px', color:'#111827' }}>Payment Details</div>
          <div style={grid}>
            <div><label style={lbl}>Number of Classes</label>
              <select style={inp} value={form.number_of_classes} onChange={e=>setForm((f:any)=>({...f,number_of_classes:Number(e.target.value)}))}>
                {[4,8,12,16,20].map(n=><option key={n} value={n}>{n} sessions{n===16?' ⭐':''}</option>)}
                {![4,8,12,16,20].includes(Number(form.number_of_classes)) && <option value={form.number_of_classes}>{form.number_of_classes} sessions (current)</option>}
              </select>
            </div>
            <div><label style={lbl}>Amount</label>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#6B7280' }}>{sym}</span>
                <input type="number" step="0.01" style={{ ...inp, paddingLeft:'36px' }} value={form.amount} onChange={e=>setForm((f:any)=>({...f,amount:e.target.value}))} />
              </div>
            </div>
            <div><label style={lbl}>Currency</label>
              <select style={inp} value={form.currency} onChange={e=>setForm((f:any)=>({...f,currency:e.target.value}))}>
                <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Method</label>
              <select style={inp} value={form.payment_method} onChange={e=>setForm((f:any)=>({...f,payment_method:e.target.value}))}>
                {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Status</label>
              <select style={inp} value={form.status} onChange={e=>setForm((f:any)=>({...f,status:e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="paid">✅ Paid</option>
                <option value="declined">❌ Declined</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Date</label>
              <input type="date" style={inp} value={form.payment_date??''} onChange={e=>setForm((f:any)=>({...f,payment_date:e.target.value}))} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', paddingTop:'20px' }}>
              <input type="checkbox" id="renewal" checked={form.is_renewal} onChange={e=>setForm((f:any)=>({...f,is_renewal:e.target.checked}))} style={{ width:'16px', height:'16px', accentColor:'#C9A84C' }} />
              <label htmlFor="renewal" style={{ fontSize:'14px', fontWeight:'500', color:'#374151', cursor:'pointer' }}>Renewal payment</label>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label style={lbl}>Notes</label>
              <textarea style={{ ...inp, minHeight:'60px', resize:'vertical' }} value={form.notes??''} onChange={e=>setForm((f:any)=>({...f,notes:e.target.value}))} />
            </div>
          </div>
        </div>
        {form.status==='paid' && (
          <div style={{ background:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', fontSize:'13px', color:'#065F46' }}>
            ⚡ Saving as <strong>Paid</strong> will automatically update this student's class count.
          </div>
        )}
        {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'12px 16px', borderRadius:'8px', fontSize:'14px', marginBottom:'16px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'12px' }}>
          <button type="submit" disabled={saving} style={{ background:'#0D1B2A', color:'#E8C97A', padding:'12px 28px', borderRadius:'10px', border:'none', fontWeight:'600', fontSize:'14px', cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>
            {saving?'Saving…':'Save Changes'}
          </button>
          <button type="button" onClick={()=>router.back()} style={{ background:'transparent', color:'#6B7280', padding:'12px 22px', borderRadius:'10px', border:'1.5px solid #E5E7EB', fontWeight:'500', fontSize:'14px', cursor:'pointer' }}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
