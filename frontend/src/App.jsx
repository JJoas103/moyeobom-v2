import { Outlet, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ScrollToTop from './components/ScrollToTop'
import ErrorMessage from './components/ErrorMessage'
import Home from './pages/Home'
import ComingSoon from './pages/ComingSoon'
import MyMeetups from './pages/my/MyMeetups'
import MyPage from './pages/my/MyPage'
import RequireAuth from './components/RequireAuth'
import eventRoutes from './pages/event/routes'
import meetupRoutes from './pages/meetup/routes'
import memberRoutes from './pages/member/routes'
import friendRoutes from './pages/friends/routes'
import chatRoutes from './pages/chat/routes'
import { useAuth } from './context/AuthContext'

function App() {
  const { authLoading } = useAuth()

  // 첫 세션 확인이 끝나기 전엔 대기 — 로그인한 사람에게 로그인 버튼이 깜빡이지 않게
  if (authLoading) return <div className="state-box">불러오는 중...</div>

  return (
    <>
      <ScrollToTop />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="event" element={<Outlet />}>{eventRoutes}</Route>
          <Route path="meetup" element={<Outlet />}>{meetupRoutes}</Route>
          <Route path="member" element={<Outlet />}>{memberRoutes}</Route>
          <Route path="friends" element={<Outlet />}>{friendRoutes}</Route>
          <Route path="chat" element={<Outlet />}>{chatRoutes}</Route>
          <Route
            path="my/meetups"
            element={
              <RequireAuth>
                <MyMeetups />
              </RequireAuth>
            }
          />
          <Route
            path="my"
            element={
              <RequireAuth>
                <MyPage />
              </RequireAuth>
            }
          />
          <Route path="my/*" element={<ComingSoon />} />
          <Route path="*" element={<ErrorMessage />} />
        </Routes>
      </Layout>
    </>
  )
}

export default App
