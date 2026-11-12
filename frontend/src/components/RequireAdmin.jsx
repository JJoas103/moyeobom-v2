import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * 관리자만 들어가는 화면 — 비로그인이면 로그인 화면으로, 로그인했지만 권한이 없으면 홈으로
 *
 * 로그인 화면으로 보내는 쪽(RequireAuth)과 갈라 둔다 — 권한이 없는 사람을 로그인 화면에 보내면
 * "다시 로그인하면 되나" 로 읽힌다. **판단은 서버 단독이다** (middlewares/authMiddleware.js isAdmin) —
 * 여기는 주소를 직접 쳐서 빈 화면을 보지 않게 하는 거울일 뿐이다
 */
export default function RequireAdmin({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/member/login" replace state={{ from: location.pathname + location.search }} />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}
