import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './utils/AuthContext'
import AuthPage    from './pages/AuthPage'
import Dashboard   from './pages/Dashboard'
import NFCPage     from './pages/NFCPage'
import GiftPage    from './pages/GiftPage'
import PoolPage    from './pages/PoolPage'
import HistoryPage from './pages/HistoryPage'
import AdminPage   from './pages/AdminPage'
import ProfilePage from './pages/ProfilePage'
import PassesPage  from './pages/PassesPage'
import BottomNav   from './components/BottomNav'
import { CreditCard, Shield } from 'lucide-react'

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const h = () => setHash(window.location.hash)
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return hash
}

function AdminShell() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen bg-navy">
      <header className="sticky top-0 z-30 bg-navy/95 backdrop-blur-sm border-b border-red/20">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-red rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-white"/></div>
            <div>
              <span className="font-display font-bold text-white">TransitLink</span>
              <span className="text-red text-[10px] font-mono ml-1.5 uppercase tracking-widest">Admin Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-slate hover:text-white transition-colors">← Back to App</a>
            {user && <button onClick={logout} className="text-slate/40 hover:text-slate transition-colors"><LogOut className="w-4 h-4"/></button>}
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-6"><AdminPage/></main>
    </div>
  )
}

function AppShell() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('dashboard')
  const hash = useHashRoute()

  if (hash === '#/admin') return <AdminShell/>
  if (!user) return <AuthPage/>

  const renderPage = () => {
    switch(page) {
      case 'dashboard': return <Dashboard onNavigate={setPage}/>
      case 'qr':        return <NFCPage/>
      case 'gift':      return <GiftPage/>
      case 'pool':      return <PoolPage/>
      case 'history':   return <HistoryPage/>
      case 'profile':   return <ProfilePage/>
      case 'passes':    return <PassesPage/>
      default:          return <Dashboard onNavigate={setPage}/>
    }
  }

  return (
    <div className="min-h-screen bg-navy">
      <header className="sticky top-0 z-30 bg-navy/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue rounded-lg flex items-center justify-center"><CreditCard className="w-4 h-4 text-white"/></div>
            <div>
              <span className="font-display font-bold text-white">TransitLink</span>
              <span className="text-slate text-[10px] font-mono ml-1.5">WINNIPEG</span>
            </div>
          </div>
          {/* Clickable profile area */}
          <button
            onClick={() => setPage('profile')}
            className={`flex items-center gap-2 px-2 py-1 rounded-xl transition-all hover:bg-white/10 ${page === 'profile' ? 'bg-white/10 ring-1 ring-blue/40' : ''}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{background: user.photoColor}}>
              {user.photoInitials}
            </div>
            <span className="text-xs text-slate hidden sm:block">{user.name.split(' ')[0]}</span>
          </button>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-5 py-6 pb-28">{renderPage()}</main>
      <BottomNav active={page} onNavigate={setPage}/>
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppShell/></AuthProvider>
}
