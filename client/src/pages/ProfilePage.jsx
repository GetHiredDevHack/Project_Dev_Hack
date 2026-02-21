import React, { useState } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api, formatCurrency, formatDateTime } from '../utils/api'
import { User, Mail, CreditCard, Shield, LogOut, CheckCircle, Edit2, X, Save } from 'lucide-react'

const FARE_BY_TYPE = { Adult: 3.10, Youth: 2.30, Senior: 1.55, 'Post-Sec': 3.10, Child: 0 }

const ACCOUNT_TYPE_COLORS = {
  Adult:    { bg: 'bg-blue/20',   text: 'text-blue-light',  border: 'border-blue/30'   },
  Youth:    { bg: 'bg-green/20',  text: 'text-green',       border: 'border-green/30'  },
  Senior:   { bg: 'bg-amber/20',  text: 'text-amber',       border: 'border-amber/30'  },
  'Post-Sec':{ bg: 'bg-slate/20', text: 'text-slate-light', border: 'border-slate/30'  },
  Child:    { bg: 'bg-red/20',    text: 'text-red',         border: 'border-red/30'    },
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(user.name)
  const [editEmail, setEditEmail] = useState(user.email)
  const [saveMsg, setSaveMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  const fare = FARE_BY_TYPE[user.accountType] || 3.10
  const typeStyle = ACCOUNT_TYPE_COLORS[user.accountType] || ACCOUNT_TYPE_COLORS.Adult

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateProfile(user.id, { name: editName, email: editEmail })
      await refreshUser()
      setEditing(false)
      setSaveMsg({ ok: true, text: 'Profile updated!' })
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message })
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  const cancelEdit = () => {
    setEditName(user.name)
    setEditEmail(user.email)
    setEditing(false)
  }

  return (
    <div className="anim-fade-up space-y-5">
      <div className="anim-fade-up-1">
        <h2 className="font-display text-3xl font-bold text-white">Profile</h2>
        <p className="text-slate text-sm mt-1">Your account details</p>
      </div>

      {/* Avatar + name card */}
      <div className="anim-fade-up-2 transit-card rounded-2xl p-6 flex items-center gap-5">
        <div className="transit-card-bg rounded-2xl"/>
        <div className="transit-card-overlay rounded-2xl"/>
        {/* Avatar */}
        <div className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${user.photoColor}, ${user.photoColor}99)` }}>
          {user.photoInitials}
        </div>
        <div className="relative z-10 flex-1 min-w-0">
          <div className="font-display text-xl font-bold text-white truncate">{user.name}</div>
          <div className="text-sm text-slate mt-0.5 truncate">{user.email}</div>
          <div className={`inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
            <CreditCard className="w-3 h-3" />
            {user.accountType} · {fare === 0 ? 'FREE' : formatCurrency(fare)}/ride
          </div>
        </div>
        <div className="peggo-brand-strip"/>
      </div>
      {saveMsg && (
        <div className={`anim-slide-down rounded-xl p-3 text-sm font-semibold border flex items-center gap-2 ${saveMsg.ok ? 'bg-green/10 border-green/30 text-green' : 'bg-red/10 border-red/30 text-red'}`}>
          {saveMsg.ok ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {saveMsg.text}
        </div>
      )}

      {/* Account details */}
      <div className="anim-fade-up-3 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
          <span className="text-xs font-semibold text-slate uppercase tracking-widest">Account Details</span>
          {!editing
            ? <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-blue-light hover:underline"><Edit2 className="w-3 h-3"/>Edit</button>
            : <div className="flex gap-2">
                <button onClick={cancelEdit} className="flex items-center gap-1 text-xs text-slate hover:text-white"><X className="w-3 h-3"/>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs text-green hover:underline disabled:opacity-50"><Save className="w-3 h-3"/>{saving ? 'Saving…' : 'Save'}</button>
              </div>
          }
        </div>

        <div className="divide-y divide-white/5">
          {/* Name */}
          <div className="flex items-center gap-4 px-5 py-4">
            <User className="w-4 h-4 text-slate flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate mb-1">Full Name</div>
              {editing
                ? <input type="text" value={editName} onChange={e=>setEditName(e.target.value)} className="text-sm" style={{padding:'6px 10px'}}/>
                : <div className="text-sm font-medium text-white">{user.name}</div>
              }
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-4 px-5 py-4">
            <Mail className="w-4 h-4 text-slate flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate mb-1">Email</div>
              {editing
                ? <input type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} className="text-sm" style={{padding:'6px 10px'}}/>
                : <div className="text-sm font-medium text-white truncate">{user.email}</div>
              }
            </div>
          </div>

          {/* Account type */}
          <div className="flex items-center gap-4 px-5 py-4">
            <CreditCard className="w-4 h-4 text-slate flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-slate mb-1">Account Type</div>
              <div className="text-sm font-medium text-white">{user.accountType}</div>
            </div>
          </div>

          {/* Peggo card */}
          <div className="flex items-center gap-4 px-5 py-4">
            <Shield className="w-4 h-4 text-slate flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs text-slate mb-1">Peggo Card</div>
              <div className="text-sm font-medium text-white font-mono">
                {user.peggoId
                  ? user.peggoId.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3')
                  : <span className="text-slate italic">No card linked</span>
                }
              </div>
            </div>
            <div className={`text-xs px-2 py-0.5 rounded-full border font-mono flex-shrink-0 ${user.linkedCard ? 'bg-green/15 text-green border-green/30' : 'bg-amber/15 text-amber border-amber/30'}`}>
              {user.linkedCard ? '● Linked' : '○ Unlinked'}
            </div>
          </div>
        </div>
      </div>

      {/* Balance summary */}
      <div className="anim-fade-up-4 bg-white/5 border border-white/10 rounded-xl p-4 text-center">
        <div className={`font-display text-3xl font-bold ${user.balance < fare*2 ? 'text-amber' : 'text-green'}`}>{formatCurrency(user.balance)}</div>
        <div className="text-xs text-slate mt-1">Current Balance</div>
      </div>

      {/* Member since */}
      <div className="anim-fade-up-4 text-center text-xs text-slate/40 font-mono">
        Account created {user.createdAt ? formatDateTime(user.createdAt) : 'recently'}
      </div>

      {/* Logout */}
      <button onClick={logout}
        className="anim-fade-up-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red/20 text-red/70 hover:text-red hover:border-red/40 hover:bg-red/10 transition-all text-sm font-semibold">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  )
}
