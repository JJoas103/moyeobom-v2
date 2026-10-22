import { Route } from 'react-router-dom'
import RequireAuth from '../../components/RequireAuth'
import List from './List'
import Detail from './Detail'
import CreatePick from './CreatePick'
import CreateInfo from './CreateInfo'
import Edit from './Edit'
import Review from './Review'

// /meetup 하위 라우트 — v7 은 'new' 를 ':id' 보다 우선 매칭
// 모임 만들기는 로그인 필요 (만든 사람이 호스트)
const meetupRoutes = (
  <>
    <Route index element={<List />} />
    <Route
      path="new"
      element={
        <RequireAuth>
          <CreatePick />
        </RequireAuth>
      }
    />
    <Route
      path="new/:eventId"
      element={
        <RequireAuth>
          <CreateInfo />
        </RequireAuth>
      }
    />
    <Route
      path=":id/edit"
      element={
        <RequireAuth>
          <Edit />
        </RequireAuth>
      }
    />
    <Route
      path=":id/review"
      element={
        <RequireAuth>
          <Review />
        </RequireAuth>
      }
    />
    <Route path=":id" element={<Detail />} />
  </>
)

export default meetupRoutes
