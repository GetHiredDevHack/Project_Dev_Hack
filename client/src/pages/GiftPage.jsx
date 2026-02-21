import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api, formatCurrency } from '../utils/api'
import { Search, UserCheck, UserX, Mail, Send, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Trash2, Clock } from 'lucide-react'

const FARE_BY_TYPE = { Adult: 3.10, Youth: 2.30, Senior: 1.55, 'Post-Sec': 3.10, Child: 0 }

// ── Guest QR Display ──────────────────────────────────────────────────────
function GuestQRDisplay({ token, onSimScan }) {
  const [tick, setTick] = useState(0)
  const [scanResult, setScanResult] = useState(null)

  useEffect(() => {
    const iv = setInterval(() => setTick(t=>t+1), 1000)
    return () => clearInterval(iv)
  }, [])

  if (!token) return null
  const now = Date.now()

  let minsLeft = null, secsLeft = null, pct = 100
  if (token.firstScannedAt) {
    const expiry = new Date(token.firstScannedAt).getTime() + 90*60*1000
    const remaining = Math.max(0, expiry - now)
    minsLeft = Math.floor(remaining / 60000)
    secsLeft = Math.floor((remaining % 60000) / 1000)
    pct = (remaining / (90*60*1000)) * 100
    if (remaining === 0 && token.status !== 'used') token.status = 'expired'
  }

  const cells = []
  for (let i = 0; i < 15*15; i++) {
    cells.push((token.id.charCodeAt(i % token.id.length) + i*7) % 3 === 0)
  }

  const handleSim = async () => {
    const res = await onSimScan(token.id)
    setScanResult(res)
    setTimeout(() => setScanResult(null), 4000)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2">
        {token.status === 'expired' ? (
          <div className="w-32 h-32 rounded-xl bg-red/10 border border-red/30 flex flex-col items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red mb-1"/><div className="text-xs text-red font-semibold">Expired</div>
          </div>
        ) : (
          <div className="relative p-3 bg-white rounded-xl">
            <div style={{display:'grid',gridTemplateColumns:'repeat(15,8px)',gap:'1px'}}>
              {cells.map((f,i)=><div key={i} style={{width:8,height:8,background:f?'#0a1628':'transparent',borderRadius:1}}/>)}
            </div>
            {[[0,0],[0,9],[9,0]].map(([r,c],i)=>(
              <div key={i} className="absolute" style={{top:12+r*9,left:12+c*9,width:27,height:27,border:'2.5px solid #0a1628',borderRadius:3}}>
                <div style={{position:'absolute',top:3,left:3,width:13,height:13,background:'#0a1628',borderRadius:2}}/>
              </div>
            ))}
          </div>
        )}

        {token.firstScannedAt && minsLeft !== null && (
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="#1a3560" strokeWidth="3"/>
                <circle cx="20" cy="20" r="16" fill="none"
                  stroke={pct>40?'#00d68f':pct>15?'#ffb800':'#ff4757'}
                  strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*16}`}
                  strokeDashoffset={`${2*Math.PI*16*(1-pct/100)}`}
                  strokeLinecap="round" style={{transition:'stroke-dashoffset 1s linear'}}/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><Clock className="w-3 h-3 text-slate"/></div>
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-white">{minsLeft}:{secsLeft.toString().padStart(2,'0')}</div>
              <div className="text-xs text-slate">remaining (90 min total)</div>
            </div>
          </div>
        )}

        {!token.firstScannedAt && (
          <div className="text-xs text-slate text-center bg-white/5 rounded-lg px-4 py-2">
            ⏱ 90-min timer starts on first scan
          </div>
        )}

        <div className="font-mono text-[10px] text-slate/40">{token.id}</div>
      </div>

      <div className="text-xs text-slate bg-white/5 rounded-xl p-3 space-y-1 border border-white/10">
        <div className="text-white font-semibold mb-1">Guest Pass Rules</div>
        <div>⏱ 90-min window starts on first tap</div>
        <div>🔒 5-min rescan lock after each use</div>
        <div>❌ Cannot be forwarded or reused simultaneously</div>
        <div>Scan count: <span className="text-white font-semibold">{token.scanCount}</span></div>
      </div>

      <button onClick={handleSim} disabled={token.status==='expired'}
        className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-sm font-semibold transition-all disabled:opacity-40">
        Simulate Guest Scan
      </button>

      {scanResult && (
        <div className={`anim-scale-in p-3 rounded-xl text-sm border ${scanResult.accepted ? 'bg-green/10 border-green/30 text-green' : 'bg-red/10 border-red/30 text-red'}`}>
          {scanResult.accepted ? `✓ Accepted! Scan #${scanResult.token?.scanCount}` : `✕ ${scanResult.reason}`}
          {scanResult.fraudAttempt && <div className="text-xs text-amber mt-1">⚠ Fraud attempt logged</div>}
        </div>
      )}
    </div>
  )
}

