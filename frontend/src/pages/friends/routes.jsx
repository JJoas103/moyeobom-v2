import { Route } from 'react-router-dom'
import RequireAuth from '../../components/RequireAuth'
import Friends from './Friends'

// /friends — 로그인 필요. 요청 탭은 없다 (서로 고르면 바로 친구가 되므로)
const friendRoutes = (
  <Route
    index
    element={
      <RequireAuth>
        <Friends />
      </RequireAuth>
    }
  />
)

export default friendRoutes
