import React, { useState, useMemo } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api } from '../utils/api'
import { Mail, Lock, User, ChevronRight, CreditCard, ArrowLeft, Calendar, GraduationCap, Info, Link, Sparkles } from 'lucide-react'

function getAge(dateStr) {
  if (!dateStr) return null
  const dob = new Date(dateStr)
  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const m = now.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--
  return age
}

const FARE_INFO = {
  'Child':    { fare: 'FREE', color: '#00d68f', desc: 'Children 11 and under ride free with a fare-paying customer' },
  'Youth':    { fare: '$2.30', color: '#00d68f', desc: 'Youths 16 and under, or high school students 17–21 with GoCARD' },
  'Adult':    { fare: '$3.10', color: '#1565ff', desc: 'Individuals aged 17–64 (e-cash rate)' },
  'Post-Sec': { fare: '$3.10', color: '#ffb800', desc: 'Students at participating post-secondary institutions' },
  'Senior':   { fare: '$1.55', color: '#9b5de5', desc: 'Persons aged 65 or older' },
}

export default function AuthPage() {
  const { login, signup, error, setError } = useAuth()
  const [mode, setMode] = useState('login') // login | signup | card-step
  const [ld, setLd] = useState({ identifier: '', password: '' })
  const [sd, setSd] = useState({ name: '', email: '', password: '', dateOfBirth: '', isPostSec: false, isHighSchool: false })
  const [loading, setLoading] = useState(false)
  const [signupErrors, setSignupErrors] = useState({})

  // Card linking step
  const [cardChoice, setCardChoice] = useState(null) // 'link' | 'virtual'
  const [peggoInput, setPeggoInput] = useState('')
  const [cardError, setCardError] = useState('')
  const [newUser, setNewUser] = useState(null) // user object returned from signup

  const age = useMemo(() => getAge(sd.dateOfBirth), [sd.dateOfBirth])

  const pwChecks = useMemo(() => ({
    length: sd.password.length >= 8,
    letter: /[a-zA-Z]/.test(sd.password),
    number: /\d/.test(sd.password),
  }), [sd.password])
  const pwValid = pwChecks.length && pwChecks.letter && pwChecks.number

  const showHighSchoolToggle = age !== null && age >= 17 && age <= 21
  const showPostSecToggle = age !== null && age >= 17 && age < 65

  const accountType = useMemo(() => {
    if (age === null) return null
    if (age <= 11) return 'Child'
    if (age <= 16) return 'Youth'
    if (age >= 65) return 'Senior'
    if (showHighSchoolToggle && sd.isHighSchool) return 'Youth'
    if (sd.isPostSec) return 'Post-Sec'
    return 'Adult'
  }, [age, sd.isPostSec, sd.isHighSchool, showHighSchoolToggle])

  const fareInfo = accountType ? FARE_INFO[accountType] : null

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true)
    await login(ld.identifier, ld.password)
    setLoading(false)
  }

  // Step 1 → validate and create account, then go to card step
  const handleSignupStep1 = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!sd.name.trim() || sd.name.trim().length < 2) errs.name = 'Name must be at least 2 characters.'
    if (!sd.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sd.email)) errs.email = 'Enter a valid email address.'
    if (!pwValid) errs.password = 'Password does not meet requirements.'
    if (!sd.dateOfBirth) errs.dob = 'Date of birth is required.'
    if (Object.keys(errs).length) { setSignupErrors(errs); return }
    setSignupErrors({})
    setLoading(true)
    try {
      const data = await api.signup(sd.name.trim(), sd.email.trim(), sd.password, accountType || 'Adult', sd.dateOfBirth)
      setNewUser(data.user)
      setMode('card-step')
      setError('')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Step 2 — link existing card
  const handleLinkCard = async () => {
    setCardError('')
    const trimmed = peggoInput.trim().replace(/\s/g, '')
    if (!trimmed) { setCardError('Enter your Peggo card number.'); return }
    if (!/^\d{10}$/.test(trimmed)) { setCardError('Invalid format — must be exactly 10 digits (e.g. 4821003892)'); return }
    setLoading(true)
    try {
      await api.linkCard(newUser.id, trimmed)
    } catch (e) {
      setCardError(e.message)
      setLoading(false)
      return
    }
    // Log in via auth context (this sets user and navigates to dashboard)
    const ok = await login(sd.email.trim(), sd.password)
    if (!ok) setCardError('Account created but login failed. Try signing in manually.')
    setLoading(false)
  }

  // Step 2 — skip and use the auto-generated virtual card
  const handleUseVirtual = async () => {
    setLoading(true)
    const ok = await login(sd.email.trim(), sd.password)
    if (!ok) setCardError('Account created but login failed. Try signing in manually.')
    setLoading(false)
  }

  // ── Left panel (shared) ──────────────────────────────────────────────────
  const leftPanel = (
    <div className="hidden lg:flex flex-col justify-between w-2/5 bg-navy-light p-12 border-r border-white/5">
      <div>
        <div className="flex items-center gap-3 mb-14">
          <div className="w-10 h-10 bg-blue rounded-xl flex items-center justify-center"><CreditCard className="w-5 h-5 text-white"/></div>
          <div><div className="font-display text-xl font-bold text-white">TransitLink</div><div className="text-xs text-slate font-mono">WINNIPEG</div></div>
        </div>
        <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
          Your city.<br/><span className="text-blue-light">Your card.</span><br/>Your community.
        </h1>
        <p className="text-slate text-sm leading-relaxed">A cloud account behind every Peggo card. Never miss a bus because of a lost card or empty balance.</p>
      </div>
      <div className="space-y-3">
        {[['NFC Tap','Hold your phone — board in seconds'],['Fare Gifting','Send a ride to anyone, registered or not'],['Family Pool','One balance, whole household covered']].map(([t,d]) => (
          <div key={t} className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
            <div className="w-1.5 h-1.5 bg-amber rounded-full mt-1.5 flex-shrink-0"/>
            <div><div className="text-sm font-semibold text-white">{t}</div><div className="text-xs text-slate mt-0.5">{d}</div></div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-navy flex">
      {leftPanel}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 bg-blue rounded-lg flex items-center justify-center"><CreditCard className="w-4 h-4 text-white"/></div>
            <span className="font-display font-bold text-white text-lg">TransitLink</span>
          </div>

          {/* ── LOGIN ─────────────────────────────────────────────────────── */}
          {mode === 'login' && (
            <div className="anim-fade-up">
              <h2 className="font-display text-3xl font-bold text-white mb-1">Sign In</h2>
              <p className="text-slate text-sm mb-8">Access your transit account</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Email or Card Number</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                    <input type="text" placeholder="you@example.com or 10-digit card number" className="pl-9"
                      value={ld.identifier} onChange={e=>setLd(d=>({...d,identifier:e.target.value}))} required/>
                  </div>
                  <p className="text-xs text-slate/50 mt-1">Sign in with your email address or 10-digit Peggo card number</p>
                </div>
                <div><label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Password</label>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                    <input type="password" placeholder="••••••••" className="pl-9" value={ld.password} onChange={e=>setLd(d=>({...d,password:e.target.value}))} required/></div></div>
                {error && <p className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading} className="w-full bg-blue hover:bg-blue-light text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
                  {loading ? 'Signing in…' : <><span>Sign In</span><ChevronRight className="w-4 h-4"/></>}
                </button>
              </form>
              <p className="text-center text-sm text-slate mt-6">New rider? <button onClick={()=>{setMode('signup');setError('')}} className="text-blue-light font-semibold hover:underline">Create account</button></p>
            </div>
          )}

          {/* ── SIGNUP STEP 1: Account Details ──────────────────────────── */}
          {mode === 'signup' && (
            <div className="anim-fade-up">
              <button onClick={()=>setMode('login')} className="flex items-center gap-1 text-sm text-slate hover:text-white mb-6 transition-colors"><ArrowLeft className="w-4 h-4"/>Back</button>
              <h2 className="font-display text-3xl font-bold text-white mb-1">Create Account</h2>
              <p className="text-slate text-sm mb-6">Step 1 of 2 — Your details</p>
              <form onSubmit={handleSignupStep1} className="space-y-4">
                <div><label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Full Name</label>
                  <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                    <input type="text" placeholder="Jane Smith" className="pl-9" value={sd.name} onChange={e=>setSd(d=>({...d,name:e.target.value}))} required/></div>
                  {signupErrors.name && <p className="text-red text-xs mt-1">{signupErrors.name}</p>}
                </div>

                <div><label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Email</label>
                  <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                    <input type="email" placeholder="you@example.com" className="pl-9" value={sd.email} onChange={e=>setSd(d=>({...d,email:e.target.value}))} required/></div>
                  {signupErrors.email && <p className="text-red text-xs mt-1">{signupErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Date of Birth</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                    <input type="date" className="pl-9" value={sd.dateOfBirth}
                      onChange={e => setSd(d => ({...d, dateOfBirth: e.target.value, isPostSec: false, isHighSchool: false }))}
                      max={new Date().toISOString().split('T')[0]} required/>
                  </div>
                  {signupErrors.dob && <p className="text-red text-xs mt-1">{signupErrors.dob}</p>}
                </div>

                {accountType && fareInfo && (
                  <div className="anim-scale-in space-y-3">
                    <div className="rounded-xl p-4 border" style={{ background: fareInfo.color + '15', borderColor: fareInfo.color + '40' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: fareInfo.color + '30' }}>
                            <CreditCard className="w-4 h-4" style={{ color: fareInfo.color }}/>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{accountType} Fare</div>
                            <div className="text-xs" style={{ color: fareInfo.color }}>{age !== null ? `Age: ${age}` : ''}</div>
                          </div>
                        </div>
                        <div className="font-mono text-lg font-bold" style={{ color: fareInfo.color }}>{fareInfo.fare}</div>
                      </div>
                      <div className="text-xs text-slate">{fareInfo.desc}</div>
                    </div>

                    {showHighSchoolToggle && !sd.isPostSec && (
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-green/40 transition-all">
                        <input type="checkbox" checked={sd.isHighSchool}
                          onChange={e => setSd(d => ({...d, isHighSchool: e.target.checked, isPostSec: false }))}
                          className="mt-0.5" style={{width:'auto',padding:0,border:'none',background:'none'}}/>
                        <div>
                          <div className="text-sm font-semibold text-white">I'm a high school student</div>
                          <div className="text-xs text-slate">Students 17–21 attending a Winnipeg high school qualify for Youth fare ($2.30) with a GoCARD</div>
                        </div>
                      </label>
                    )}

                    {showPostSecToggle && !sd.isHighSchool && (
                      <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-amber/40 transition-all">
                        <input type="checkbox" checked={sd.isPostSec}
                          onChange={e => setSd(d => ({...d, isPostSec: e.target.checked, isHighSchool: false }))}
                          className="mt-0.5" style={{width:'auto',padding:0,border:'none',background:'none'}}/>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-amber"/>Post-Secondary Student
                          </div>
                          <div className="text-xs text-slate">Students at participating institutions get the post-secondary e-cash rate ($3.10)</div>
                        </div>
                      </label>
                    )}

                    {accountType === 'Child' && (
                      <div className="flex items-start gap-2 p-3 rounded-xl bg-green/10 border border-green/30">
                        <Info className="w-4 h-4 text-green flex-shrink-0 mt-0.5"/>
                        <div className="text-xs text-green">Children 11 and under ride free when accompanied by a fare-paying customer. No peggo card needed!</div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Password</label>
                  <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                    <input type="password" placeholder="Min 8 characters" className="pl-9" value={sd.password} onChange={e=>setSd(d=>({...d,password:e.target.value}))} required/></div>
                  {sd.password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {[['At least 8 characters', pwChecks.length], ['Contains a letter', pwChecks.letter], ['Contains a number', pwChecks.number]].map(([label, ok]) => (
                        <div key={label} className={`text-xs flex items-center gap-1.5 ${ok ? 'text-green' : 'text-slate/50'}`}>
                          <span>{ok ? '✓' : '○'}</span>{label}
                        </div>
                      ))}
                    </div>
                  )}
                  {signupErrors.password && <p className="text-red text-xs mt-1">{signupErrors.password}</p>}
                </div>

                {error && <p className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={loading || !accountType || !pwValid} className="w-full bg-blue hover:bg-blue-light text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
                  {loading ? 'Creating…' : 'Continue — Link Your Card →'}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-white/10">
                <div className="text-xs text-slate/40 uppercase tracking-widest font-mono mb-2">2026 e-Cash Fares</div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[['Adult (17–64)', '$3.10', '#1565ff'], ['Youth (≤16 / HS 17–21)', '$2.30', '#00d68f'], ['Senior (65+)', '$1.55', '#9b5de5'], ['Post-Secondary', '$3.10', '#ffb800'], ['Child (≤11)', 'FREE', '#00d68f']].map(([label, fare, c]) => (
                    <div key={label} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <span className="text-slate">{label}</span>
                      <span className="font-mono font-semibold" style={{color: c}}>{fare}</span>
                    </div>
                  ))}
                </div>
                <a href="https://info.winnipegtransit.com/en/fares/transit-fares" target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-light/60 hover:text-blue-light mt-2 block">
                  Source: Winnipeg Transit 2026 Fares →
                </a>
              </div>
            </div>
          )}

          {/* ── SIGNUP STEP 2: Card Linking ──────────────────────────────── */}
          {mode === 'card-step' && newUser && (
            <div className="anim-fade-up">
              <h2 className="font-display text-3xl font-bold text-white mb-1">Link Your Card</h2>
              <p className="text-slate text-sm mb-2">Step 2 of 2 — Connect a Peggo card to your account</p>
              <p className="text-xs text-slate/50 mb-6">Welcome, <span className="text-white">{newUser.name}</span>! Do you already have a physical Peggo card?</p>

              <div className="space-y-3">
                {/* Option 1: Link existing */}
                <button onClick={()=>{setCardChoice('link');setCardError('')}}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${cardChoice==='link'?'border-blue bg-blue/10':'border-white/10 bg-white/5 hover:border-blue/40'}`}>
                  <div className="w-10 h-10 rounded-full bg-blue/20 flex items-center justify-center flex-shrink-0">
                    <Link className="w-5 h-5 text-blue-light"/>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">I have a Peggo card</div>
                    <div className="text-xs text-slate">Link your existing physical card to this account</div>
                  </div>
                </button>

                {/* Option 2: New virtual card */}
                <button onClick={()=>{setCardChoice('virtual');setCardError('')}}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${cardChoice==='virtual'?'border-green bg-green/10':'border-white/10 bg-white/5 hover:border-green/40'}`}>
                  <div className="w-10 h-10 rounded-full bg-green/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-green"/>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">I don't have a card</div>
                    <div className="text-xs text-slate">Get a virtual Peggo card — use your phone to tap and pay</div>
                  </div>
                </button>

                {/* Link form */}
                {cardChoice === 'link' && (
                  <div className="anim-slide-down space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate mb-1.5 uppercase tracking-widest">Peggo Card Number</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
                        <input type="text" placeholder="10-digit card number" className="pl-9 font-mono"
                          value={peggoInput} onChange={e=>setPeggoInput(e.target.value.replace(/\D/g,'').slice(0,10))}
                          onKeyDown={e=>e.key==='Enter'&&handleLinkCard()}/>
                      </div>
                      <p className="text-xs text-slate/50 mt-1">Find this on the back of your physical Peggo card</p>
                    </div>
                    {cardError && <p className="text-red text-xs bg-red/10 border border-red/20 rounded-lg px-3 py-2">{cardError}</p>}
                    <button onClick={handleLinkCard} disabled={loading || !peggoInput.trim()}
                      className="w-full py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                      {loading ? 'Linking…' : <><Link className="w-4 h-4"/> Link Card & Continue</>}
                    </button>
                  </div>
                )}

                {/* Virtual card confirmation */}
                {cardChoice === 'virtual' && (
                  <div className="anim-slide-down space-y-3 bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{background: newUser.photoColor}}>
                        {newUser.photoInitials}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">Your virtual card</div>
                        <div className="text-xs text-slate font-mono">{newUser.peggoId}</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate bg-white/5 rounded-lg p-3 space-y-1">
                      <div>Your virtual Peggo card is ready to use right away.</div>
                      <div>Use your phone's NFC to tap and pay, or top up your balance online.</div>
                      <div>You can always link a physical card later from your dashboard.</div>
                    </div>
                    <button onClick={handleUseVirtual} disabled={loading}
                      className="w-full py-3 rounded-xl bg-green hover:bg-green/80 text-white font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                      {loading ? 'Setting up…' : <><Sparkles className="w-4 h-4"/> Start with Virtual Card</>}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
