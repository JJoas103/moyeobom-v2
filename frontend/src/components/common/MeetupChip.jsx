import MiniPoster from './MiniPoster'
import { formatMonthDay } from '../../utils/format'

/** 만난 모임 한 줄 — 포스터 조각 + '커튼콜 끝나고 넘버 얘기해요' + '여름밤의 정원 · 09.30' */
export default function MeetupChip({ meetup }) {
  if (!meetup) return null
  return (
    <span className="meetup-chip">
      <MiniPoster meetup={meetup} width={24} height={32} radius={4} />
      <span className="meetup-chip__text">
        <span className="meetup-chip__title one-line">{meetup.title}</span>
        <span className="meetup-chip__sub one-line">
          {meetup.event?.title ? `${meetup.event.title} · ` : ''}
          {formatMonthDay(meetup.talk.startAt)}
        </span>
      </span>
    </span>
  )
}
