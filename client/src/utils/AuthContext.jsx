import React, { createContext, useContext, useState, useCallback } from 'react'
import { api } from './api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null)
  const [error, setError] = useState('')

  const login = async (email, password) => {
    try {
      const data = await api.login(email, password)
      setUser(data.user); setError(''); return true
    } catch (e) { setError(e.message); return false }
  }

  const signup = async (name, email, password, accountType, dateOfBirth) => {
    try {
      const data = await api.signup(name, email, password, accountType, dateOfBirth)
      setUser(data.user); setError(''); return true
    } catch (e) { setError(e.message); return false }
  }

  // Refresh user from server (after balance changes etc.)
  const refreshUser = useCallback(async () => {
    if (!user) return
    try {
      const data = await api.getUser(user.id)
      setUser(data.user)
    } catch (_) {}
  }, [user])

  const logout = () => setUser(null)

  return (
    <AuthCtx.Provider value={{ user, setUser, login, signup, logout, refreshUser, error, setError }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
