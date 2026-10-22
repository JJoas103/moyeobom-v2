import { Link } from 'react-router-dom'
import ScreenPlaceholder from '../components/common/ScreenPlaceholder'
import DataState from '../components/common/DataState'
import { useAsync } from '../utils/useAsync'
import { fetchEvents } from '../data/events'
import { fetchMeetups } from '../data/meetups'
import { apiGet } from '../api'
import { USE_MOCK_EVENTS, USE_MOCK_MEETUPS } from '../data/config'
import { formatTodayTitle } from '../utils/format'

// 연결 확인용 임시 홈 — 나중에 시안 v2 · 홈(V2Home)으로 교체
export default function Home() {
  const counts = useAsync(async () => {
    const [events, meetups] = await Promise.all([fetchEvents(), fetchMeetups({ openOnly: true })])
    return { events: events.length, meetups: meetups.length }
  }, [])
  const health = useAsync(() => apiGet('/api/health'), [])

  return (
    <ScreenPlaceholder title={formatTodayTitle()} artboard="시안 v2 · 홈">
      <DataState loading={counts.loading} error={counts.error}>
        <p>
          열려 있는 행사 <strong>{counts.data?.events}</strong>
          {USE_MOCK_EVENTS && ' (목업)'} · 모집 중인 모임 <strong>{counts.data?.meetups}</strong>
          {USE_MOCK_MEETUPS && ' (목업)'}
        </p>
      </DataState>

      <p style={{ marginTop: 16 }}>
        백엔드 연결:{' '}
        {health.loading
          ? '확인 중...'
          : health.error
            ? `✕ ${health.error.message}`
            : `✓ 서버 ${health.data.server} · DB ${health.data.db}`}
      </p>

      <ul style={{ marginTop: 24, paddingLeft: 20 }}>
        <li><Link to="/event">행사 목록</Link></li>
        <li><Link to="/meetup">모임 목록</Link></li>
        <li><Link to="/meetup/new">모임 만들기</Link></li>
      </ul>
    </ScreenPlaceholder>
  )
}
