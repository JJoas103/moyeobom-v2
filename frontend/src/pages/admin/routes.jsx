import { Route } from 'react-router-dom'
import RequireAdmin from '../../components/RequireAdmin'
import Admin from './Admin'
import ReportDetail from './ReportDetail'
import MemberDetail from './MemberDetail'

// /admin 하위 라우트 — 전부 관리자만. 권한 판단은 서버가 하고(middlewares/authMiddleware.js isAdmin)
// RequireAdmin 은 주소를 직접 쳤을 때 빈 화면을 보지 않게 하는 거울이다
const adminRoutes = (
  <>
    <Route
      index
      element={
        <RequireAdmin>
          <Admin />
        </RequireAdmin>
      }
    />
    <Route
      path="reports/:id"
      element={
        <RequireAdmin>
          <ReportDetail />
        </RequireAdmin>
      }
    />
    <Route
      path="members/:id"
      element={
        <RequireAdmin>
          <MemberDetail />
        </RequireAdmin>
      }
    />
  </>
)

export default adminRoutes
