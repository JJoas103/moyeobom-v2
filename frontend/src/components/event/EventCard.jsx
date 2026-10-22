import { useState } from 'react'
import { Link } from 'react-router-dom'
import Poster from '../common/Poster'
import { HeartIcon, UsersIcon } from '../common/Icons'
import { eventStatus } from '../../utils/status'
import { formatEventPeriod } from '../../utils/format'

/** 행사 목록 · 홈 · 비슷한 행사에서 쓰는 포스터 카드 */
export default function EventCard({ event }) {
  // TODO(인증 단계): 찜은 서버에 저장. 지금은 화면 확인용 로컬 상태
  const [liked, setLiked] = useState(false)
  const status = eventStatus(event)
  const place = event.district || (event.runType === 'screening' ? '상영 중' : '')
  const meta = [formatEventPeriod(event), place].filter(Boolean).join(' · ')
  return (
    <article className="card">
      <Link to={`/event/${event._id}`} className="card__link">
        <Poster
          id={event._id}
          imageUrl={event.posterUrl}
          category={event.category}
          subtitle={event.subtitle}
          title={event.title}
        />
        <div className="card__body">
          <span className={`status status--${status.tone}`}>{status.label}</span>
          <h3 className="card__title clamp2">{event.title}</h3>
          <span className="card__meta">{meta}</span>
          {event.meetupCount > 0 ? (
            <span className="card__meet">
              <UsersIcon /> 이 행사로 열린 모임 {event.meetupCount}
            </span>
          ) : (
            <span className="card__meet card__meet--empty">첫 모임을 열어보세요</span>
          )}
        </div>
      </Link>

      <button
        type="button"
        className="card__like"
        aria-label={liked ? '찜 해제' : '찜하기'}
        aria-pressed={liked}
        onClick={() => setLiked((v) => !v)}
      >
        <span className={`card__like-circle${liked ? ' is-on' : ''}`}>
          <HeartIcon filled={liked} />
        </span>
      </button>
    </article>
  )
}
