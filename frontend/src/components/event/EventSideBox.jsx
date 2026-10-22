import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalIcon, HeartIcon } from '../common/Icons'
import { eventStatus, meetupStatus } from '../../utils/status'
import { formatEventPeriod, formatMeetupWhen } from '../../utils/format'
import { canOpenMeetup, sourceOf } from '../../utils/event'

// 행사 상세 오른쪽 박스 — 모임 수 · 찜 · 모임 만들기 · 예매
export default function EventSideBox({ event, meetups }) {
  const [liked, setLiked] = useState(false) // TODO(찜 단계): 서버 저장
  const status = eventStatus(event)
  const source = sourceOf(event)
  const openable = canOpenMeetup(event)

  const openMeetups = (meetups || []).filter((m) => meetupStatus(m).tone !== 'closed')
  const earliest = openMeetups[0] // fetchMeetups 는 가까운 날짜순

  // 예매 링크 없으면 출처 페이지로 대체 · 끝난 행사는 숨김
  let booking = null
  if (status.tone !== 'closed') {
    if (event.bookingUrl) booking = { url: event.bookingUrl, label: '예매하러 가기' }
    else if (source.url) booking = { url: source.url, label: '예매 정보 보기' }
  }

  return (
    <aside className="side-box">
      <h2 className="side-box__title">{event.title}</h2>
      <span className="side-box__sub">{[formatEventPeriod(event), event.district, event.area].filter(Boolean).join(' · ')}</span>
      <div className="side-box__line" />
      <dl className="side-box__stats">
        <dt>열린 모임</dt>
        <dd>{event.meetupCount}개</dd>
        <dt>지금 모집 중</dt>
        <dd className="is-open">{event.openMeetupCount}개</dd>
        <dt>가장 빠른 모임</dt>
        <dd>{earliest ? formatMeetupWhen(earliest.talk.startAt) : '—'}</dd>
      </dl>
      <div className="side-box__actions">
        <button
          type="button"
          className={`like-btn${liked ? ' is-on' : ''}`}
          aria-label={liked ? '찜 해제' : '찜하기'}
          aria-pressed={liked}
          onClick={() => setLiked((v) => !v)}
        >
          <HeartIcon size={20} filled={liked} />
          <span>찜</span>
        </button>
        {openable ? (
          <Link to={`/meetup/new/${event._id}`} className="btn btn--primary btn--lg side-box__cta">
            이 행사로 모임 만들기
          </Link>
        ) : (
          <button type="button" className="btn btn--lg side-box__cta" disabled>
            모임을 열 수 있는 기간이 지났어요
          </button>
        )}
      </div>
      {booking && (
        <a href={booking.url} target="_blank" rel="noreferrer" className="btn btn--line side-box__booking">
          {booking.label} <ExternalIcon />
        </a>
      )}
      <p className="side-box__note">티켓은 각자 예매해요. 모임 참여는 호스트가 승인하면 확정돼요. 이미 본 행사도 괜찮아요.</p>
    </aside>
  )
}
