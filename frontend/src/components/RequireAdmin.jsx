import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * 관리자만 들어가는 화면 — 비로그인이면 로그인 화면으로, 권한이 없으면 홈으로
 * 판단은 서버(authMiddleware isAdmin)가 하고 여기는 빈 화면을 보지 않게 막기만 한다
 */
export default function RequireAdmin({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/member/login" replace state={{ from: location.pathname + location.search }} />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}
