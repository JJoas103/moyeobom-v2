import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import ErrorMessage from '../../components/ErrorMessage'
import Avatar from '../../components/common/Avatar'
import MiniPoster from '../../components/common/MiniPoster'
import { CheckIcon, ClockIcon, HeartIcon, LockIcon, ThumbUpIcon } from '../../components/common/Icons'
import { useAsync } from '../../utils/useAsync'
import { useNow } from '../../utils/useNow'
import { fetchReview, submitReview } from '../../data/reviews'
import { formatDeadline, formatMonthDay, formatTimeLeft, formatWeekday } from '../../utils/format'
import '../../styles/review.css'

// 시안 · 모임 평가 (review-step1 · step2 · done · closed)
//   ① 칭찬하기(여러 명) → ② 또 만나고 싶어요(비공개, 여러 명) → 평가 보내기 → 완료
//   마감 뒤: 고를 수 없는 화면
export default function MeetupReview() {
  const { id } = useParams()
  const { data: review, loading, error } = useAsync(() => fetchReview(id), [id])

  if (error?.status === 403 || error?.status === 404 || error?.status === 400) {
    return <ErrorMessage title="평가할 수 없는 모임이에요" message={error.message} />
  }

  return (
    <DataState loading={loading} error={error}>
      {review && <ReviewView meetupId={id} review={review} />}
    </DataState>
  )
}

