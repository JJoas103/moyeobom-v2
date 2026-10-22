import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CategoryChips from '../../components/common/CategoryChips'
import SearchInput from '../../components/common/SearchInput'
import CreateSteps from '../../components/meetup/CreateSteps'
import EventPickRow from '../../components/meetup/EventPickRow'
import { useAsync } from '../../utils/useAsync'
import { useDebounced } from '../../utils/useDebounced'
import { useQueryFilters } from '../../utils/useQueryFilters'
import { fetchEvent, fetchEvents, fetchRecentEndedEvents, RECENT_ENDED_DAYS } from '../../data/events'
import { categoryText } from '../../data/constants'
import { posterTone } from '../../utils/poster'
import { formatEventPeriod } from '../../utils/format'
import '../../styles/detail.css' // section-head · side-box 같은 공통 조각
import '../../styles/create.css'

const RESULT_LIMIT = 8

// 시안 v2 · 모임 만들기 ① 행사 고르기 (V2CreatePick)
export default function CreatePick() {
  const navigate = useNavigate()
  const filters = useQueryFilters()
  const category = filters.get('category')
  const pickedId = filters.get('event') // 고른 행사는 주소에 → ②에서 '행사 바꾸기'로 돌아와도 유지

  const [q, setQ] = useState('')
  const keyword = useDebounced(q)
  const searching = Boolean(keyword.trim() || category)

  const results = useAsync(() => fetchEvents({ q: keyword, category, sort: 'meetups' }), [keyword, category])
  const recentEnded = useAsync(() => fetchRecentEndedEvents(), [])
  const picked = useAsync(() => (pickedId ? fetchEvent(pickedId) : Promise.resolve(null)), [pickedId])

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
            <SearchInput value={q} onChange={setQ} placeholder="행사 이름으로 찾기" label="행사 검색" width="100%" />
            <CategoryChips value={category} onChange={(v) => filters.set('category', v)} />
          </div>

          <PickSection
            title={searching ? '검색 결과' : '지금 열려 있는 행사'}
            count={results.data?.length}
            loading={results.loading && !results.data}
            empty={searching ? '찾는 행사가 없어요. 다른 이름으로 찾아보세요.' : '열려 있는 행사가 없어요.'}
          >
            {results.data?.slice(0, RESULT_LIMIT).map((e) => (
              <EventPickRow key={e._id} event={e} checked={pickedId === e._id} onChange={pick} />
            ))}
          </PickSection>

          <PickSection title="찜한 행사" empty="찜한 행사는 로그인하면 여기 모여요.">
            {/* TODO(인증 단계): GET /api/me/likes */}
          </PickSection>

          <PickSection
            title="최근 끝난 행사"
            hint="이미 본 행사로도 모임을 열 수 있어요"
            loading={recentEnded.loading && !recentEnded.data}
            empty={`최근 ${RECENT_ENDED_DAYS}일 안에 끝난 행사가 없어요.`}
          >
            {recentEnded.data?.map((e) => (
              <EventPickRow key={e._id} event={e} checked={pickedId === e._id} onChange={pick} />
            ))}
          </PickSection>
        </div>

        <aside className="side-box pick-side">
          <span className="pick-side__label">고른 행사</span>
          {picked.data ? (
            <PickedSummary event={picked.data} />
          ) : (
            <p className="pick-side__empty">왼쪽에서 행사를 하나 골라 주세요.</p>
          )}
          <div className="side-box__line" />
          <p className="side-box__note">
            행사 정보(기간 · 회차 · 장소)는 공공데이터에서 그대로 가져와요. 다음 단계에서는 모임 정보만 채우면 돼요.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            disabled={!picked.data}
            onClick={() => navigate(`/meetup/new/${picked.data._id}`)}
          >
            다음 · 모임 정보 쓰기
          </button>
        </aside>
      </div>
    </div>
  )
}

function PickSection({ title, count, hint, loading, empty, children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : []
  return (
    <section className="pick-section" role="radiogroup" aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
        <span className="spacer" />
        {hint && <span className="section-head__hint">{hint}</span>}
        {count != null && <span className="section-head__hint">{count}개</span>}
      </div>
      {loading ? <div className="pick-empty">불러오는 중...</div> : items.length === 0 ? <div className="pick-empty">{empty}</div> : items}
    </section>
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
        <span>{[formatEventPeriod(event), event.area || event.district].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  )
}
