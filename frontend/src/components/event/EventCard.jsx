import { Link } from 'react-router-dom'
import LikeButton from '../common/LikeButton'
import Poster from '../common/Poster'
import MetaLine from '../common/MetaLine'
import { UsersIcon } from '../common/Icons'
import { eventStatus } from '../../utils/status'
import { formatEventPeriod } from '../../utils/format'

/** 행사 목록 · 홈 · 비슷한 행사에서 쓰는 포스터 카드 */
export default function EventCard({ event }) {
  const status = eventStatus(event)
  const place = event.district || (event.runType === 'screening' ? '상영 중' : '')
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
          <span className="card__meta"><MetaLine items={[formatEventPeriod(event), place]} /></span>
          {event.meetupCount > 0 ? (
            <span className="card__meet">
              <UsersIcon /> 이 행사로 열린 모임 {event.meetupCount}
            </span>
          ) : (
            <span className="card__meet card__meet--empty">첫 모임을 열어보세요</span>
          )}
        </div>
      </Link>

      <LikeButton type="event" id={event._id} />
    </article>
  )
}