// ── Main Gift Page ─────────────────────────────────────────────────────────
export default function GiftPage() {
  const { user, refreshUser } = useAuth()
  const fare = FARE_BY_TYPE[user.accountType] || 3.10

  const [mode, setMode] = useState('choose') // 'choose' | 'contact' | 'user' | 'guest'
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)

  // User lookup (email only)
  const [lookupInput, setLookupInput] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [lookupStatus, setLookupStatus] = useState(null)
  const [saveAsContact, setSaveAsContact] = useState(false)
  const [contactLabel, setContactLabel] = useState('')

  // Guest
  const [guestEmail, setGuestEmail] = useState('')

  // Shared
  const [amount, setAmount] = useState(null)
  const [customAmt, setCustomAmt] = useState('')
  const [step, setStep] = useState(1)
  const [result, setResult] = useState(null)
  const [guestToken, setGuestToken] = useState(null)
  const [sending, setSending] = useState(false)

  const [showContacts, setShowContacts] = useState(false)

  useEffect(() => {
    api.getContacts(user.id).then(d => setContacts(d.contacts)).catch(()=>{})
  }, [user])

  const handleLookup = async () => {
    if (!lookupInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lookupInput)) return
    setLookupStatus('loading')
    try {
      const data = await api.lookupUser(lookupInput)
      if (data.found) { setFoundUser(data.user); setLookupStatus('found') }
      else { setFoundUser(null); setLookupStatus('notfound') }
    } catch { setLookupStatus('notfound') }
  }

  const finalAmount = amount === 'custom' ? parseFloat(customAmt) : amount

  const handleSend = async () => {
    if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) return
    setSending(true)
    try {
      const fareCents = Math.round(finalAmount * 100)
      let payload = { senderId: user.id, fareCents, saveContact: saveAsContact, contactLabel }

      if (mode === 'contact' && selectedContact) {
        payload = { ...payload,
          recipientType: 'user',
          recipientEmail: selectedContact.email,
          contactId: selectedContact.id,
        }
        const lu = await api.lookupUser(selectedContact.email).catch(()=>({found:false}))
        if (lu.found) payload.recipientUserId = lu.user.id
      } else if (mode === 'user' && foundUser) {
        payload = { ...payload, recipientType:'user', recipientUserId:foundUser.id, recipientEmail:foundUser.email }
      } else if (mode === 'guest') {
        payload = { ...payload, recipientType:'guest', recipientEmail:guestEmail }
      }

      const res = await api.sendGift(payload)
      await refreshUser()
      const cData = await api.getContacts(user.id)
      setContacts(cData.contacts)

      if (mode === 'guest') setGuestToken(res.token)
      setResult(res)
      setStep(4)
    } catch (e) {
      alert(e.message)
    }
    setSending(false)
  }

  const handleSimGuestScan = async (tokenId) => {
    const res = await api.qrScan(tokenId, 'Route — Guest Scan').catch(e=>({accepted:false,reason:e.message}))
    const td = await api.getToken(tokenId).catch(()=>null)
    if (td) setGuestToken(td.token)
    return res
  }

  const deleteContact = async (cid) => {
    await api.deleteContact(cid)
    setContacts(c => c.filter(x => x.id !== cid))
  }

  const reset = () => { setMode('choose'); setStep(1); setResult(null); setGuestToken(null); setFoundUser(null); setLookupInput(''); setLookupStatus(null); setAmount(null); setCustomAmt(''); setSelectedContact(null); setGuestEmail(''); setSaveAsContact(false); setContactLabel('') }

  // ── Step 4: Done ──────────────────────────────────────────────────────────
  if (step === 4 && result) {
    const isGuest = mode === 'guest'
    return (
      <div className="anim-fade-up space-y-5">
        <div><h2 className="font-display text-3xl font-bold text-white">Gift a Fare</h2></div>
        <div className="bg-green/10 border border-green/30 rounded-2xl p-6 space-y-4 anim-scale-in">
          <div className="text-center">
            <div className="text-5xl mb-3">{isGuest ? '📧' : '🎁'}</div>
            <div className="font-display text-2xl font-bold text-green">{isGuest ? 'Guest Pass Sent!' : 'Fare Sent!'}</div>
            <div className="text-slate text-sm mt-1">{formatCurrency(finalAmount)} from your account</div>
          </div>
          {isGuest && guestToken && (
            <div className="border-t border-green/20 pt-4">
              <p className="text-xs text-slate text-center mb-4">
                QR code sent to <span className="text-white">{guestEmail}</span> — they scan it to board
              </p>
              <GuestQRDisplay token={guestToken} onSimScan={handleSimGuestScan}/>
            </div>
          )}
          {!isGuest && (
            <div className="text-center text-sm text-slate">
              Fare added directly to <span className="text-white">{foundUser?.name || selectedContact?.label}</span>'s balance.
            </div>
          )}
        </div>
        <button onClick={reset} className="w-full bg-blue hover:bg-blue-light text-white py-3 rounded-xl font-bold transition-colors">Send Another</button>
      </div>
    )
  }

  return (
    <div className="anim-fade-up space-y-5">
      <div className="anim-fade-up-1">
        <h2 className="font-display text-3xl font-bold text-white">Gift a Fare</h2>
        <p className="text-slate text-sm mt-1">Send a ride to a contact, user, or guest</p>
      </div>

      {/* ── STEP 1: Choose recipient type ── */}
      {step === 1 && (
        <div className="space-y-4 anim-fade-up-2">
          {/* Contacts section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate uppercase tracking-widest">Saved Contacts</div>
              <button onClick={()=>setShowContacts(s=>!s)} className="text-xs text-blue-light flex items-center gap-1">
                Manage {showContacts?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="text-xs text-slate/60 italic px-1">No saved contacts yet.</div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {contacts.map(c => (
                  <div key={c.id} className="relative flex-shrink-0">
                    <button onClick={()=>{ setSelectedContact(c); setMode('contact'); setStep(2) }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all w-20 ${selectedContact?.id===c.id?'border-blue bg-blue/20':'border-white/10 bg-white/5 hover:border-blue/40'}`}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{background:c.color}}>{c.initials}</div>
                      <div className="text-xs text-white font-medium truncate w-full text-center">{c.label}</div>
                    </button>
                    {showContacts && (
                      <button onClick={()=>deleteContact(c.id)} className="absolute -top-1 -right-1 w-5 h-5 bg-red rounded-full flex items-center justify-center">
                        <Trash2 className="w-2.5 h-2.5 text-white"/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-slate/40 uppercase tracking-widest text-center">— or send to —</div>

          {/* Registered user lookup */}
          <button onClick={()=>setMode('user')} className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${mode==='user'?'border-blue bg-blue/10':'border-white/10 bg-white/5 hover:border-blue/40'}`}>
            <div className="w-10 h-10 rounded-full bg-blue/20 flex items-center justify-center flex-shrink-0"><UserCheck className="w-5 h-5 text-blue-light"/></div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Registered User</div>
              <div className="text-xs text-slate">Look up by email — fare goes to their balance instantly</div>
            </div>
          </button>

          {/* Guest */}
          <button onClick={()=>setMode('guest')} className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${mode==='guest'?'border-amber bg-amber/10':'border-white/10 bg-white/5 hover:border-amber/40'}`}>
            <div className="w-10 h-10 rounded-full bg-amber/20 flex items-center justify-center flex-shrink-0"><Mail className="w-5 h-5 text-amber"/></div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Guest (No Account)</div>
              <div className="text-xs text-slate">Send a QR code via email · 90-min window after first tap</div>
            </div>
          </button>

          {/* User lookup form — email only */}
          {mode === 'user' && (
            <div className="anim-slide-down space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                <input type="email" placeholder="user@example.com" className="pl-9"
                  value={lookupInput} onChange={e=>{setLookupInput(e.target.value);setLookupStatus(null);setFoundUser(null)}} onKeyDown={e=>e.key==='Enter'&&handleLookup()}/>
              </div>
              <button onClick={handleLookup} disabled={!lookupInput||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lookupInput)||lookupStatus==='loading'}
                className="w-full py-2 rounded-xl bg-blue/20 border border-blue/30 text-blue-light text-sm font-semibold hover:bg-blue hover:text-white transition-all disabled:opacity-50">
                {lookupStatus==='loading'?'Looking up…':<><Search className="w-3.5 h-3.5 inline mr-1"/>Look Up User</>}
              </button>

              {lookupStatus === 'found' && foundUser && (
                <div className="anim-scale-in bg-green/10 border border-green/30 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{background:foundUser.photoColor}}>{foundUser.photoInitials}</div>
                  <div className="flex-1"><div className="text-sm font-semibold text-white">{foundUser.name}</div><div className="text-xs text-slate">{foundUser.accountType}</div></div>
                  <UserCheck className="w-5 h-5 text-green"/>
                </div>
              )}
              {lookupStatus === 'notfound' && (
                <div className="anim-scale-in bg-amber/10 border border-amber/30 rounded-xl p-3 flex items-center gap-2 text-xs text-amber">
                  <UserX className="w-4 h-4 flex-shrink-0"/>No TransitLink account found with that email. Switch to Guest to send a QR code instead.
                </div>
              )}

              {lookupStatus === 'found' && foundUser && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate">
                    <input type="checkbox" checked={saveAsContact} onChange={e=>setSaveAsContact(e.target.checked)} style={{width:'auto',padding:0,border:'none',background:'none'}} className="w-4 h-4"/>
                    Save as contact
                  </label>
                  {saveAsContact && <input type="text" placeholder="Contact label (e.g. Mom, Jordan)" value={contactLabel} onChange={e=>setContactLabel(e.target.value)}/>}
                  <button onClick={()=>setStep(2)} className="w-full py-2.5 rounded-xl bg-blue hover:bg-blue-light text-white text-sm font-bold transition-colors">
                    Continue →
                  </button>
                </>
              )}
            </div>
          )}

          {/* Guest form */}
          {mode === 'guest' && (
            <div className="anim-slide-down space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                <input type="email" placeholder="guest@example.com" className="pl-9" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)}/></div>
              <div className="text-xs text-slate/70 space-y-0.5">
                <div>⏱ 90-min window starts on first tap</div><div>🔒 5-min rescan lock after each use</div>
              </div>
              <button onClick={()=>setStep(2)} disabled={!guestEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)}
                className="w-full py-2.5 rounded-xl bg-amber hover:bg-amber-light text-navy text-sm font-bold transition-colors disabled:opacity-40">
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Amount ── */}
      {step === 2 && (
        <div className="space-y-4 anim-fade-up-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{background: selectedContact?.color || foundUser?.photoColor || '#ffb800'}}>
              {selectedContact?.initials || foundUser?.photoInitials || guestEmail[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{selectedContact?.label || foundUser?.name || guestEmail}</div>
              <div className="text-xs text-slate">{mode === 'guest' ? 'Guest — QR via email' : 'TransitLink user'}</div>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate uppercase tracking-widest">Select Amount</div>
          <div className="grid grid-cols-2 gap-2">
            {[{label:`1 Ride (${formatCurrency(fare)})`,val:fare},{label:`2 Rides (${formatCurrency(fare*2)})`,val:fare*2},{label:'$10',val:10},{label:'Custom',val:'custom'}].map(a=>(
              <button key={a.label} onClick={()=>setAmount(a.val)}
                className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${amount===a.val?'bg-blue border-blue text-white':'border-white/10 bg-white/5 text-slate hover:border-blue/40'}`}>
                {a.label}
              </button>
            ))}
          </div>
          {amount === 'custom' && <input type="number" placeholder="Enter amount (e.g. 6.20)" step="0.10" min="0.10" value={customAmt} onChange={e=>setCustomAmt(e.target.value)} className="anim-slide-down"/>}

          {finalAmount && !isNaN(finalAmount) && (
            <div className={`p-3 rounded-xl text-sm border ${user.balance>=finalAmount?'bg-green/10 border-green/30 text-green':'bg-red/10 border-red/30 text-red'}`}>
              {user.balance>=finalAmount?`✓ Your balance after: ${formatCurrency(user.balance-finalAmount)}`:`✕ Insufficient — you have ${formatCurrency(user.balance)}`}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={()=>setStep(1)} className="flex-1 py-3 rounded-xl border border-white/10 text-slate text-sm hover:text-white transition-colors">← Back</button>
            <button onClick={handleSend} disabled={!finalAmount||isNaN(finalAmount)||user.balance<(finalAmount||0)||sending}
              className="flex-1 py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-bold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {sending?'Sending…':<><Send className="w-4 h-4"/>Send {finalAmount&&!isNaN(finalAmount)?formatCurrency(finalAmount):''}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
