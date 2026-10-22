import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** 로그인 필요한 화면 — 비로그인이면 로그인 화면으로, 로그인 후 이 화면으로 복귀 */
export default function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/member/login" replace state={{ from: location.pathname + location.search }} />
  return children
}
