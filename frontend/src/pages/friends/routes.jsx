import { Route } from 'react-router-dom'
import RequireAuth from '../../components/RequireAuth'
import Friends from './Friends'
import Requests from './Requests'

// /friends 하위 라우트 — 전부 로그인 필요
const friendRoutes = (
  <>
    <Route
      index
      element={
        <RequireAuth>
          <Friends />
        </RequireAuth>
      }
    />
    <Route
      path="requests"
      element={
        <RequireAuth>
          <Requests />
        </RequireAuth>
      }
    />
  </>
)

export default friendRoutes
