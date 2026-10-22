import { Route } from 'react-router-dom'
import RequireAuth from '../../components/RequireAuth'
import Chat from './Chat'
import MeetupRoomRedirect from './MeetupRoomRedirect'

// /chat 하위 라우트 — 전부 로그인 필요
const withAuth = (element) => <RequireAuth>{element}</RequireAuth>

const chatRoutes = (
  <>
    <Route index element={withAuth(<Chat />)} />
    <Route path="meetup/:meetupId" element={withAuth(<MeetupRoomRedirect />)} />
    <Route path=":roomId" element={withAuth(<Chat />)} />
  </>
)

export default chatRoutes
