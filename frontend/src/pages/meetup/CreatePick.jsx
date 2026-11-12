import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CategoryChips from '../../components/common/CategoryChips'
import SearchInput from '../../components/common/SearchInput'
import CreateSteps from '../../components/meetup/CreateSteps'
import EventPickRow from '../../components/meetup/EventPickRow'
import { useAuth } from '../../context/AuthContext'
import { fetchLikes } from '../../data/likes'
import { canOpenMeetup } from '../../utils/event'
import { useAsync } from '../../utils/useAsync'
import { useDebounced } from '../../utils/useDebounced'
import { useQueryFilters } from '../../utils/useQueryFilters'
import { fetchEvent, fetchEvents, fetchRecentEndedEvents, RECENT_ENDED_DAYS } from '../../data/events'
import { categoryText } from '../../data/constants'
import MetaLine from '../../components/common/MetaLine'
import { posterTone } from '../../utils/poster'
import { formatEventPeriod } from '../../utils/format'
import '../../styles/detail.css' // section-head · side-box 같은 공통 조각
import '../../styles/create.css'

const RESULT_LIMIT = 8

// 목록 탭 — 세 목록 중 한 번에 하나만 보여 준다
const TABS = [
  { key: 'open', label: '지금 열려 있는 행사' },
  { key: 'liked', label: '찜한 행사' },
  { key: 'ended', label: '최근 끝난 행사' },
]

// 시안 v2 · 모임 만들기 ① 행사 고르기 (V2CreatePick)
export default function CreatePick() {
  const navigate = useNavigate()
  const filters = useQueryFilters()
  const category = filters.get('category')
  const pickedId = filters.get('event') // 고른 행사는 주소에 → ②에서 '행사 바꾸기'로 돌아와도 유지
  const tab = TABS.some((t) => t.key === filters.get('tab')) ? filters.get('tab') : 'open' // 탭도 주소에

  const [q, setQ] = useState('')
  const keyword = useDebounced(q)
  const searching = Boolean(keyword.trim() || category)

  // 검색 · 분류는 '지금 열려 있는 행사'에만 걸린다 — 다른 탭에서 쓰면 그 탭으로 넘긴다
  const search = (v) => {
    setQ(v)
    if (tab !== 'open') filters.set('tab', '')
  }
  // 한 번에 바꾼다 — set 을 두 번 부르면 두 번째가 옛 주소 기준이라 첫 번째를 덮는다
  const pickCategory = (v) => filters.set('category', v, { clear: ['tab'] })

  const results = useAsync(() => fetchEvents({ q: keyword, category, sort: 'meetups', limit: RESULT_LIMIT }), [keyword, category])
  const recentEnded = useAsync(() => fetchRecentEndedEvents(), [])
  const picked = useAsync(() => (pickedId ? fetchEvent(pickedId) : Promise.resolve(null)), [pickedId])
  const { user } = useAuth()
  const likes = useAsync(() => (user ? fetchLikes() : Promise.resolve(null)), [user?._id])
  const likedEvents = (likes.data?.events || []).filter((e) => canOpenMeetup(e)) // 모임을 열 수 있는 기간이 지난 행사는 뺌

  const pick = (event) => filters.set('event', event._id)

  return (
    <div className="create-page">
      <Link to="/meetup" className="back-link">
        ‹ 모임
      </Link>

      <div className="page-head">
        <h1>모임 만들기</h1>
        <span className="spacer" />
        <CreateSteps current={1} />
      </div>

      <div className="pick-layout">
        <div className="pick-main">
          <div className="pick-search">
            <span className="pick-search__label">어떤 행사를 보고 이야기할까요?</span>
            <SearchInput value={q} onChange={search} placeholder="행사 이름으로 찾기" label="행사 검색" width="100%" />
            <CategoryChips value={category} onChange={pickCategory} />
          </div>

          <section className="pick-section">
            <div className="pick-tabs" role="tablist" aria-label="행사 목록">
              {TABS.map((t) => {
                const count =
                  t.key === 'open' ? results.data?.total : t.key === 'liked' ? (user && likes.data ? likedEvents.length : null) : recentEnded.data?.length
                const label = t.key === 'open' && searching ? '검색 결과' : t.label
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    id={`pick-tab-${t.key}`}
                    aria-selected={tab === t.key}
                    aria-controls="pick-panel"
                    className={`pick-tabs__tab${tab === t.key ? ' is-active' : ''}`}
                    onClick={() => filters.set('tab', t.key === 'open' ? '' : t.key)}
                  >
                    {label}
                    {count != null && <span className="pick-tabs__count">{count}</span>}
                  </button>
                )
              })}
              <span className="spacer" />
              {tab === 'ended' && <span className="section-head__hint">이미 본 행사로도 개설 가능</span>}
            </div>

            <div id="pick-panel" role="tabpanel" aria-labelledby={`pick-tab-${tab}`}>
              {tab === 'open' && (
                <PickList loading={results.loading && !results.data} empty={searching ? '찾는 행사 없음' : '열려 있는 행사 없음'}>
                  {results.data?.events.map((e) => (
                    <EventPickRow key={e._id} event={e} checked={pickedId === e._id} onChange={pick} />
                  ))}
                </PickList>
              )}
              {tab === 'liked' && (
                <PickList loading={Boolean(user) && likes.loading && !likes.data} empty={user ? '찜한 행사 없음' : '로그인하면 찜한 행사 표시'}>
                  {likedEvents.map((e) => (
                    <EventPickRow key={e._id} event={e} checked={pickedId === e._id} onChange={pick} />
                  ))}
                </PickList>
              )}
              {tab === 'ended' && (
                <PickList loading={recentEnded.loading && !recentEnded.data} empty={`최근 ${RECENT_ENDED_DAYS}일 안에 끝난 행사 없음`}>
                  {recentEnded.data?.map((e) => (
                    <EventPickRow key={e._id} event={e} checked={pickedId === e._id} onChange={pick} />
                  ))}
                </PickList>
              )}
            </div>
          </section>
        </div>

        <aside className="side-box pick-side">
          <span className="pick-side__label">고른 행사</span>
          {picked.data ? (
            <PickedSummary event={picked.data} />
          ) : (
            <p className="pick-side__empty">왼쪽에서 행사 선택</p>
          )}
          <div className="side-box__line" />
          <p className="side-box__note">기간 · 회차 · 장소는 행사 정보로 자동 입력</p>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={!picked.data}
            onClick={() => navigate(`/meetup/new/${picked.data._id}`)}
          >
            다음
          </button>
        </aside>
      </div>
    </div>
  )
}

/** 탭 안의 행사 목록 — 라디오 묶음 (EventPickRow 가 라디오) */
function PickList({ loading, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : []
  if (loading) return <div className="pick-empty">불러오는 중…</div>
  if (items.length === 0) return <div className="pick-empty">{empty}</div>
  return (
    <div className="pick-list" role="radiogroup" aria-label="행사 고르기">
      {items}
    </div>
  )
}

function PickedSummary({ event }) {
  const tone = posterTone(event._id)
  return (
    <div className="picked">
      <div className="picked__poster" style={{ background: tone.bg, color: tone.ink }}>
        {event.posterUrl ? <img src={event.posterUrl} alt="" /> : <span>{event.title}</span>}
      </div>
      <div className="picked__body">
        <span className="picked__title">{event.title}</span>
        <span>{categoryText(event, { withRunType: true })}</span>
        <span><MetaLine items={[formatEventPeriod(event), event.area || event.district]} /></span>
      </div>
    </div>
  )
}
