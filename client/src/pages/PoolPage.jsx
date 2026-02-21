import React, { useState, useEffect } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api, formatCurrency } from '../utils/api'
import { Users, Crown, Shield, Plus, X, UserPlus, UserMinus, Pencil, LogOut, Check, AlertTriangle, Mail } from 'lucide-react'

export default function PoolPage() {
  const { user, refreshUser } = useAuth()
  const [pool, setPool] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // Create pool
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState('')

  // Add member
  const [showAddMember, setShowAddMember] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  // Rename
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  // General messages
  const [msg, setMsg] = useState(null)

  const isHead = user.poolRole === 'head'

  const loadPool = async () => {
    setLoading(true)
    if (user.poolId) {
      try {
        const d = await api.getPool(user.poolId)
        setPool(d.pool)
        setMembers(d.members)
      } catch { setPool(null) }
    } else {
      setPool(null)
      setMembers([])
    }
    setLoading(false)
  }

  useEffect(() => { loadPool() }, [user.poolId])

  const handleCreate = async () => {
    setCreateError('')
    if (!createName.trim() || createName.trim().length < 2) {
      setCreateError('Pool name must be at least 2 characters.')
      return
    }
    try {
      const d = await api.createPool(user.id, createName.trim())
      setPool(d.pool)
      setMembers(d.members)
      setCreateName('')
      await refreshUser()
    } catch (e) {
      setCreateError(e.message)
    }
  }

  const handleAddMember = async () => {
    setAddError(''); setAddSuccess('')
    if (!addEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail)) {
      setAddError('Enter a valid email address.')
      return
    }
    try {
      const d = await api.addPoolMember(pool.id, addEmail.trim(), user.id)
      setMembers(d.members)
      setAddSuccess(`Added successfully!`)
      setAddEmail('')
      setTimeout(() => { setAddSuccess(''); setShowAddMember(false) }, 2000)
    } catch (e) {
      setAddError(e.message)
    }
  }

  const handleRemove = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from the pool?`)) return
    try {
      const d = await api.removePoolMember(pool.id, memberId, user.id)
      setMembers(d.members)
      flash('Member removed.')
    } catch (e) { flash(e.message, true) }
  }

  const handleRename = async () => {
    if (!editName.trim() || editName.trim().length < 2) return
    try {
      const d = await api.renamePool(pool.id, editName.trim(), user.id)
      setPool(d.pool)
      setEditing(false)
      flash('Pool renamed!')
    } catch (e) { flash(e.message, true) }
  }

  const handleLeave = async () => {
    const action = isHead ? 'delete this pool (all members will be removed)' : 'leave this pool'
    if (!confirm(`Are you sure you want to ${action}?`)) return
    try {
      await api.leavePool(pool.id || user.poolId, user.id)
      setPool(null)
      setMembers([])
      await refreshUser()
      flash(isHead ? 'Pool deleted.' : 'You left the pool.')
    } catch (e) { flash(e.message, true) }
  }

  const flash = (text, isError = false) => {
    setMsg({ text, isError })
    setTimeout(() => setMsg(null), 3000)
  }

  if (loading) {
    return (
      <div className="anim-fade-up space-y-5">
        <div><h2 className="font-display text-3xl font-bold text-white">Family Pool</h2></div>
        <div className="text-center py-16 text-slate text-sm">Loading…</div>
      </div>
    )
  }

  // ── No pool — create one ──────────────────────────────────────────────────
  if (!pool) return (
    <div className="anim-fade-up space-y-5">
      <div><h2 className="font-display text-3xl font-bold text-white">Family Pool</h2>
        <p className="text-slate text-sm mt-1">Share one balance across your household</p></div>

      {msg && (
        <div className={`anim-slide-down rounded-xl p-3 text-sm font-semibold border ${msg.isError ? 'bg-red/10 border-red/30 text-red' : 'bg-green/10 border-green/30 text-green'}`}>{msg.text}</div>
      )}

      <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10 space-y-4 px-6">
        <Users className="w-14 h-14 text-slate/40 mx-auto"/>
        <div className="font-display text-xl text-white">No Pool Yet</div>
        <div className="text-sm text-slate max-w-xs mx-auto">
          Create a family or household pool to share one balance. You'll be the pool owner and can invite members by email.
        </div>

        <div className="space-y-3 pt-4">
          <input type="text" placeholder="Pool name (e.g. Smith Family)" className="text-center"
            value={createName} onChange={e=>setCreateName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleCreate()}/>
          {createError && <p className="text-red text-xs">{createError}</p>}
          <button onClick={handleCreate} disabled={!createName.trim()}
            className="w-full py-3 rounded-xl bg-blue hover:bg-blue-light text-white font-bold transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4"/> Create Pool
          </button>
        </div>
      </div>

      <div className="bg-blue/10 border border-blue/20 rounded-xl p-4 text-xs text-slate">
        <Shield className="w-4 h-4 text-blue-light mb-2"/>
        <div className="font-semibold text-white mb-1">Why family pools?</div>
        When a household shares one pool, no member ever has $0 at the bus stop — removing the temptation to evade fares.
      </div>
    </div>
  )

  // ── Has pool — manage it ──────────────────────────────────────────────────
  return (
    <div className="anim-fade-up space-y-5">
      <div className="anim-fade-up-1">
        <h2 className="font-display text-3xl font-bold text-white">Family Pool</h2>
        <div className="flex items-center gap-2 mt-1">
          {editing ? (
            <div className="flex items-center gap-2 flex-1">
              <input type="text" value={editName} onChange={e=>setEditName(e.target.value)} className="flex-1 text-sm"
                onKeyDown={e=>e.key==='Enter'&&handleRename()} autoFocus/>
              <button onClick={handleRename} className="text-green"><Check className="w-4 h-4"/></button>
              <button onClick={()=>setEditing(false)} className="text-slate"><X className="w-4 h-4"/></button>
            </div>
          ) : (
            <>
              <p className="text-slate text-sm">{pool.name}</p>
              {isHead && <button onClick={()=>{setEditing(true);setEditName(pool.name)}} className="text-slate/40 hover:text-blue-light"><Pencil className="w-3 h-3"/></button>}
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className={`anim-slide-down rounded-xl p-3 text-sm font-semibold border ${msg.isError ? 'bg-red/10 border-red/30 text-red' : 'bg-green/10 border-green/30 text-green'}`}>{msg.text}</div>
      )}

      {/* Shared balance card */}
      <div className="transit-card rounded-2xl p-6 border border-white/10 anim-fade-up-2">
        <div className="text-xs font-mono text-slate uppercase tracking-widest mb-2">Shared Balance</div>
        <div className="font-display text-5xl font-bold text-white mb-4">{formatCurrency(pool.sharedBalance)}</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="font-mono text-lg font-bold text-blue-light">{members.length}</div>
            <div className="text-xs text-slate">Member{members.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="font-mono text-lg font-bold text-amber">{isHead ? 'Owner' : 'Member'}</div>
            <div className="text-xs text-slate">Your role</div>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="anim-fade-up-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-slate uppercase tracking-widest">Members</div>
          {isHead && (
            <button onClick={()=>{setShowAddMember(s=>!s);setAddEmail('');setAddError('');setAddSuccess('')}}
              className="text-xs text-blue-light flex items-center gap-1 hover:underline">
              <UserPlus className="w-3 h-3"/> Add
            </button>
          )}
        </div>

        {/* Add member form */}
        {showAddMember && isHead && (
          <div className="anim-slide-down bg-white/5 border border-white/10 rounded-xl p-4 mb-3 space-y-3">
            <div className="text-sm font-semibold text-white">Invite by email</div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-dark"/>
              <input type="email" placeholder="member@example.com" className="pl-9"
                value={addEmail} onChange={e=>{setAddEmail(e.target.value);setAddError('')}}
                onKeyDown={e=>e.key==='Enter'&&handleAddMember()}/>
            </div>
            {addError && <p className="text-red text-xs">{addError}</p>}
            {addSuccess && <p className="text-green text-xs">{addSuccess}</p>}
            <button onClick={handleAddMember} disabled={!addEmail}
              className="w-full py-2 rounded-xl bg-blue/20 border border-blue/30 text-blue-light text-sm font-semibold hover:bg-blue hover:text-white transition-all disabled:opacity-40">
              Add Member
            </button>
          </div>
        )}

        <div className="space-y-2">
          {members.map(m=>(
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{background:m.photoColor}}>{m.photoInitials}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{m.name} {m.id===user.id && <span className="text-slate/50">(you)</span>}</div>
                <div className="text-xs text-slate">{m.accountType} · {m.email}</div>
              </div>
              {m.poolRole==='head' && <Crown className="w-4 h-4 text-amber flex-shrink-0"/>}
              <span className="text-xs text-slate capitalize flex-shrink-0">{m.poolRole}</span>
              {isHead && m.poolRole !== 'head' && (
                <button onClick={()=>handleRemove(m.id, m.name)} className="text-red/50 hover:text-red flex-shrink-0" title="Remove member">
                  <UserMinus className="w-4 h-4"/>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leave / Delete button */}
      <button onClick={handleLeave}
        className="w-full py-3 rounded-xl border border-red/30 text-red/70 hover:text-red hover:bg-red/10 text-sm font-semibold transition-all flex items-center justify-center gap-2">
        <LogOut className="w-4 h-4"/>
        {isHead ? 'Delete Pool' : 'Leave Pool'}
      </button>

      <div className="anim-fade-up-4 bg-blue/10 border border-blue/20 rounded-xl p-4 text-xs text-slate">
        <Shield className="w-4 h-4 text-blue-light mb-2"/>
        <div className="font-semibold text-white mb-1">How pools work</div>
        The pool owner can add or remove members and rename the pool. All members share the pool's balance for rides. Only the owner can delete the pool.
      </div>
    </div>
  )
}
