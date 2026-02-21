import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api, formatCurrency } from '../utils/api'
import { Wifi, Shield, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const FARE_BY_TYPE = { Adult: 3.10, Youth: 2.30, Senior: 1.55, 'Post-Sec': 3.10, Child: 0 }

function NFCRipple({ state }) {
  return (
    <div className="relative flex items-center justify-center w-44 h-44">
      {state === 'scanning' && [0,1,2].map(i => (
        <div key={i} className="absolute rounded-full border-2 border-blue/30"
          style={{width:`${80+i*36}px`,height:`${80+i*36}px`,animation:`ripple 2s ease-out ${i*.5}s infinite`}}/>
      ))}
      <div className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 border-2 ${
        state==='success' ? 'bg-green/20 border-green' : state==='error' ? 'bg-red/20 border-red' : 'bg-blue/10 border-blue/40'
      }`}>
        {state==='success' ? <CheckCircle className="w-10 h-10 text-green"/> :
         state==='error'   ? <AlertCircle className="w-10 h-10 text-red"/> :
                             <Wifi className="w-10 h-10 text-blue-light"/>}
      </div>
      <style>{`@keyframes ripple{0%{opacity:.5;transform:scale(.8)}100%{opacity:0;transform:scale(1.5)}}`}</style>
    </div>
  )
}

export default function NFCPage() {
  const { user, refreshUser } = useAuth()
  const [state, setState] = useState('idle')
  const [msg, setMsg] = useState('')
  const [activePass, setActivePass] = useState(null)

  useEffect(() => {
    api.getPasses(user.id).then(d => {
      const active = (d.passes || []).find(p => p.status === 'active')
      setActivePass(active || null)
    }).catch(() => {})
  }, [user.id])
  const [lockInfo, setLockInfo] = useState(null)
  const fare = FARE_BY_TYPE[user.accountType] || 3.10

  // Check lock status
  useEffect(() => {
    if (user.cardLockedUntil) {
      const remaining = Math.ceil((new Date(user.cardLockedUntil) - Date.now()) / 1000)
      if (remaining > 0) setLockInfo({ mins: Math.ceil(remaining/60), secs: remaining })
    }
  }, [user])

  useEffect(() => {
    if (!lockInfo) return
    const iv = setInterval(() => {
      setLockInfo(l => {
        if (!l || l.secs <= 1) { clearInterval(iv); return null }
        return { ...l, secs: l.secs - 1, mins: Math.ceil((l.secs-1)/60) }
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [lockInfo?.secs])

  const handleTap = async () => {
    if (lockInfo) return
    setState('scanning')
    try {
      const res = await api.nfcScan(user.id, 'Route 18 — Portage Ave')
      await refreshUser()
      if (res.accepted) {
        setState('success')
        if (res.paymentMethod === 'pass') {
          setMsg(`Covered by ${res.passName} — $0.00 charged`)
        } else {
          setMsg(`Fare accepted — ${formatCurrency(fare)} deducted from balance`)
        }
        setTimeout(() => setState('idle'), 4000)
      } else {
        setState('error')
        setMsg(res.reason)
        if (res.reason.includes('locked')) {
          const mins = res.reason.match(/(\d+)/)
          setLockInfo({ mins: parseInt(mins?.[1]||5), secs: parseInt(mins?.[1]||5)*60 })
        }
        setTimeout(() => setState('idle'), 3000)
      }
    } catch (e) {
      setState('error'); setMsg(e.message)
      setTimeout(() => setState('idle'), 3000)
    }
  }

  return (
    <div className="anim-fade-up space-y-5">
      <div className="anim-fade-up-1">
        <h2 className="font-display text-3xl font-bold text-white">My Pass</h2>
        <p className="text-slate text-sm mt-1">Hold your phone to the NFC reader to board</p>
      </div>

      {/* Card info bar */}
      <div className="anim-fade-up-2 bg-navy-light border border-white/10 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate">{user.accountType} · {user.peggoId || 'App only'}</div>
          <div className="font-display font-bold text-white">{user.name}</div>
        </div>
        <div className="text-right">
          {activePass ? (
            <>
              <div className="text-[10px] text-green/70 uppercase tracking-widest font-mono">Pass Active</div>
              <div className="text-xs font-semibold text-green">{activePass.pass_name}</div>
              <div className="text-[10px] text-slate mt-0.5">Balance: {formatCurrency(user.balance)}</div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate">Balance</div>
              <div className={`font-mono font-bold text-lg ${user.balance < fare*2 ? 'text-amber':'text-green'}`}>{formatCurrency(user.balance)}</div>
            </>
          )}
        </div>
      </div>

      {/* Lock warning */}
      {lockInfo && (
        <div className="anim-slide-down bg-amber/10 border border-amber/30 rounded-xl p-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber flex-shrink-0"/>
          <div>
            <div className="text-sm font-semibold text-amber">Anti-Passback Active</div>
            <div className="text-xs text-amber/70">Card unlocks in {lockInfo.mins} min — prevents sharing</div>
          </div>
        </div>
      )}

      {/* NFC animation */}
      <div className="anim-fade-up-3 flex flex-col items-center gap-4 py-4">
        <NFCRipple state={lockInfo ? 'locked' : state}/>
        <div className="text-center">
          {lockInfo ? <><p className="text-amber font-semibold text-sm">Card locked</p><p className="text-xs text-slate mt-1">Anti-passback: {lockInfo.mins} min remaining</p></> :
           state==='idle'     ? <><p className="text-white font-semibold text-sm">Hold near reader</p><p className="text-xs text-slate mt-1">NFC taps automatically at boarding</p></> :
           state==='scanning' ? <p className="text-blue-light font-semibold text-sm">Reading…</p> :
           state==='success'  ? <p className="text-green font-bold text-sm">✓ {msg}</p> :
                                <p className="text-red font-semibold text-sm">✕ {msg}</p>}
        </div>
        <button onClick={handleTap} disabled={state==='scanning' || !!lockInfo}
          className="w-full max-w-xs py-3 rounded-xl font-bold text-sm transition-all bg-blue hover:bg-blue-light text-white disabled:bg-white/10 disabled:text-slate">
          {state==='scanning' ? 'Scanning…' : lockInfo ? `Locked (${lockInfo.mins}min)` : '⚡ Simulate NFC Tap'}
        </button>
        <div className="flex gap-2 flex-wrap justify-center">
          {[['Anti-passback','text-green bg-green/10 border-green/20'],['NFC encrypted','text-blue-light bg-blue/10 border-blue/20'],['5-min lock','text-amber bg-amber/10 border-amber/20']].map(([l,c])=>(
            <span key={l} className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 ${c}`}><Shield className="w-2.5 h-2.5"/>{l}</span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="anim-fade-up-4 bg-white/5 rounded-xl border border-white/10 p-4 text-xs text-slate space-y-2">
        <div className="font-semibold text-white text-sm mb-1">How tap-to-board works</div>
        {['Encrypted NFC token broadcasts to reader','Active pass checked first — ride free if valid',`No pass? ${formatCurrency(fare)} deducted from balance`,'Account locks 5 min (anti-passback)'].map((d,i)=>(
          <div key={i} className="flex items-start gap-2"><span className="font-mono text-blue-light font-bold">{i+1}.</span><span>{d}</span></div>
        ))}
      </div>
    </div>
  )
}
