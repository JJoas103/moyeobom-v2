import { useState } from 'react'
import SectionHead from '../common/SectionHead'
import InfoRow from '../common/InfoRow'
import { CalendarIcon, ClockIcon, FlagIcon, PersonIcon, TagIcon, TicketIcon, UsersIcon } from '../common/Icons'
import { categoryText } from '../../data/constants'
import { formatFullDate, formatMonthDay } from '../../utils/format'
import { estimateEndText, timeLineOf } from '../../utils/event'

// 행사 상세 '행사 정보' — 소개 · 분류 · 기간 · 회차 · 요금 · 관람 연령 · 출연
export default function EventInfo({ event }) {
  const timeLine = timeLineOf(event)
  const endText = estimateEndText(event)

  return (
    <section className="detail-section">
      <SectionHead title="행사 정보" />
      {event.description && <EventDescription text={event.description} />}
      <ul className="info-list">
        <InfoRow icon={<TagIcon />} label="분류">
          {categoryText(event, { withRunType: true })}
        </InfoRow>
        <InfoRow icon={<CalendarIcon />} label="기간">
          {event.endDate
            ? `${formatFullDate(event.startDate)} – ${formatMonthDay(event.endDate)}`
            : `${formatFullDate(event.startDate)} 개봉`}
        </InfoRow>
        {timeLine && (
          <InfoRow icon={<ClockIcon />} label={event.runType === 'session' ? '회차' : '시간'}>
            {timeLine}
          </InfoRow>
        )}
        {endText && (
          <InfoRow icon={<FlagIcon />} label="예상 종료">
            {endText} <span className="info-list__sub">(시작 시각 + 러닝타임 예상값)</span>
          </InfoRow>
        )}
        <InfoRow icon={<TicketIcon />} label="요금">
          {event.priceText || '정보 없음'} · 티켓은 각자 예매해요
        </InfoRow>
        <InfoRow icon={<PersonIcon />} label="관람 연령">
          {event.ageLimit || '정보 없음'}
        </InfoRow>
        {event.cast && (
          <InfoRow icon={<UsersIcon size={18} />} label="출연">
            {event.cast}
          </InfoRow>
        )}
      </ul>
    </section>
  )
}

// 소개 — 길면 3줄까지만 · '더보기'
const DESCRIPTION_CLAMP_CHARS = 150

function EventDescription({ text }) {
  const [expanded, setExpanded] = useState(false)
  const long = text.length > DESCRIPTION_CLAMP_CHARS || text.split('\n').length > 3

  return (
    <div className="event-desc">
      <p className={`event-desc__text${long && !expanded ? ' is-clamped' : ''}`}>{text}</p>
      {long && (
        <button type="button" className="event-desc__more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '접기' : '더보기'}
        </button>
      )}
    </div>
  )
}
