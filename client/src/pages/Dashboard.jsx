import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api, formatCurrency, timeAgo, TX_ICON } from '../utils/api'
import { Plus, Send, Wifi, Users, AlertTriangle, CheckCircle, ChevronRight, CreditCard, X, Link, Unlink, Info } from 'lucide-react'

const FARE_BY_TYPE = { Adult: 3.10, Youth: 2.30, Senior: 1.55, 'Post-Sec': 3.10, Child: 0 }

export default function Dashboard({ onNavigate }) {
  const { user, refreshUser } = useAuth()
  const [txs, setTxs] = useState([])
  const [topUpPanel, setTopUpPanel] = useState(null) // null | 'amount' | 'payment'
  const [topUpMsg, setTopUpMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  // Top-up state
  const [topUpAmt, setTopUpAmt] = useState(null)
  const [customTopUp, setCustomTopUp] = useState('')
  const [payCard, setPayCard] = useState({ number: '', expiry: '', cvv: '', name: '' })
  const [payError, setPayError] = useState('')

  // Card linking state
  const [showCardLink, setShowCardLink] = useState(false)
  const [cardLinkInput, setCardLinkInput] = useState('')
  const [cardLinkMsg, setCardLinkMsg] = useState(null)

  const fare = FARE_BY_TYPE[user.accountType] || 3.10
  const isLow = user.balance < fare * 2

  useEffect(() => {
    api.getTransactions(user.id).then(d => setTxs(d.transactions.slice(0,5))).catch(()=>{})
  }, [user])

  // Format card number with spaces
  const formatCardNum = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16)
    return digits.replace(/(.{4})/g, '$1 ').trim()
  }

  // Format expiry as MM/YY
  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 4)
    if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2)
    return digits
  }

  const selectedDollars = topUpAmt === 'custom' ? parseFloat(customTopUp) : topUpAmt

  const handleProceedToPayment = () => {
    if (!selectedDollars || selectedDollars < 5) return
    setPayError('')
    setTopUpPanel('payment')
  }

  const handleTopUp = async () => {
    setPayError('')
    const cleanCard = payCard.number.replace(/\s/g, '')
    if (cleanCard.length < 13) { setPayError('Invalid card number.'); return }
    if (!/^\d{2}\/\d{2}$/.test(payCard.expiry)) { setPayError('Invalid expiry (MM/YY).'); return }
    // Check expired
    const [expM, expY] = payCard.expiry.split('/').map(Number)
    if (expM < 1 || expM > 12) { setPayError('Invalid expiry month (01–12).'); return }
    const now = new Date()
    if (expY < now.getFullYear() % 100 || (expY === now.getFullYear() % 100 && expM < now.getMonth() + 1)) {
      setPayError('This card has expired.'); return
    }
    if (!/^\d{3,4}$/.test(payCard.cvv)) { setPayError('Invalid CVV.'); return }
    if (!payCard.name.trim()) { setPayError('Cardholder name required.'); return }

    setLoading(true)
    try {
      await api.topUp(user.id, {
        amountCents: Math.round(selectedDollars * 100),
        cardNumber: cleanCard,
        cardExpiry: payCard.expiry,
        cardCvv: payCard.cvv,
        cardName: payCard.name,
      })
      await refreshUser()
      const data = await api.getTransactions(user.id)
      setTxs(data.transactions.slice(0,5))
      setTopUpPanel(null)
      setTopUpAmt(null)
      setCustomTopUp('')
      setPayCard({ number: '', expiry: '', cvv: '', name: '' })
      setTopUpMsg(`+${formatCurrency(selectedDollars)} added!`)
      setTimeout(() => setTopUpMsg(null), 3000)
    } catch (e) {
      setPayError(e.message)
    }
    setLoading(false)
  }

  const handleLinkCard = async () => {
    setCardLinkMsg(null)
    try {
      await api.linkCard(user.id, cardLinkInput.trim())
      await refreshUser()
      setCardLinkMsg({ ok: true, text: 'Peggo card linked!' })
      setCardLinkInput('')
      setShowCardLink(false)
      setTimeout(() => setCardLinkMsg(null), 3000)
    } catch (e) {
      setCardLinkMsg({ ok: false, text: e.message })
    }
  }

  const handleUnlinkCard = async () => {
    try {
      await api.unlinkCard(user.id)
      await refreshUser()
      setCardLinkMsg({ ok: true, text: 'Card unlinked.' })
      setTimeout(() => setCardLinkMsg(null), 3000)
    } catch (e) {
      setCardLinkMsg({ ok: false, text: e.message })
    }
  }

  const closeTopUp = () => {
    setTopUpPanel(null); setTopUpAmt(null); setCustomTopUp(''); setPayError('')
    setPayCard({ number: '', expiry: '', cvv: '', name: '' })
  }

  return (
    <div className="space-y-5 anim-fade-up">
      {/* Transit card — Peggo card visual */}
      <div className="transit-card rounded-2xl anim-fade-up-1" style={{minHeight: '200px'}}>
        {/* Peggo image background + overlay */}
        <div className="transit-card-bg rounded-2xl"/>
        <div className="transit-card-overlay rounded-2xl"/>

        {/* Decorative scan-line texture */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.015) 30px, rgba(255,255,255,0.015) 31px)',
        }}/>

        <div className="relative z-10 p-5 flex flex-col justify-between" style={{minHeight: '200px'}}>
          {/* Top row: name + linked status */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-0.5">{user.accountType}</div>
              <div className="font-display text-xl font-bold text-white leading-tight">{user.name}</div>
            </div>
            <div className={`text-[10px] px-2 py-1 rounded-full font-mono border backdrop-blur-sm flex-shrink-0 ${user.linkedCard ? 'bg-green/15 text-green border-green/30' : 'bg-amber/15 text-amber border-amber/30'}`}>
              {user.linkedCard ? '● LINKED' : '○ APP ONLY'}
            </div>
          </div>

          {/* Card number — 10 digits as XX XXXX XXXX */}
          <div className="mt-4">
            <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1 font-mono">Card Number</div>
            <div className="font-mono text-white/80 tracking-[0.2em] text-base">
              {user.peggoId
                ? user.peggoId.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')
                : '—— ———— ————'}
            </div>
          </div>

          {/* Bottom row: balance + fare */}
          <div className="flex items-end justify-between mt-4">
            <div>
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5 font-mono">Balance</div>
              <div className={`font-display text-3xl font-bold ${isLow ? 'text-amber' : 'text-white'}`}>{formatCurrency(user.balance)}</div>
              {isLow && fare > 0 && (
                <div className="text-xs text-amber mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3"/>{Math.floor(user.balance/fare)} ride{Math.floor(user.balance/fare)!==1?'s':''} left
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/30 font-mono uppercase">e-cash Fare</div>
              <div className="font-mono text-lg font-bold text-white/80">{fare === 0 ? 'FREE' : formatCurrency(fare)}</div>
            </div>
          </div>
        </div>

        {/* Bottom brand strip */}
        <div className="peggo-brand-strip"/>
      </div>

      {/* Fraud warning */}
      {user.fraudFlags > 0 && (
        <div className="bg-amber/10 border border-amber/30 rounded-xl p-3 flex items-center gap-3 anim-fade-up-2">
          <AlertTriangle className="w-5 h-5 text-amber flex-shrink-0"/>
          <div><div className="text-sm font-semibold text-amber">Security Notice</div>
            <div className="text-xs text-amber/70">{user.fraudFlags} fraud flag(s) on this account.</div></div>
        </div>
      )}

      {/* Feedback banners */}
      {topUpMsg && <div className="anim-slide-down bg-green/10 border border-green/30 rounded-xl p-3 flex items-center gap-3"><CheckCircle className="w-5 h-5 text-green"/><span className="text-sm font-semibold text-green">{topUpMsg}</span></div>}
      {cardLinkMsg && <div className={`anim-slide-down rounded-xl p-3 text-sm font-semibold border ${cardLinkMsg.ok ? 'bg-green/10 border-green/30 text-green' : 'bg-red/10 border-red/30 text-red'}`}>{cardLinkMsg.text}</div>}

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2 anim-fade-up-2">
        {[
          { icon:Plus,  label:'Top Up',    action:()=>setTopUpPanel('amount'), color:'text-blue-light' },
          { icon:Send,  label:'Gift Fare', action:()=>onNavigate('gift'),      color:'text-amber'      },
          { icon:Wifi,  label:'Tap Pass',  action:()=>onNavigate('qr'),        color:'text-green'      },
          { icon:Users, label:'Family',    action:()=>onNavigate('pool'),      color:'text-slate'      },
        ].map(({icon:Icon,label,action,color}) => (
          <button key={label} onClick={action} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-blue/40 hover:bg-blue/10 transition-all">
            <Icon className={`w-5 h-5 ${color}`}/><span className="text-xs text-slate">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Top-up: Step 1 — Amount selection ── */}
      {topUpPanel === 'amount' && (
        <div className="anim-scale-in bg-navy-light border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Top Up Balance</span>
            <button onClick={closeTopUp} className="text-slate hover:text-white"><X className="w-4 h-4"/></button>
          </div>
          <div className="text-xs text-slate">Select an amount (minimum $5.00):</div>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15, 20, 30, 50].map(amt => (
              <button key={amt} onClick={()=>{setTopUpAmt(amt);setCustomTopUp('')}}
                className={`py-3 rounded-xl border font-bold font-mono transition-all ${topUpAmt===amt ? 'bg-blue border-blue text-white' : 'bg-blue/10 border-blue/30 text-blue-light hover:bg-blue hover:text-white'}`}>
                ${amt}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setTopUpAmt('custom')}
              className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${topUpAmt==='custom'?'bg-blue border-blue text-white':'border-white/10 text-slate hover:border-blue/40'}`}>
              Custom
            </button>
            {topUpAmt === 'custom' && (
              <input type="number" placeholder="Amount ($)" min="5" step="0.10" className="flex-1 anim-slide-down"
                value={customTopUp} onChange={e=>setCustomTopUp(e.target.value)}/>
            )}
          </div>
          {selectedDollars > 0 && (
            <div className="text-xs text-slate bg-white/5 rounded-lg p-2 text-center">
              New balance will be: <span className="text-white font-semibold">{formatCurrency(user.balance + selectedDollars)}</span>
            </div>
          )}
          <button onClick={handleProceedToPayment} disabled={!selectedDollars || selectedDollars < 5}
            className="w-full py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            <CreditCard className="w-4 h-4"/> Continue to Payment →
          </button>
        </div>
      )}

      {/* ── Top-up: Step 2 — Payment form ── */}
      {topUpPanel === 'payment' && (
        <div className="anim-scale-in bg-navy-light border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-white">Payment Details</span>
              <span className="text-xs text-blue-light ml-2 font-mono">{formatCurrency(selectedDollars)}</span>
            </div>
            <button onClick={closeTopUp} className="text-slate hover:text-white"><X className="w-4 h-4"/></button>
          </div>

          {/* Card Number */}
          <div>
            <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Card Number</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
              <input type="text" placeholder="4242 4242 4242 4242" className="pl-9 font-mono"
                value={payCard.number} onChange={e=>setPayCard(d=>({...d,number:formatCardNum(e.target.value)}))}
                maxLength={19}/>
            </div>
          </div>

          {/* Expiry + CVV row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Expiry</label>
              <input type="text" placeholder="MM/YY" className="font-mono"
                value={payCard.expiry} onChange={e=>setPayCard(d=>({...d,expiry:formatExpiry(e.target.value)}))}
                maxLength={5}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">CVV</label>
              <input type="text" placeholder="123" className="font-mono"
                value={payCard.cvv} onChange={e=>setPayCard(d=>({...d,cvv:e.target.value.replace(/\D/g,'').slice(0,4)}))}
                maxLength={4}/>
            </div>
          </div>

          {/* Cardholder name */}
          <div>
            <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Cardholder Name</label>
            <input type="text" placeholder="Jane Smith"
              value={payCard.name} onChange={e=>setPayCard(d=>({...d,name:e.target.value}))}/>
          </div>

          {payError && <p className="text-red text-xs bg-red/10 border border-red/20 rounded-lg px-3 py-2">{payError}</p>}

          <div className="text-xs text-slate/40 flex items-start gap-1.5">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5"/>
            <span>Demo mode — no real charges. Use any test card number (e.g. 4242 4242 4242 4242).</span>
          </div>

          <div className="flex gap-2">
            <button onClick={()=>setTopUpPanel('amount')} className="flex-1 py-3 rounded-xl border border-white/10 text-slate text-sm hover:text-white transition-colors">
              ← Back
            </button>
            <button onClick={handleTopUp} disabled={loading}
              className="flex-1 py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? 'Processing…' : `Pay ${formatCurrency(selectedDollars)}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Link / Manage Peggo Card ── */}
      <div className="anim-fade-up-3">
        {user.linkedCard ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-green/20 flex items-center justify-center"><CreditCard className="w-4 h-4 text-green"/></div>
                <div>
                  <div className="text-sm font-semibold text-white">Peggo Card Linked</div>
                  <div className="text-xs text-slate font-mono">
                    {user.peggoId ? user.peggoId.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3') : user.peggoId}
                  </div>
                </div>
              </div>
              <button onClick={handleUnlinkCard} className="text-xs text-red/70 hover:text-red flex items-center gap-1 transition-colors">
                <Unlink className="w-3 h-3"/> Unlink
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber/20 flex items-center justify-center"><CreditCard className="w-4 h-4 text-amber"/></div>
                <div>
                  <div className="text-sm font-semibold text-white">Link a Peggo Card</div>
                  <div className="text-xs text-slate">Connect your existing physical card to this account</div>
                </div>
              </div>
              <button onClick={()=>setShowCardLink(s=>!s)} className="text-xs text-blue-light hover:underline">
                {showCardLink ? 'Cancel' : 'Link'}
              </button>
            </div>
            {showCardLink && (
              <div className="anim-slide-down space-y-2 pt-2 border-t border-white/5">
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                  <input type="text" placeholder="10-digit card number" className="pl-9 font-mono"
                    value={cardLinkInput} onChange={e=>setCardLinkInput(e.target.value.replace(/\D/g,'').slice(0,10))}/>
                </div>
                <p className="text-xs text-slate/50">Enter the 10-digit number printed on the back of your Peggo card</p>
                <button onClick={handleLinkCard} disabled={!cardLinkInput.trim()}
                  className="w-full py-2.5 rounded-xl bg-blue/20 border border-blue/30 text-blue-light text-sm font-semibold hover:bg-blue hover:text-white transition-all disabled:opacity-40">
                  Link Card
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="anim-fade-up-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-slate uppercase tracking-widest">Recent Activity</div>
          <button onClick={()=>onNavigate('history')} className="text-xs text-blue-light hover:underline">View all</button>
        </div>
        <div className="space-y-2">
          {txs.map(tx => (
            <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <span className="text-lg w-8 text-center">{TX_ICON[tx.type]||'•'}</span>
              <div className="flex-1 min-w-0"><div className="text-sm text-white truncate">{tx.description}</div><div className="text-xs text-slate">{timeAgo(tx.created_at)}</div></div>
              <div className={`font-mono text-sm font-semibold flex-shrink-0 ${tx.amount > 0 ? 'text-green' : 'text-slate'}`}>{tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}</div>
            </div>
          ))}
          {txs.length === 0 && <div className="text-center py-6 text-slate text-sm">No transactions yet.</div>}
        </div>
      </div>
    </div>
  )
}
