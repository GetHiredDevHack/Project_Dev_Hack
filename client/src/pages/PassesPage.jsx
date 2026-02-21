import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api, formatCurrency } from '../utils/api'
import { CheckCircle, Clock, ChevronRight, X, CreditCard, Info, Zap, AlertTriangle } from 'lucide-react'

// ── 2026 Official Winnipeg Transit Fare Data ──────────────────────────────
const PASS_CATALOG = [
  {
    id: 'ecash',
    name: 'e-cash Top-Up',
    icon: '💳',
    description: 'Pay-as-you-go at the discounted Peggo e-cash rate. Deducted per ride from your balance.',
    tag: 'Most Flexible',
    tagColor: 'text-blue-light bg-blue/10 border-blue/30',
    prices: { Adult: 3.10, Youth: 2.30, Senior: 1.55, 'Post-Sec': 3.10 },
    unit: '/ ride',
    isTopUp: true,
    topUpAmounts: [5, 10, 15, 20, 30, 50],
    note: 'Loaded in denominations of $5–$50, max $200.',
  },
  {
    id: '24h',
    name: '24-Hour e-Pass',
    icon: '⚡',
    description: 'Unlimited rides for 24 hours from activation.',
    tag: 'Day Trip',
    tagColor: 'text-green bg-green/10 border-green/30',
    prices: { Adult: 11.45, Youth: 8.50, Senior: 5.75 },
    unit: '/ day',
    durationDays: 1,
    durationLabel: '24 hours',
  },
  {
    id: '5day',
    name: '5-Day e-Pass',
    icon: '📅',
    description: 'Unlimited rides for 5 consecutive days.',
    tag: 'Short Trip',
    tagColor: 'text-amber bg-amber/10 border-amber/30',
    prices: { Adult: 27.90, Youth: 20.70, Senior: 13.95 },
    unit: '/ 5 days',
    durationDays: 5,
    durationLabel: '5 days',
  },
  {
    id: '7day',
    name: '7-Day e-Pass',
    icon: '🗓️',
    description: 'Unlimited rides for 7 consecutive days.',
    tag: 'Weekly',
    tagColor: 'text-amber bg-amber/10 border-amber/30',
    prices: { Adult: 31.00, Youth: 23.00, Senior: 15.50, 'Post-Sec': 24.80 },
    unit: '/ week',
    durationDays: 7,
    durationLabel: '7 days',
  },
  {
    id: '28day',
    name: '28-Day e-Pass',
    icon: '📆',
    description: 'Unlimited rides for 28 consecutive days. Great value for commuters.',
    tag: 'Best Value',
    tagColor: 'text-green bg-green/10 border-green/30',
    prices: { Adult: 110.05, Youth: 81.65, Senior: 55.05, 'Post-Sec': 88.05 },
    unit: '/ 28 days',
    durationDays: 28,
    durationLabel: '28 days',
    highlight: true,
  },
  {
    id: 'monthly',
    name: 'Monthly e-Pass',
    icon: '🏅',
    description: 'Unlimited rides for a full calendar month.',
    tag: 'Most Popular',
    tagColor: 'text-blue-light bg-blue/10 border-blue/30',
    prices: { Adult: 119.35, Youth: 88.55, Senior: 59.70, 'Post-Sec': 95.50 },
    unit: '/ month',
    durationDays: 30,
    durationLabel: '1 month',
    highlight: true,
  },
  {
    id: 'semester',
    name: 'Semester e-Pass',
    icon: '🎓',
    description: '4-month pass for registered post-secondary students (Jan–Apr, May–Aug, Sep–Dec).',
    tag: 'Students Only',
    tagColor: 'text-amber bg-amber/10 border-amber/30',
    prices: { 'Post-Sec': 324.65 },
    unit: '/ semester',
    durationDays: 120,
    durationLabel: '4 months',
    postSecOnly: true,
  },
  {
    id: 'winnpass',
    name: 'WINNpass Monthly',
    icon: '❤️',
    description: 'Low-income monthly pass. Requires WINNpass program pre-approval via 311.',
    tag: 'Income-Based',
    tagColor: 'text-red bg-red/10 border-red/30',
    prices: { Adult: 59.70, Youth: 59.70 },
    unit: '/ month',
    durationDays: 30,
    durationLabel: '1 month',
    requiresApproval: true,
  },
]

const ECASH_FARES = { Adult: 3.10, Youth: 2.30, Senior: 1.55, 'Post-Sec': 3.10 }
const CASH_FARES  = { Adult: 3.45, Youth: 2.95, Senior: 2.95, 'Post-Sec': 3.45 }

