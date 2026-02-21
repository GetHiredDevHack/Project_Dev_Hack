import React, { useState, useEffect } from 'react'
import { api, formatCurrency, formatDateTime } from '../utils/api'
import { Shield, Users, AlertTriangle, CheckCircle, Eye, RefreshCw } from 'lucide-react'

export default function AdminPage() {
  const [tab, setTab] = useState('overview')
  const [users, setUsers] = useState([])
  const [fraud, setFraud] = useState([])
  const [tokens, setTokens] = useState([])
  const [scans, setScans] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const [u, f, t, s] = await Promise.all([api.adminUsers(), api.adminFraud(), api.adminTokens(), api.adminScans()])
    setUsers(u.users); setFraud(f.flags); setTokens(t.tokens); setScans(s.scans)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clearFlag = async (uid) => {
    await api.clearFlag(uid); load()
  }

  const flaggedUsers = users.filter(u => u.fraudFlags > 0)
  const totalBalance = users.reduce((s,u) => s + u.balance, 0)
  const totalRides   = scans.filter(s => s.scan_type === 'nfc' && s.accepted).length

  return (
    <div className="anim-fade-up space-y-6">
      <div className="anim-fade-up-1 flex items-start justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold text-white">Admin Portal</h2>
          <p className="text-slate text-sm mt-1">City of Winnipeg Transit — Security & Operations</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="inline-flex items-center gap-1 text-xs bg-red/20 border border-red/30 text-red px-3 py-1 rounded-full font-mono">
              URL: /#/admin
            </span>
            <span className="inline-flex items-center gap-1 text-xs bg-amber/20 border border-amber/30 text-amber px-2 py-1 rounded-full">
              <Eye className="w-3 h-3"/> Staff only
            </span>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 anim-fade-up-2">
        {[
          { label:'Active Accounts', value:users.length, color:'text-blue-light', icon:Users },
          { label:'Fraud Flags',     value:flaggedUsers.length, color:flaggedUsers.length>0?'text-red':'text-green', icon:Shield },
          { label:'Platform Balance', value:formatCurrency(totalBalance), color:'text-green', icon:CheckCircle },
          { label:'NFC Rides (DB)',   value:totalRides, color:'text-amber', icon:CheckCircle },
        ].map(({label,value,color,icon:Icon})=>(
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <Icon className={`w-4 h-4 ${color} mb-2`}/>
            <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap anim-fade-up-3">
        {[['overview','Overview'],['flags','🚨 Fraud'],['tokens','🎁 Tokens'],['scans','📡 Scans'],['accounts','👤 Accounts']].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${tab===id?'bg-blue border-blue text-white':'border-white/10 text-slate hover:border-blue/40'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab==='overview' && (
        <div className="anim-fade-in space-y-3">
          <div className="bg-blue/10 border border-blue/20 rounded-2xl p-5">
            <div className="font-display text-lg font-bold text-white mb-3">💡 Impact Metrics</div>
            <div className="space-y-2 text-sm">
              {[
                ['Fare evasion reduction target','↓ 30%','text-green'],
                ['Card recovery time','48h → Instant','text-blue-light'],
                ['$5 replacement fee','Eliminated','text-amber'],
                ['Emergency gifting','Active','text-green'],
                ['Guest QR fraud controls','5-min rescan lock','text-green'],
              ].map(([l,v,c])=>(
                <div key={l} className="flex justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-slate">{l}</span><span className={`font-semibold ${c}`}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SQL Schema note */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-slate">
            <div className="text-white font-semibold mb-2 not-italic font-display text-sm">SQLite Tables</div>
            {['users','contacts','pools','gift_tokens','scan_log','transactions'].map(t=>(
              <div key={t} className="py-0.5">· {t}</div>
            ))}
          </div>
        </div>
      )}

      {/* Fraud flags */}
      {tab==='flags' && (
        <div className="anim-fade-in space-y-3">
          {flaggedUsers.length===0 ? (
            <div className="text-center py-10 bg-green/10 border border-green/20 rounded-2xl">
              <CheckCircle className="w-10 h-10 text-green mx-auto mb-2"/><div className="text-green font-semibold">No active fraud flags</div>
            </div>
          ) : flaggedUsers.map(u=>(
            <div key={u.id} className="bg-red/10 border border-red/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{background:u.photoColor}}>{u.photoInitials}</div>
                  <div><div className="font-semibold text-white text-sm">{u.name}</div><div className="text-xs text-slate">{u.peggoId}</div></div>
                </div>
                <span className="bg-red/20 text-red text-xs px-2 py-1 rounded-full font-semibold">{u.fraudFlags} flag(s)</span>
              </div>
              <div className="space-y-1">
                {fraud.filter(f=>f.account_id===u.id).slice(0,3).map((f,i)=>(
                  <div key={i} className="text-xs text-amber/80 bg-amber/10 rounded-lg px-3 py-1.5">{f.reject_reason || 'Suspicious scan'} — {formatDateTime(f.scanned_at)}</div>
                ))}
              </div>
              <button onClick={()=>clearFlag(u.id)} className="w-full py-2 text-xs rounded-lg bg-white/10 text-slate hover:text-white transition-colors">Clear Flags</button>
            </div>
          ))}
        </div>
      )}

      {/* Gift tokens */}
      {tab==='tokens' && (
        <div className="anim-fade-in space-y-2">
          {tokens.map(t=>(
            <div key={t.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-blue-light">{t.id}</div>
                <div className="text-sm text-white mt-0.5">{t.senderName} → {t.recipientEmail || t.recipientPhone || t.recipientUserId || '—'}</div>
                <div className="text-xs text-slate mt-0.5">{t.recipientType} · {formatCurrency(t.fare)} · {t.scanCount} scan(s)</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0 ${
                t.status==='pending'?'bg-slate/20 text-slate':
                t.status==='active'?'bg-green/20 text-green':
                t.status==='expired'?'bg-red/20 text-red':
                'bg-blue/20 text-blue-light'}`}>{t.status}</span>
            </div>
          ))}
          {tokens.length===0&&<div className="text-center py-10 text-slate text-sm">No gift tokens yet.</div>}
        </div>
      )}

      {/* Scan log */}
      {tab==='scans' && (
        <div className="anim-fade-in space-y-2">
          {scans.map(s=>(
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-lg">{s.scan_type==='nfc'?'📡':'📱'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{s.location}</div>
                <div className="text-xs text-slate font-mono">{formatDateTime(s.scanned_at)}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-xs font-semibold ${s.accepted?'text-green':'text-red'}`}>{s.accepted?'✓ Accepted':'✕ Rejected'}</div>
                {s.fraud_flag?<div className="text-xs text-amber">⚠ flagged</div>:null}
              </div>
            </div>
          ))}
          {scans.length===0&&<div className="text-center py-10 text-slate text-sm">No scans yet.</div>}
        </div>
      )}

      {/* All accounts */}
      {tab==='accounts' && (
        <div className="anim-fade-in space-y-2">
          {users.map(u=>(
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:u.photoColor}}>{u.photoInitials}</div>
              <div className="flex-1 min-w-0"><div className="text-sm text-white font-medium truncate">{u.name}</div><div className="text-xs text-slate">{u.accountType} · {u.peggoId||'No card'}</div></div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-sm text-white">{formatCurrency(u.balance)}</div>
                {u.fraudFlags>0&&<div className="text-xs text-red">{u.fraudFlags} flag</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