function ReviewView({ meetupId, review }) {
  const now = useNow()
  const [step, setStep] = useState(1)
  const [praised, setPraised] = useState([])
  const [again, setAgain] = useState([])
  const [result, setResult] = useState(review.submitted) // { praisedCount } — 보낸 뒤
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const closed = review.state === 'closed' || (review.state === 'open' && now >= new Date(review.closesAt))

  if (result) return <ReviewDone meetup={review.meetup} praisedCount={result.praisedCount} closesAt={review.closesAt} />
  if (closed) return <ReviewClosed meetupId={meetupId} review={review} />

  const toggle = (setList) => (userId) =>
    setList((list) => (list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId]))

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      setResult(await submitReview(meetupId, { praised, again }))
    } catch (e) {
      setError(e.message)
      setSending(false)
    }
  }

  return (
    <div className="review">
      <ReviewHead meetupId={meetupId} />

      {review.state === 'before' ? (
        <div className="review-banner review-banner--muted">
          <ClockIcon />
          <span>
            평가는 <strong>{formatDeadline(review.opensAt)}</strong>에 열려요.
          </span>
        </div>
      ) : (
        <div className="review-banner">
          <span className="review-banner__icon">
            <ClockIcon size={22} />
          </span>
          <span className="review-banner__left">
            <span>평가 마감까지</span>
            <strong>{formatTimeLeft(review.closesAt, now)}</strong>
          </span>
          <span className="review-banner__at">{formatDeadline(review.closesAt)} 마감</span>
        </div>
      )}

      <MeetupLine meetup={review.meetup} />

      {review.state === 'open' && (
        <>
          <Stepper step={step} />

          {step === 1 ? (
            <section className="review-step">
              <div className="review-step__head">
                <h2>오늘 모임에서 좋았던 사람을 칭찬해 주세요</h2>
                <p>여러 명 고를 수 있어요. 칭찬은 매너 점수에 반영돼요.</p>
              </div>
              <PeopleGrid targets={review.targets} selected={praised} onToggle={toggle(setPraised)} kind="praise" />
            </section>
          ) : (
            <section className="review-step">
              <div className="review-step__head">
                <h2>개인적으로 다시 보고 싶은 사람이 있나요?</h2>
                <p className="review-step__private">
                  <LockIcon size={14} />
                  이 선택은 아무에게도 알려지지 않아요. 서로 골랐을 때만 친구 요청을 보낼 수 있어요.
                </p>
              </div>
              <PeopleGrid targets={review.targets} selected={again} onToggle={toggle(setAgain)} kind="again" />
            </section>
          )}

          <div className="review-bar">
            {step === 1 ? (
              <>
                <span className="review-bar__count">
                  <span className="review-bar__icon">
                    <ThumbUpIcon size={18} />
                  </span>
                  칭찬 <strong>{praised.length}명</strong>
                </span>
                <button type="button" className="btn btn--primary btn--lg review-bar__next" onClick={() => setStep(2)}>
                  다음
                </button>
              </>
            ) : (
              <>
                <span className="review-bar__count">
                  <LockIcon />
                  또 만나고 싶어요 <strong>{again.length}명</strong>
                </span>
                {error && (
                  <span className="form-error" role="alert">
                    {error}
                  </span>
                )}
                <button type="button" className="btn btn--line btn--lg" onClick={() => setStep(1)}>
                  이전
                </button>
                <button type="button" className="btn btn--primary btn--lg review-bar__next" disabled={sending} onClick={send}>
                  {sending ? '보내는 중...' : '평가 보내기'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewHead({ meetupId }) {
  return (
    <>
      <Link to={`/meetup/${meetupId}`} className="review__back">
        ‹ 모임 상세
      </Link>
      <div className="page-head">
        <h1>모임 평가</h1>
      </div>
    </>
  )
}

function MeetupLine({ meetup }) {
  return (
    <div className="review-meetup">
      <MiniPoster meetup={meetup} width={48} height={64} />
      <span className="review-meetup__text">
        <span className="review-meetup__sub">
          {meetup.event?.title ? `${meetup.event.title} · ` : ''}
          {formatMonthDay(meetup.talk.startAt)} {formatWeekday(meetup.talk.startAt)} 이야기 자리
        </span>
        <span className="review-meetup__title">{meetup.title}</span>
      </span>
    </div>
  )
}

function Stepper({ step }) {
  return (
    <div className="stepper">
      <div className="stepper__steps">
        <span className={`stepper__step${step === 1 ? ' is-current' : ''}`}>
          <span className="stepper__num is-on">1</span>칭찬하기
        </span>
        <span className="stepper__line" />
        <span className={`stepper__step${step === 2 ? ' is-current' : ''}`}>
          <span className={`stepper__num${step === 2 ? ' is-on' : ''}`}>2</span>또 만나고 싶어요
        </span>
      </div>
      <span className="stepper__page">{step} / 2</span>
    </div>
  )
}

// 사람 카드 4칸 — kind: praise(그린 · 엄지) / again(진한 글자색 · 하트)
function PeopleGrid({ targets, selected, onToggle, kind }) {
  if (targets.length === 0) return <p className="review-empty">함께한 사람이 없어요. 그대로 다음으로 넘어가도 돼요.</p>
  return (
    <div className="people-grid">
      {targets.map(({ user, isHost }) => {
        const on = selected.includes(user._id)
        return (
          <label key={user._id} className={`person-card person-card--${kind}${on ? ' is-on' : ''}`}>
            <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(user._id)} />
            <span className="person-card__mark">{kind === 'praise' ? <ThumbUpIcon /> : <HeartIcon filled={on} />}</span>
            <Avatar user={user} size={72} />
            <span className="person-card__name">
              {user.nickname}
              {isHost && <span className="host-tag">호스트</span>}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function ReviewDone({ meetup, praisedCount, closesAt }) {
  return (
    <div className="review-done">
      <span className="review-done__check">
        <CheckIcon />
      </span>
      <div className="review-done__head">
        <h1>평가를 보냈어요</h1>
        <span>
          {meetup.title} · {formatMonthDay(meetup.talk.startAt)}
        </span>
      </div>
      <div className="review-done__card">
        <div className="review-done__item">
          <span className="review-done__icon">
            <ThumbUpIcon size={18} />
          </span>
          <span className="review-done__label">칭찬</span>
          <strong className="review-done__num">{praisedCount}명</strong>
        </div>
        <div className="review-done__line" />
        <div className="review-done__item">
          <span className="review-done__icon review-done__icon--muted">
            <LockIcon />
          </span>
          <span className="review-done__label">또 만나고 싶어요</span>
          <strong className="review-done__saved">비공개로 저장됐어요</strong>
          <span className="review-done__note">
            서로 골랐다면 평가 마감({formatDeadline(closesAt)}) 뒤 '요청' 탭에 나타나요
          </span>
        </div>
      </div>
      <div className="review-done__actions">
        <Link to="/friends/requests" className="btn btn--primary">
          친구 요청 확인하기
        </Link>
        <Link to="/meetup" className="btn btn--line">
          다른 모임 보기
        </Link>
      </div>
    </div>
  )
}

function ReviewClosed({ meetupId, review }) {
  return (
    <div className="review">
      <ReviewHead meetupId={meetupId} />
      <MeetupLine meetup={review.meetup} />
      <div className="review-banner review-banner--muted">
        <ClockIcon />
        <span className="review-banner__left review-banner__left--muted">
          <strong>평가가 마감됐어요</strong>
          <span>{formatDeadline(review.closesAt)}</span>
        </span>
      </div>
      <div className="people-grid">
        {review.targets.map(({ user }) => (
          <div key={user._id} className="person-card person-card--closed">
            <Avatar user={user} size={56} />
            <span className="person-card__name">{user.nickname}</span>
          </div>
        ))}
      </div>
      <div className="review-bar">
        <span className="review-bar__count review-bar__count--closed">평가 마감</span>
        <Link to="/meetup" className="btn btn--line btn--lg">
          다른 모임 보기
        </Link>
      </div>
    </div>
  )
}
