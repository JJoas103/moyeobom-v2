import { Link, useSearchParams } from 'react-router-dom'
import DataState from '../components/common/DataState'
import SectionHead from '../components/common/SectionHead'
import EventCard from '../components/event/EventCard'
import MeetupCard from '../components/meetup/MeetupCard'
import HomeRecommend from '../components/home/HomeRecommend'
import HomeCalendar from '../components/home/HomeCalendar'
import HomeMap from '../components/home/HomeMap'
import { useAsync } from '../utils/useAsync'
import { fetchEvents } from '../data/events'
import { fetchMeetups } from '../data/meetups'
import { formatTodayTitle } from '../utils/format'
import '../styles/list.css'
import '../styles/detail.css'
import '../styles/home.css'

const VIEWS = [
  { key: 'rec', label: '추천 홈' },
  { key: 'map', label: '지도로 보기' },
  { key: 'cal', label: '달력으로 보기' },
]
const SECTION_SIZE = 5

// 시안 html/home.html — 오늘 날짜 + 보기 탭(추천 · 지도 · 달력) + 이번 주 모임 + 지금 열려 있는 행사
export default function Home() {
  // 탭은 주소(/?view=map)에 저장 → 상세 갔다가 뒤로 와도 유지
  const [params, setParams] = useSearchParams()
  const view = VIEWS.some((v) => v.key === params.get('view')) ? params.get('view') : 'rec'

  // 아래 섹션에 쓸 만큼만 받고 개수는 total 을 읽는다 (전량을 받으면 수천 건에서 멈춘다)
  const events = useAsync(() => fetchEvents({ limit: SECTION_SIZE }), [])
  const weekMeetups = useAsync(() => fetchMeetups({ period: 'week' }), [])
  const openMeetups = useAsync(() => fetchMeetups({ openOnly: true }), [])

  const pick = (key) => setParams(key === 'rec' ? {} : { view: key }, { replace: true })

  return (
    <div className="home">
      <div className="home__top">
        <section className="page-head home-head">
          <h1>{formatTodayTitle()}</h1>
          <span className="spacer" />
          <div className="home-head__counts">
            <span>
              열려 있는 행사 <strong>{events.data?.total ?? '-'}</strong>
            </span>
            <span>
              모집 중인 모임 <strong>{openMeetups.data?.length ?? '-'}</strong>
            </span>
          </div>
        </section>

        <div className="home-view">
          <div role="tablist" aria-label="홈 보기 방식" className="home-tabs">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" role="tab" aria-selected={view === v.key} className={`home-tabs__tab${view === v.key ? ' is-active' : ''}`} onClick={() => pick(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="home-view__body" role="tabpanel" aria-label={VIEWS.find((v) => v.key === view).label}>
            {view === 'rec' && <HomeRecommend />}
            {view === 'map' && <HomeMap />}
            {view === 'cal' && <HomeCalendar />}
          </div>
        </div>
      </div>

      <section className="home-section">
        <SectionHead title="이번 주 모임" count={weekMeetups.data?.length} moreTo="/meetup" moreLabel="모임 전체" />
        <DataState
          loading={weekMeetups.loading && !weekMeetups.data}
          error={weekMeetups.error}
          empty={weekMeetups.data?.length === 0}
          emptyText={
            <>
              <strong>이번 주 모임이 아직 없어요</strong>
              <Link to="/meetup/new" className="btn btn--line home-empty__btn">
                첫 모임 열기
              </Link>
            </>
          }
        >
          <div className="card-grid">
            {weekMeetups.data?.slice(0, SECTION_SIZE).map((m) => (
              <MeetupCard key={m._id} meetup={m} />
            ))}
          </div>
        </DataState>
      </section>

      <section className="home-section">
        <SectionHead title="지금 열려 있는 행사" count={events.data?.total} moreTo="/event?period=all" moreLabel="행사 전체" />
        <DataState loading={events.loading && !events.data} error={events.error} empty={events.data?.total === 0} emptyText="지금 열려 있는 행사가 없어요">
          <div className="card-grid">
            {events.data?.events.map((e) => (
              <EventCard key={e._id} event={e} />
            ))}
          </div>
        </DataState>
      </section>
    </div>
  )
}
