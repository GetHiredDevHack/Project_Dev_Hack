import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../utils/AuthContext'
import { api, formatCurrency, TX_ICON, formatTime, formatDateLabel } from '../utils/api'

const FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'ride',   label: 'Rides' },
  { key: 'topup',  label: 'Top-Ups' },
  { key: 'gift',   label: 'Gifts' },
]

const TYPE_LABEL = {
  ride:          'Bus Ride',
  gift_sent:     'Gift Sent',
  gift_received: 'Gift Received',
  topup:         'Top-Up',
  fraud:         'Security Alert',
}

const TYPE_COLOR = {
  ride:          'text-blue-light',
  gift_sent:     'text-amber',
  gift_received: 'text-green',
  topup:         'text-green',
  fraud:         'text-red',
}

function groupByDate(txs) {
  const groups = {}
  for (const tx of txs) {
    const label = formatDateLabel(tx.created_at)
    if (!groups[label]) groups[label] = []
    groups[label].push(tx)
  }
  return groups
}

export default function HistoryPage() {
  const { user } = useAuth()
  const [txs, setTxs] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    api.getTransactions(user.id).then(d => setTxs(d.transactions)).catch(()=>{})
  }, [user])

  const filtered = useMemo(() => {
    if (filter === 'all') return txs
    if (filter === 'gift') return txs.filter(t => t.type === 'gift_sent' || t.type === 'gift_received')
    return txs.filter(t => t.type === filter)
  }, [txs, filter])

  const grouped = useMemo(() => groupByDate(filtered), [filtered])

  // Stats
  const totalRides = txs.filter(t => t.type === 'ride').length
  const totalTopUps = txs.filter(t => t.type === 'topup').reduce((s, t) => s + t.amount_cents, 0) / 100
  const totalGiftsSent = txs.filter(t => t.type === 'gift_sent').reduce((s, t) => s + Math.abs(t.amount_cents), 0) / 100
  const totalGiftsReceived = txs.filter(t => t.type === 'gift_received').reduce((s, t) => s + t.amount_cents, 0) / 100

  // Running balance (from oldest to newest, then reverse for display)
  const runningBalances = useMemo(() => {
    const balances = {}
    let running = user.balanceCents || Math.round(user.balance * 100)
    // txs are newest-first; walk forward to compute current-to-past
    for (const tx of filtered) {
      balances[tx.id] = running / 100
      running -= tx.amount_cents // undo the transaction to get prior balance
    }
    return balances
  }, [filtered, user])

  return (
    <div className="anim-fade-up space-y-5">
      <div className="anim-fade-up-1">
        <h2 className="font-display text-3xl font-bold text-white">Activity</h2>
        <p className="text-slate text-sm mt-1">Your transaction history</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 anim-fade-up-2">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate mb-1">Total Rides</div>
          <div className="font-display text-2xl font-bold text-blue-light">{totalRides}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate mb-1">Money Added</div>
          <div className="font-display text-2xl font-bold text-green">+{formatCurrency(totalTopUps)}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate mb-1">Gifts Sent</div>
          <div className="font-display text-2xl font-bold text-amber">{totalGiftsSent > 0 ? '-' : ''}{formatCurrency(totalGiftsSent)}</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="text-xs text-slate mb-1">Gifts Received</div>
          <div className="font-display text-2xl font-bold text-green">+{formatCurrency(totalGiftsReceived)}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 anim-fade-up-3">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${filter === f.key ? 'bg-blue border-blue text-white' : 'border-white/10 text-slate hover:border-blue/40'}`}>
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1 text-slate/40">
                {f.key === 'gift' ? txs.filter(t => t.type==='gift_sent'||t.type==='gift_received').length : txs.filter(t => t.type === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Transaction list grouped by date */}
      <div className="space-y-4 anim-fade-up-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate text-sm">
            {filter === 'all' ? 'No transactions yet.' : `No ${FILTERS.find(f=>f.key===filter)?.label.toLowerCase()} yet.`}
          </div>
        ) : (
          Object.entries(grouped).map(([dateLabel, dateTxs]) => (
            <div key={dateLabel}>
              <div className="text-xs font-semibold text-slate/50 uppercase tracking-widest mb-2 px-1">{dateLabel}</div>
              <div className="space-y-1.5">
                {dateTxs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[.07] transition-colors">
                    <span className="text-xl w-8 text-center flex-shrink-0">{TX_ICON[tx.type] || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">{tx.description}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-semibold ${TYPE_COLOR[tx.type]}`}>{TYPE_LABEL[tx.type]}</span>
                        <span className="text-xs text-slate/30">·</span>
                        <span className="text-xs text-slate/50 font-mono">{formatTime(tx.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`font-mono text-sm font-bold ${tx.amount > 0 ? 'text-green' : 'text-white/70'}`}>
                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                      </div>
                      <div className="text-xs text-slate/30 font-mono">
                        bal: {formatCurrency(runningBalances[tx.id] ?? 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
