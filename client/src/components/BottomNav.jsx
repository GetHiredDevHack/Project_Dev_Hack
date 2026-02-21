import React from 'react'
import { Wallet, Wifi, Gift, Ticket, Clock } from 'lucide-react'

const TABS = [
  { id: 'dashboard', label: 'Wallet',  icon: Wallet },
  { id: 'qr',        label: 'My Pass', icon: Wifi   },
  { id: 'gift',      label: 'Gift',    icon: Gift   },
  { id: 'passes',    label: 'Passes',  icon: Ticket },
  { id: 'history',   label: 'History', icon: Clock  },
]

export default function BottomNav({ active, onNavigate }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-navy-light border-t border-white/10 z-40">
      <div className="max-w-lg mx-auto flex">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button key={id} onClick={() => onNavigate(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors ${isActive ? 'text-blue-light' : 'text-slate/50 hover:text-slate'}`}>
              {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue rounded-full"/>}
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`}/>
              <span className={`text-[10px] ${isActive ? 'font-bold' : ''}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