function getPrice(pass, accountType) {
  if (pass.prices[accountType] !== undefined) return pass.prices[accountType]
  if (!pass.postSecOnly && !pass.requiresApproval && pass.prices['Adult'] !== undefined) return pass.prices['Adult']
  return null
}

function savingsPerMonth(pass, accountType) {
  if (pass.isTopUp || !pass.durationDays) return null
  const ecash = ECASH_FARES[accountType] || ECASH_FARES.Adult
  const ridesPerDay = 2
  const totalRides = pass.durationDays * ridesPerDay
  const ecashCost = totalRides * ecash
  const price = getPrice(pass, accountType)
  if (price === null) return null
  return Math.max(0, ecashCost - price)
}

// ── Active pass card ──────────────────────────────────────────────────────
function ActivePassCard({ pass }) {
  const expiry   = new Date(pass.expires_at)
  const now      = new Date()
  const msLeft   = Math.max(0, expiry - now)
  const daysLeft = Math.ceil(msLeft / (1000*60*60*24))
  const totalMs  = pass.durationDays ? pass.durationDays * 24*60*60*1000 : msLeft
  const activated= new Date(pass.activated_at)
  const totalDays = Math.ceil((expiry - activated) / (1000*60*60*24))
  const pct      = Math.min(100, Math.max(0, (msLeft / (totalDays * 24*60*60*1000)) * 100))

  return (
    <div className="transit-card rounded-2xl overflow-hidden">
      <div className="transit-card-bg rounded-2xl"/>
      <div className="transit-card-overlay rounded-2xl"/>
      <div className="relative z-10 p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] text-white/40 font-mono uppercase tracking-widest mb-0.5">Active Pass</div>
            <div className="font-display text-lg font-bold text-white">{pass.pass_name}</div>
            <div className="text-xs text-white/50 mt-0.5">{pass.account_type} · paid via {pass.paid_via === 'balance' ? 'balance' : 'card'}</div>
          </div>
          <span className="text-[10px] bg-green/20 border border-green/30 text-green px-2 py-1 rounded-full font-mono">● ACTIVE</span>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-white/40 mb-1.5 font-mono">
            <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>
            <span>Exp {expiry.toLocaleDateString('en-CA', { month:'short', day:'numeric', year:'numeric' })}</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width:`${pct}%`, background: pct > 40 ? '#00d68f' : pct > 15 ? '#ffb800' : '#ff4757' }}/>
          </div>
        </div>
        <div className="text-xs text-green font-semibold flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5"/>Tap to board — unlimited rides covered
        </div>
      </div>
      <div className="peggo-brand-strip"/>
    </div>
  )
}

