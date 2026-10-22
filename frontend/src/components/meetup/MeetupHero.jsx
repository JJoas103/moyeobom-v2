import { Link } from 'react-router-dom'
import Poster from '../common/Poster'
import InfoRow from '../common/InfoRow'
import { CalendarIcon, ClockIcon, CupIcon, PinIcon, UsersIcon, WonIcon } from '../common/Icons'
import { budgetLabel, categoryOf, JOIN_KIND } from '../../data/constants'
import { formatMonthDay, formatTime, formatWeekday } from '../../utils/format'

// 모임 상세 상단 — 포스터 · 상태 · 제목 · 날짜 · 장소 · 인원 · 조건
export default function MeetupHero({ meetup, status }) {
  const { event, talk, watch } = meetup
  const cat = categoryOf(event?.category)

  return (
    <section className="event-hero">
      <div className="event-hero__poster">
        <Poster
          id={event?._id}
          imageUrl={meetup.imageUrl || event?.posterUrl}
          category={event?.category}
          subtitle={event?.subtitle}
          title={event?.title}
          size="lg"
        >
          {status.tone === 'closed' && (
            <span className="poster__veil">{meetup.status === 'cancelled' ? '취소된 모임' : '마감된 모임'}</span>
          )}
        </Poster>
      </div>

      <div className="event-hero__info">
        <div className="card__row">
          <span className={`status status--${status.tone}`}>{status.label}</span>
          <span className="card__kind">{watch?.enabled ? JOIN_KIND.watch : JOIN_KIND.talk}</span>
        </div>
        <h1 className="detail__title">{meetup.title}</h1>
        <Link to={`/event/${event?._id}`} className="event-link">
          <span className="cat-dot" style={{ background: cat.color }} />
          {event?.title} 보고 나서 ›
        </Link>

        <ul className="info-list info-list--compact">
          <InfoRow icon={<CalendarIcon />} label="날짜">
            {formatMonthDay(talk.startAt)} {formatWeekday(talk.startAt)}
          </InfoRow>
          <InfoRow icon={<ClockIcon />} label="이야기 자리">
            {formatTime(talk.startAt)}
          </InfoRow>
          <InfoRow icon={<PinIcon />} label="장소">
            {/* talk.place 는 호스트 · 승인된 참여자에게만 옴 */}
            {talk.place ? (
              <>
                {talk.place} <span className="info-list__sub">({talk.area})</span>
              </>
            ) : (
              <>
                {talk.area} <span className="info-list__sub">(승인 후 공개)</span>
              </>
            )}
          </InfoRow>
          <InfoRow icon={<UsersIcon size={18} />} label="인원">
            {meetup.approvedCount}/{meetup.capacity}명 · 호스트 승인제
          </InfoRow>
        </ul>

        <div className="condition-chips">
          <span className="condition-chip">
            <CupIcon />술 {meetup.alcohol ? '있음' : '없음'}
          </span>
          <span className="condition-chip">
            <WonIcon />
            {budgetLabel(meetup.budget)}
          </span>
        </div>
      </div>
    </section>
  )
}
