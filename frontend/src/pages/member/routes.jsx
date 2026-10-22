import { Route } from 'react-router-dom'
import Login from './Login'
import Join from './Join'
import SocialJoin from './SocialJoin'

// /member 하위 라우트
const memberRoutes = (
  <>
    <Route path="login" element={<Login />} />
    <Route path="join" element={<Join />} />
    <Route path="social-join" element={<SocialJoin />} />
  </>
)

export default memberRoutes
