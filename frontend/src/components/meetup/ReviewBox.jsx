import { Link } from 'react-router-dom'
import { formatDeadline, formatMeetupWhen, formatTimeLeft } from '../../utils/format'

/**
 * 끝난 모임 상세 오른쪽 박스 — 확정 참여자(호스트 포함) 전용. 평가 진입점
 *   평가 열리기 전 / 열림(마감까지 남은 시간 + '모임 평가하기') / 보냄 / 마감
 */
export default function ReviewBox({ meetup }) {
  const { talk, review } = meetup
  const now = new Date()
  const opensAt = new Date(review.opensAt)
  const closesAt = new Date(review.closesAt)
  const state = now < opensAt ? 'before' : now < closesAt ? 'open' : 'closed'

  let body
  if (state === 'before') {
    body = (
      <>
        <span className="review-box__title">오늘 모임 어땠어요?</span>
        <span className="review-box__text">평가는 {formatDeadline(opensAt)}에 열려요. 그때 함께한 사람을 칭찬하고, 다시 보고 싶은 사람을 골라 주세요.</span>
      </>
    )
  } else if (state === 'open' && !review.submitted) {
    body = (
      <>
        <span className="review-box__title">모임이 끝났어요</span>
        <span className="review-box__text">함께한 사람을 칭찬하고, 다시 보고 싶은 사람이 있다면 골라 주세요.</span>
        <div className="review-box__deadline">
          <span>평가 마감</span>
          <strong>
            {formatTimeLeft(closesAt, now)} 남음 · {formatDeadline(closesAt)}
          </strong>
        </div>
      </>
    )
  } else if (state === 'open') {
    body = (
      <>
        <span className="review-box__title">평가를 보냈어요</span>
        <span className="review-box__text">
          서로 '또 만나고 싶어요'를 골랐다면 평가 마감({formatDeadline(closesAt)}) 뒤 친구 '요청' 탭에 나타나요.
        </span>
      </>
    )
  } else {
    body = (
      <>
        <span className="review-box__title">평가가 마감됐어요</span>
        <span className="review-box__text">{formatDeadline(closesAt)}에 마감됐어요. 모임 채팅은 읽기만 할 수 있어요.</span>
      </>
    )
  }

  const cta =
    state === 'open' && !review.submitted ? (
      <Link to={`/meetup/${meetup._id}/review`} className="btn btn--primary btn--lg">
        모임 평가하기
      </Link>
    ) : state === 'before' ? (
      <button type="button" className="btn btn--primary btn--lg" disabled>
        모임 평가하기
      </button>
    ) : review.submitted ? (
      <Link to="/friends/requests" className="btn btn--line btn--lg">
        친구 요청 확인하기
      </Link>
    ) : (
      <Link to="/meetup" className="btn btn--line btn--lg">
        다른 모임 보기
      </Link>
    )

  return (
    <aside className="side-box review-box">
      <div className="side-box__head">
        <span className="side-box__title">{meetup.title}</span>
        <span className="side-box__sub">
          {formatMeetupWhen(talk.startAt)} · {talk.area}
        </span>
      </div>
      <div className="side-box__line" />
      {body}
      {cta}
      <Link to={`/chat/meetup/${meetup._id}`} className="review-box__chat">
        모임 채팅 열기 ›
      </Link>
    </aside>
  )
}