// ── Purchase modal ────────────────────────────────────────────────────────
function PurchaseModal({ pass, accountType, userBalance, onConfirm, onClose, loading }) {
  const price = getPrice(pass, accountType)
  const savings = savingsPerMonth(pass, accountType)
  const canPayBalance = !pass.isTopUp && userBalance >= (price || 0)

  const [topUpAmt, setTopUpAmt]   = useState(null)
  const [useBalance, setUseBalance] = useState(canPayBalance)
  const [step, setStep]            = useState(pass.isTopUp ? 'amount' : 'confirm')
  const [payCard, setPayCard]      = useState({ number:'', expiry:'', cvv:'', name:'' })
  const [payError, setPayError]    = useState('')

  const finalPrice = pass.isTopUp ? topUpAmt : price

  const fmtNum    = v => v.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim()
  const fmtExpiry = v => { const d=v.replace(/\D/g,'').slice(0,4); return d.length>2?d.slice(0,2)+'/'+d.slice(2):d }

  const handlePay = () => {
    if (useBalance && canPayBalance && !pass.isTopUp) {
      onConfirm(pass, finalPrice, 'balance', null)
      return
    }
    const c = payCard.number.replace(/\s/g,'')
    if (c.length < 13) { setPayError('Invalid card number.'); return }
    if (!/^\d{2}\/\d{2}$/.test(payCard.expiry)) { setPayError('Invalid expiry (MM/YY).'); return }
    const [m,y] = payCard.expiry.split('/').map(Number), now = new Date()
    if (y < now.getFullYear()%100 || (y===now.getFullYear()%100 && m<now.getMonth()+1)) { setPayError('Card expired.'); return }
    if (!/^\d{3,4}$/.test(payCard.cvv)) { setPayError('Invalid CVV.'); return }
    if (!payCard.name.trim()) { setPayError('Cardholder name required.'); return }
    onConfirm(pass, finalPrice, 'card', payCard)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{background:'rgba(0,0,0,0.75)'}}>
      <div className="w-full max-w-md bg-navy-light border border-white/10 rounded-2xl overflow-hidden anim-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-navy-light z-10">
          <div>
            <div className="font-display font-bold text-white">{pass.icon} {pass.name}</div>
            <div className="text-xs text-slate mt-0.5">{pass.isTopUp ? 'Add to balance' : `Valid ${pass.durationLabel} from activation`}</div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate hover:text-white"/></button>
        </div>

        <div className="p-5 space-y-4">

          {/* e-cash: pick top-up amount */}
          {pass.isTopUp && step === 'amount' && (
            <>
              <p className="text-xs text-slate">Choose an amount to load onto your balance. Each ride deducts {formatCurrency(ECASH_FARES[accountType]||3.10)}.</p>
              <div className="grid grid-cols-3 gap-2">
                {pass.topUpAmounts.map(a => (
                  <button key={a} onClick={()=>setTopUpAmt(a)}
                    className={`py-3 rounded-xl font-bold font-mono border transition-all ${topUpAmt===a?'bg-blue border-blue text-white':'bg-blue/10 border-blue/30 text-blue-light hover:bg-blue hover:text-white'}`}>
                    ${a}
                  </button>
                ))}
              </div>
              {topUpAmt && (
                <div className="text-xs text-center text-slate bg-white/5 rounded-lg p-2">
                  New balance: <span className="text-white font-semibold">{formatCurrency(userBalance + topUpAmt)}</span>
                </div>
              )}
              <button onClick={()=>setStep('pay')} disabled={!topUpAmt}
                className="w-full py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-bold transition-colors disabled:opacity-40">
                Continue to Payment →
              </button>
            </>
          )}

          {/* Pass: summary + payment method */}
          {!pass.isTopUp && step === 'confirm' && (
            <>
              <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate">Pass</span><span className="text-white font-semibold">{pass.name}</span></div>
                <div className="flex justify-between"><span className="text-slate">Covers</span><span className="text-white">Unlimited rides · {pass.durationLabel}</span></div>
                <div className="flex justify-between"><span className="text-slate">Fare type</span><span className="text-white">{accountType}</span></div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="font-semibold text-slate">Total</span>
                  <span className="font-display text-xl font-bold text-white">{formatCurrency(price)}</span>
                </div>
              </div>

              {/* How it works */}
              <div className="bg-blue/10 border border-blue/20 rounded-xl p-3 text-xs text-slate space-y-1">
                <div className="text-white font-semibold mb-1">How passes work</div>
                <div>✓ Your balance stays untouched — pass is paid separately</div>
                <div>✓ When you tap, active pass is checked first</div>
                <div>✓ If pass expired, balance is used as fallback</div>
                <div>✓ Pass activates immediately on purchase</div>
              </div>

              {savings > 0 && (
                <div className="flex items-center gap-2 text-xs text-green bg-green/10 border border-green/20 rounded-lg px-3 py-2">
                  <Zap className="w-3 h-3 flex-shrink-0"/>Save ~{formatCurrency(savings)} vs e-cash at 2 rides/day
                </div>
              )}

              {/* Pay from balance toggle */}
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${canPayBalance ? 'border-white/10 bg-white/5 hover:border-blue/30' : 'border-white/5 bg-white/3 opacity-50 cursor-not-allowed'}`}>
                <input type="checkbox" checked={useBalance} disabled={!canPayBalance}
                  onChange={e=>setUseBalance(e.target.checked)}
                  style={{width:'auto',padding:0,border:'none',background:'none'}} className="w-4 h-4 flex-shrink-0"/>
                <div className="flex-1">
                  <div className="text-sm text-white">Pay from balance</div>
                  <div className="text-xs text-slate">Current: {formatCurrency(userBalance)} {!canPayBalance ? '— insufficient' : ''}</div>
                </div>
              </label>

              {!canPayBalance && (
                <div className="text-xs text-amber bg-amber/10 border border-amber/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0"/>Balance too low — payment card required
                </div>
              )}

              <button onClick={useBalance && canPayBalance ? handlePay : ()=>setStep('pay')}
                className="w-full py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-bold transition-colors">
                {useBalance && canPayBalance ? `Pay ${formatCurrency(price)} from Balance` : 'Pay by Card →'}
              </button>
            </>
          )}

          {/* Card payment form */}
          {step === 'pay' && (
            <>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate">Charging</span>
                <span className="font-mono font-bold text-white">{formatCurrency(finalPrice)}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Card Number</label>
                <div className="relative"><CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                  <input type="text" placeholder="4242 4242 4242 4242" className="pl-9 font-mono" maxLength={19}
                    value={payCard.number} onChange={e=>setPayCard(d=>({...d,number:fmtNum(e.target.value)}))}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Expiry</label>
                  <input type="text" placeholder="MM/YY" className="font-mono" maxLength={5}
                    value={payCard.expiry} onChange={e=>setPayCard(d=>({...d,expiry:fmtExpiry(e.target.value)}))}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">CVV</label>
                  <input type="text" placeholder="123" className="font-mono" maxLength={4}
                    value={payCard.cvv} onChange={e=>setPayCard(d=>({...d,cvv:e.target.value.replace(/\D/g,'').slice(0,4)}))}/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Cardholder Name</label>
                <input type="text" placeholder="Jane Smith" value={payCard.name} onChange={e=>setPayCard(d=>({...d,name:e.target.value}))}/>
              </div>
              {payError && <p className="text-red text-xs bg-red/10 border border-red/20 rounded-lg px-3 py-2">{payError}</p>}
              <div className="text-xs text-slate/40 flex items-start gap-1.5">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0"/>Demo — use any test card (e.g. 4242 4242 4242 4242)
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setStep(pass.isTopUp?'amount':'confirm')}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-slate text-sm hover:text-white">← Back</button>
                <button onClick={handlePay} disabled={loading}
                  className="flex-1 py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-bold text-sm disabled:opacity-50">
                  {loading ? 'Processing…' : `Pay ${formatCurrency(finalPrice)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function PassesPage() {
  const { user, refreshUser } = useAuth()
  const [passes, setPasses]     = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)
  const [showCash, setShowCash] = useState(false)

  const accountType = user.accountType || 'Adult'

  const loadPasses = useCallback(async () => {
    const data = await api.getPasses(user.id).catch(()=>({passes:[]}))
    setPasses(data.passes || [])
  }, [user.id])

  useEffect(() => { loadPasses() }, [loadPasses])

  const activePasses = passes.filter(p => p.status === 'active')
  const pastPasses   = passes.filter(p => p.status !== 'active')

  const visibleCatalog = PASS_CATALOG.filter(p => {
    if (p.postSecOnly && accountType !== 'Post-Sec') return false
    if (p.requiresApproval && accountType !== 'Adult' && accountType !== 'Youth') return false
    return getPrice(p, accountType) !== null
  })

  const handleConfirm = async (pass, amount, paidVia, cardDetails) => {
    setLoading(true)
    try {
      if (pass.isTopUp) {
        await api.topUp(user.id, {
          amountCents: Math.round(amount * 100),
          cardNumber: cardDetails?.number.replace(/\s/g,'') || '',
          cardExpiry: cardDetails?.expiry || '',
          cardCvv:    cardDetails?.cvv    || '',
          cardName:   cardDetails?.name   || '',
        })
        setSuccessMsg(`+${formatCurrency(amount)} added to your balance!`)
      } else {
        await api.buyPass(user.id, {
          passId:      pass.id,
          passName:    pass.name,
          priceCents:  Math.round(amount * 100),
          durationDays: pass.durationDays,
          paidVia,
          cardNumber:  cardDetails?.number?.replace(/\s/g,'') || null,
          cardExpiry:  cardDetails?.expiry || null,
          cardCvv:     cardDetails?.cvv    || null,
          cardName:    cardDetails?.name   || null,
        })
        setSuccessMsg(`${pass.name} activated! Tap to board — unlimited rides for ${pass.durationLabel}.`)
      }
      await refreshUser()
      await loadPasses()
      setSelected(null)
    } catch (e) {
      alert(e.message)
    }
    setLoading(false)
    setTimeout(() => setSuccessMsg(null), 5000)
  }

  return (
    <div className="anim-fade-up space-y-5 pb-4">
      <div className="anim-fade-up-1">
        <h2 className="font-display text-3xl font-bold text-white">Passes</h2>
        <p className="text-slate text-sm mt-1">2026 Winnipeg Transit e-passes · {accountType}</p>
      </div>

      {successMsg && (
        <div className="anim-slide-down bg-green/10 border border-green/30 rounded-xl p-3 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green flex-shrink-0"/>
          <span className="text-sm font-semibold text-green">{successMsg}</span>
        </div>
      )}

      {/* Active passes */}
      {activePasses.length > 0 && (
        <div className="anim-fade-up-2 space-y-3">
          <div className="text-xs font-semibold text-slate uppercase tracking-widest">Active Passes</div>
          {activePasses.map(p => <ActivePassCard key={p.id} pass={p}/>)}
        </div>
      )}

      {activePasses.length === 0 && (
        <div className="anim-fade-up-2 bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-slate">
          <div className="font-semibold text-white mb-1">No active pass</div>
          When you tap, your e-cash balance will be used. Buy a pass below to ride unlimited.
        </div>
      )}

      {/* Cash fare reference */}
      <button onClick={()=>setShowCash(s=>!s)}
        className="w-full flex items-center justify-between text-xs text-slate hover:text-white transition-colors">
        <span>Cash fare reference (no Peggo card)</span>
        <span className="font-mono">{showCash?'▲':'▼'}</span>
      </button>
      {showCash && (
        <div className="anim-slide-down bg-white/5 border border-white/10 rounded-xl p-4 text-xs space-y-2">
          <div className="text-white font-semibold mb-2">2026 Cash Fares vs Peggo e-cash</div>
          {Object.entries(CASH_FARES).map(([type, cash]) => {
            const ecash = ECASH_FARES[type]
            return (
              <div key={type} className="flex items-center justify-between">
                <span className="text-slate">{type}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate/50 line-through">{formatCurrency(cash)} cash</span>
                  <span className="text-green font-semibold">{formatCurrency(ecash)} Peggo</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pass catalog */}
      <div className="anim-fade-up-3 space-y-3">
        <div className="text-xs font-semibold text-slate uppercase tracking-widest">Available e-Passes</div>
        {visibleCatalog.map(pass => {
          const price   = getPrice(pass, accountType)
          const savings = savingsPerMonth(pass, accountType)
          if (price === null) return null
          return (
            <div key={pass.id}
              className={`relative rounded-2xl border transition-all ${pass.highlight ? 'border-blue/40 bg-blue/5' : 'border-white/10 bg-white/5'}`}>
              <div className={`absolute -top-2.5 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full border ${pass.tagColor}`}>
                {pass.tag}
              </div>
              <div className="p-4 pt-5 flex items-start gap-3">
                <span className="text-2xl flex-shrink-0 mt-0.5">{pass.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-white text-sm">{pass.name}</div>
                  <div className="text-xs text-slate mt-0.5 leading-relaxed">{pass.description}</div>
                  {pass.durationLabel && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-slate/60">
                      <Clock className="w-3 h-3"/>{pass.durationLabel}
                    </div>
                  )}
                  {savings > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-green">
                      <Zap className="w-3 h-3"/>Save ~{formatCurrency(savings)} vs e-cash
                    </div>
                  )}
                  {pass.requiresApproval && (
                    <div className="text-xs text-red/70 mt-1.5">⚠ Requires WINNpass approval — call 311</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
                  <div className="text-right">
                    <div className="font-display font-bold text-white text-lg leading-none">{formatCurrency(price)}</div>
                    <div className="text-[10px] text-slate/50 font-mono mt-0.5">{pass.unit}</div>
                  </div>
                  <button onClick={()=>setSelected(pass)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${pass.highlight?'bg-blue hover:bg-blue-light text-white':'bg-white/10 hover:bg-white/20 text-white border border-white/10'}`}>
                    {pass.isTopUp ? 'Add' : 'Buy'} <ChevronRight className="w-3 h-3"/>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Past passes */}
      {pastPasses.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate uppercase tracking-widest">Past Passes</div>
          {pastPasses.slice(0,3).map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 opacity-50">
              <span className="text-lg">🎫</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{p.pass_name}</div>
                <div className="text-xs text-slate">Expired {new Date(p.expires_at).toLocaleDateString('en-CA',{month:'short',day:'numeric'})}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-slate/40 space-y-1 pt-2 border-t border-white/5">
        <div>* 2026 official Winnipeg Transit fares.</div>
        <div>* e-cash loads in $5–$50 increments, max $200 balance.</div>
        <div>* All purchases non-refundable.</div>
      </div>

      {selected && (
        <PurchaseModal
          pass={selected}
          accountType={accountType}
          userBalance={user.balance}
          onConfirm={handleConfirm}
          onClose={()=>setSelected(null)}
          loading={loading}
        />
      )}
    </div>
  )
}
