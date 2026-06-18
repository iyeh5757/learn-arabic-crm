'use client'
// app/(dashboard)/sales/students/new/page.tsx
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const COUNTRIES = ['Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria','Cambodia','Canada','Chile','China','Colombia','Croatia','Cyprus','Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guatemala','Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Lebanon','Libya','Luxembourg','Malaysia','Malta','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Senegal','Serbia','Singapore','Somalia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Tanzania','Thailand','Tunisia','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe','Other']
const COUNTRY_CURRENCY: Record<string, string> = { 'Egypt':'EGP','United Arab Emirates':'AED','Saudi Arabia':'AED','Kuwait':'AED','Qatar':'AED','Bahrain':'AED','Oman':'AED','United Kingdom':'GBP','Germany':'EUR','France':'EUR','Netherlands':'EUR','Belgium':'EUR','Switzerland':'EUR','Austria':'EUR','United States':'USD','Canada':'USD','Australia':'USD' }
const PRESET_CLASSES = [4, 8, 12, 16, 20]

export default function SalesNewStudentPage() {
  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  

  const router = useRouter()
  const supabase = createClient()

    const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [classMode, setClassMode] = useState<'preset'|'custom'>('preset')

  const [form, setForm] = useState({
    name:'', email:'', phone:'', country:'',
    currency:'USD', session_duration:60,
    assigned_teacher_id:'', student_status:'trial',
    reminder_date:'', notes:'', payment_method:'',
    payment_status:'pending', number_of_classes:16,
    custom_classes:'', amount:'',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ''))
    supabase.from('teachers').select('id, user_id, specialties, languages, profile:profiles!teachers_user_id_fkey(name)').eq('is_active', true).then(({ data }) => setTeachers(data ?? []))
  }, [])

  const totalClasses = classMode === 'preset' ? form.number_of_classes : (Number(form.custom_classes) || 0)
  const sym = form.currency === 'USD' ? '$' : form.currency === 'GBP' ? '£' : form.currency === 'EUR' ? '€' : 'AED '

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { setError('Full name is required'); return }
    setLoading(true); setError('')
    try {
      // Check for duplicate email
      if (form.email) {
        const { data: existing } = await supabase
          .from('students').select('id, name').eq('email', form.email).maybeSingle()
        if (existing) {
          setError(`A student with this email already exists: ${existing.name}`)
          setLoading(false)
          return
        }
      }

  const { data: newStudent, error: err } = await supabase.from('students').insert({
        name: form.name, email: form.email || null, phone: form.phone || null,
        country: form.country || null, currency: form.currency,
        session_duration: Number(form.session_duration),
        assigned_teacher_id: form.assigned_teacher_id || null,
        added_by_sales_id: currentUserId,
        student_status: form.student_status,
        payment_method: form.payment_method || null,
        payment_status: form.payment_status,
        reminder_date: form.reminder_date || null,
        notes: form.notes || null,
        total_paid_classes: 0, consumed_classes: 0,
      }).select('id').single()
      if (err) throw new Error(err.message)

      if (totalClasses > 0 && Number(form.amount) > 0) {
        const { error: payErr } = await supabase.from('payments').insert({
          student_id: newStudent.id, number_of_classes: totalClasses,
          amount: Number(form.amount), currency: form.currency,
          payment_method: form.payment_method || 'Other',
          status: form.payment_status, added_by: currentUserId,
          payment_date: today, is_renewal: false,
        })
        if (payErr) throw new Error(payErr.message)
      }
      router.push('/sales/students')
      router.refresh()
    } catch(err: any) { setError(err.message); setLoading(false) }
  }

  const inp = { width:'100%', padding:'9px 14px', border:'1.5px solid #E5E7EB', borderRadius:'8px', fontSize:'14px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }
  const lbl = { display:'block', fontSize:'11px', fontWeight:'600' as const, color:'#6B7280', textTransform:'uppercase' as const, letterSpacing:'0.05em', marginBottom:'6px' }
  const card = { background:'#fff', border:'1px solid #E5E7EB', borderRadius:'14px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:'20px' }
  const cardH = { padding:'14px 22px', borderBottom:'1px solid #F3F4F6', fontWeight:'600' as const, fontSize:'15px', color:'#111827' }
  const grid = { padding:'20px 22px', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'16px' }

  return (
    <div style={{ maxWidth:'920px' }}>
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#111827', margin:0 }}>Add New Student</h1>
        <p style={{ color:'#6B7280', fontSize:'14px', margin:'4px 0 0 0' }}>You will be automatically linked as the sales agent</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={card}>
          <div style={cardH}>👤 Personal Information</div>
          <div style={grid}>
            <div><label style={lbl}>Full Name *</label><input style={inp} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} required /></div>
            <div><label style={lbl}>Email</label><input type="email" style={inp} value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></div>
            <div><label style={lbl}>Phone</label><input style={inp} value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} placeholder="+44 7..." /></div>
            <div><label style={lbl}>Country</label>
              <select style={inp} value={form.country} onChange={e => setForm(f=>({...f,country:e.target.value,currency:COUNTRY_CURRENCY[e.target.value]??'USD'}))}>
                <option value="">Select country</option>
                {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={cardH}>📚 Learning Setup</div>
          <div style={grid}>
            <div><label style={lbl}>Assigned Teacher</label>
              <select style={inp} value={form.assigned_teacher_id} onChange={e=>setForm(f=>({...f,assigned_teacher_id:e.target.value}))}>
                <option value="">Select teacher</option>
                {teachers.map((t:any)=><option key={t.id} value={t.id}>{(t.profile as any)?.name || (Array.isArray(t.profile) ? (t.profile as any)[0]?.name : '') || 'Unknown Teacher'}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Session Duration</label>
              <select style={inp} value={form.session_duration} onChange={e=>setForm(f=>({...f,session_duration:Number(e.target.value)}))}>
                <option value={30}>30 minutes</option>
                <option value={40}>40 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
                <option value={90}>90 minutes (1.5 hours)</option>
                <option value={120}>120 minutes (2 hours)</option>
              </select>
            </div>
            <div><label style={lbl}>Student Status</label>
              <select style={inp} value={form.student_status} onChange={e=>setForm(f=>({...f,student_status:e.target.value}))}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={cardH}>💳 Payment & Classes</div>
          <div style={grid}>
            <div><label style={lbl}>Currency</label>
              <select style={inp} value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
                <option value="USD">USD</option><option value="GBP">GBP</option><option value="EUR">EUR</option><option value="AED">AED</option><option value="EGP">EGP</option>
              </select>
            </div>
            <div><label style={lbl}>Payment Method</label>
              <select style={inp} value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}>
                <option value="">Select method</option>
                {['PayPal','Stripe','EU Bank','UAE Bank','UK Bank','US Bank','Western Union','Instapay','Vodafone Cash'].map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Payment Status</label>
              <select style={inp} value={form.payment_status} onChange={e=>setForm(f=>({...f,payment_status:e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="paid">✅ Paid</option>
                <option value="declined">❌ Declined</option>
              </select>
            </div>
            <div><label style={lbl}>Reminder Date</label>
              <input type="date" style={inp} value={form.reminder_date} onChange={e=>setForm(f=>({...f,reminder_date:e.target.value}))} />
            </div>
          </div>
          <div style={{ borderTop:'1px solid #F3F4F6', padding:'20px 22px' }}>
            <p style={{ fontWeight:'600', color:'#374151', margin:'0 0 12px 0', fontSize:'14px' }}>📦 Classes Purchased</p>
            <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
              {(['preset','custom'] as const).map(m=>(
                <button key={m} type="button" onClick={()=>setClassMode(m)}
                  style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${classMode===m?'#0D1B2A':'#E5E7EB'}`, background:classMode===m?'#0D1B2A':'#fff', color:classMode===m?'#E8C97A':'#6B7280', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
                  {m==='preset'?'Preset Plans':'Custom Amount'}
                </button>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'16px' }}>
              <div><label style={lbl}>Number of Classes</label>
                {classMode==='preset'
                  ? <select style={inp} value={form.number_of_classes} onChange={e=>setForm(f=>({...f,number_of_classes:Number(e.target.value)}))}>
                      <option value={0}>0 — Trial only</option>
                      {PRESET_CLASSES.map(n=><option key={n} value={n}>{n} sessions{n===16?' ⭐':''}</option>)}
                    </select>
                  : <input type="number" min="0" style={inp} value={form.custom_classes} onChange={e=>setForm(f=>({...f,custom_classes:e.target.value}))} placeholder="e.g. 24" />
                }
              </div>
              <div><label style={lbl}>Amount Paid ({form.currency})</label>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#6B7280' }}>{sym}</span>
                  <input type="number" step="0.01" min="0" style={{ ...inp, paddingLeft:'36px' }} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" />
                </div>
              </div>
            </div>
            {form.payment_status==='paid' && totalClasses>0 && Number(form.amount)>0 && (
              <div style={{ background:'#ECFDF5', border:'1px solid #6EE7B7', borderRadius:'8px', padding:'10px 14px', marginTop:'12px', fontSize:'13px', color:'#065F46' }}>
                ⚡ Marking as <strong>Paid</strong> adds <strong>{totalClasses} classes</strong> and generates your commission automatically.
              </div>
            )}
          </div>
        </div>
        <div style={card}>
          <div style={{ padding:'20px 22px' }}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight:'70px', resize:'vertical' }} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes..." />
          </div>
        </div>
        {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', color:'#DC2626', padding:'12px 16px', borderRadius:'8px', fontSize:'14px', marginBottom:'16px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'12px' }}>
          <button type="submit" disabled={loading} style={{ background:'#0D1B2A', color:'#E8C97A', padding:'12px 28px', borderRadius:'10px', border:'none', fontWeight:'600', fontSize:'14px', cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1 }}>
            {loading?'Saving…':'Add Student'}
          </button>
          <button type="button" onClick={()=>router.back()} style={{ background:'transparent', color:'#6B7280', padding:'12px 22px', borderRadius:'10px', border:'1.5px solid #E5E7EB', fontWeight:'500', fontSize:'14px', cursor:'pointer' }}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
