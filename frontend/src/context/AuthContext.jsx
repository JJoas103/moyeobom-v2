import { createContext, useContext, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api'

// 인증 상태 — 첫 화면에서 GET /api/auth/me 로 세션 확인
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true) // 최초 세션 확인 중인지

  useEffect(() => {
    let cancelled = false
    apiGet('/api/auth/me')
      .then((data) => !cancelled && setUser(data.user))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setAuthLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email, password) => {
    const data = await apiPost('/api/auth/login', { email, password })
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    await apiPost('/api/auth/logout')
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const data = await apiGet('/api/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, authLoading, login, logout, refreshUser }}>{children}</AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- 컨텍스트 · 훅 한 파일
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요')
  return context
}
