import { Link } from 'react-router-dom'
import Poster from '../common/Poster'
import { meetupStatus } from '../../utils/status'
import { formatMeetupWhen, formatMonthDay, formatWeekday, formatTime } from '../../utils/format'
import { JOIN_KIND, budgetLabel } from '../../data/constants'

/**
 * 모임 카드 — 대표 이미지(없으면 행사 포스터) + 상태 · 제목 · 행사 · 언제/어디 · 정원 게이지
 * variant="inEvent": 행사 상세 안에서 사용 — 행사명 줄 빼고 포스터 배지에 날짜
 * note: 참여 방식 자리에 대신 보일 한 줄 (내 모임 — '승인 기다리는 중' 등)
 */
export default function MeetupCard({ meetup, variant = 'default', note }) {
  const inEvent = variant === 'inEvent'
  const { event } = meetup
  const status = meetupStatus(meetup)
  const fill = Math.min(100, Math.round(((meetup.approvedCount || 0) / meetup.capacity) * 100))
  const conditions = `술 ${meetup.alcohol ? '있음' : '없음'} · ${budgetLabel(meetup.budget)}`

  return (
    <article className={`card${status.tone === 'closed' ? ' card--closed' : ''}`}>
      <Link to={`/meetup/${meetup._id}`} className="card__link">
        <Poster
          id={event?._id}
          imageUrl={meetup.imageUrl || event?.posterUrl}
          category={event?.category}
          subtitle={event?.subtitle}
          title={event?.title}
          showBadge={!inEvent}
        >
          {inEvent && (
            <span className="poster__badge poster__badge--date">
              {formatMonthDay(meetup.talk.startAt)} {formatWeekday(meetup.talk.startAt)} {formatTime(meetup.talk.startAt)}
            </span>
          )}
          {status.tone === 'closed' && (
            <span className="poster__veil">
              {meetup.status === 'cancelled' ? '취소된 모임' : status.label === '끝난 모임' ? '끝난 모임' : '마감된 모임'}
            </span>
          )}
        </Poster>

        <div className="card__body">
          <div className="card__row">
            <span className={`status status--${status.tone}`}>{status.label}</span>
            {note || <span className="card__kind one-line">{meetup.watch?.enabled ? JOIN_KIND.watch : JOIN_KIND.talk}</span>}
          </div>
          <h3 className="card__title clamp2">{meetup.title}</h3>
          {inEvent ? (
            <span className="card__meta one-line">
              {meetup.talk.area}
            </span>
          ) : (
            <>
              <span className="card__event one-line">{event?.title}</span>
              <span className="card__meta one-line">
                {formatMeetupWhen(meetup.talk.startAt)} · {meetup.talk.area}
              </span>
            </>
          )}
          <div className="capacity">
            <span className="capacity__bar" aria-hidden="true">
              <span className={`capacity__fill capacity__fill--${status.tone}`} style={{ width: `${fill}%` }} />
            </span>
            <span className="capacity__num">
              <span className="sr-only">정원 중 확정 </span>
              {meetup.approvedCount}/{meetup.capacity}
            </span>
            <span className="one-line">{conditions}</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
