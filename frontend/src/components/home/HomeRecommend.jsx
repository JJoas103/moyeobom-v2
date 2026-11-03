import { Link } from 'react-router-dom'
import DataState from '../common/DataState'
import Poster from '../common/Poster'
import { UsersIcon } from '../common/Icons'
import { useAuth } from '../../context/AuthContext'
import { fetchRecommendedEvent } from '../../data/events'
import { categoryText } from '../../data/constants'
import { eventStatus } from '../../utils/status'
import { formatEventPeriod } from '../../utils/format'
import { timeLineOf } from '../../utils/event'
import { useAsync } from '../../utils/useAsync'

/** 맞는 조건이 없을 때 이유 칩 자리에 보이는 안내 */
function ReasonHint({ user }) {
  if (!user) {
    return (
      <p className="home-rec__hint">
        <Link to="/member/login">로그인</Link>하면 취향에 맞춰 추천해요.
      </p>
    )
  }
  if (user.tastes.length === 0) {
    return (
      <p className="home-rec__hint">
        <Link to="/my?tab=settings">취향을 고르면</Link> 맞춰 추천해요.
      </p>
    )
  }
  return (
    <p className="home-rec__hint">
      지금은 취향에 맞는 행사가 없어요. <Link to="/my?tab=settings">취향 바꾸기</Link>
    </p>
  )
}

// 추천 홈 — 포스터 + 행사 정보 + 추천 이유. 시안의 찜 버튼은 찜 기능이 생기면 추가
export default function HomeRecommend() {
  const { user } = useAuth()
  const { data, loading, error } = useAsync(() => fetchRecommendedEvent(), [user?._id])
  const event = data?.event

  return (
    <DataState loading={loading && !data} error={error} empty={data && !event} emptyText="지금 추천할 행사가 없어요">
      {event && (
        <section className="home-rec">
          <Link to={`/event/${event._id}`} className="home-rec__poster">
            <Poster id={event._id} imageUrl={event.posterUrl} category={event.category} subtitle={event.subtitle} title={event.title} size="lg" />
          </Link>
          <div className="home-rec__info">
            <div className="tag-row">
              <span className={`status status--${eventStatus(event).tone}`}>{eventStatus(event).label}</span>
              <span className="tag">{categoryText(event)}</span>
            </div>
            <h2 className="home-rec__title">{event.title}</h2>
            <span className="home-rec__meta">
              {[formatEventPeriod(event), event.district, event.venue, timeLineOf(event)].filter(Boolean).join(' · ')}
            </span>
            {data.reasons.length > 0 ? (
              <div className="home-rec__reasons">
                {data.reasons.map((r) => (
                  <span key={r.label} className="home-rec__reason">
                    <strong>{r.label}</strong>
                    {r.text}
                  </span>
                ))}
              </div>
            ) : (
              <ReasonHint user={user} />
            )}
            <span className="home-rec__count">
              <UsersIcon />
              {event.meetupCount > 0 ? (
                <>
                  이 행사로 열린 모임 {event.meetupCount} <span className="home-rec__open">· {event.openMeetupCount}개 모집 중</span>
                </>
              ) : (
                '아직 열린 모임이 없어요'
              )}
            </span>
            <div className="home-rec__actions">
              {event.meetupCount > 0 ? (
                <Link to={`/meetup?event=${event._id}&period=all`} className="btn btn--primary btn--lg">
                  이 행사 모임 보기
                </Link>
              ) : (
                <Link to={`/meetup/new/${event._id}`} className="btn btn--primary btn--lg">
                  이 행사로 모임 열기
                </Link>
              )}
              <Link to={`/event/${event._id}`} className="btn btn--line btn--lg">
                행사 정보
              </Link>
            </div>
          </div>
        </section>
      )}
    </DataState>
  )
}
