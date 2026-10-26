import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShareIcon } from '../common/Icons'
import ReviewBox from './ReviewBox'
import { ConfirmDialog } from '../common/Dialog'
import { useAuth } from '../../context/AuthContext'
import { applyMeetup, leaveMeetup } from '../../data/meetups'
import { JOIN_LABEL } from '../../data/constants'
import { formatMeetupWhen, formatTime } from '../../utils/format'

/**
 * 모임 상세 오른쪽 신청 박스 — 보는 사람에 따라
 *   비로그인 · 신청 전: 참여 방식 고르기 + 신청 / 대기 · 확정: 내 신청 상태 / 호스트: 수정 · 마감 링크
 * onChange: 신청 뒤 모임 다시 불러오기 (myMembership 반영)
 * 이야기 자리가 시작된 뒤 확정 참여자(호스트 포함)에게는 평가 박스(ReviewBox)
 */
export default function ApplyBox({ meetup, status, onChange }) {
  const confirmed = meetup.isHost || meetup.myMembership?.status === 'approved'
  if (confirmed && meetup.status !== 'cancelled' && new Date(meetup.talk.startAt) <= new Date()) {
    return <ReviewBox meetup={meetup} />
  }
  return <ApplyForm meetup={meetup} status={status} onChange={onChange} confirmed={confirmed} />
}

function ApplyForm({ meetup, status, onChange, confirmed }) {
  const { talk, watch } = meetup
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const closed = status.tone === 'closed'
  const started = new Date(talk.startAt) <= new Date()
  const watchOpen = watch?.enabled && (!watch.sessionAt || new Date(watch.sessionAt) > new Date())
  const options = [
    watchOpen && {
      value: 'watch',
      title: JOIN_LABEL.watch,
      desc: `${formatTime(watch.meetAt || watch.sessionAt)} ${watch.meetPlace || '행사장 앞'}에서 만나 같이 보고, 끝나면 이야기 자리로`,
      note: '티켓은 각자 예매',
    },
    {
      value: 'talk',
      title: JOIN_LABEL.talk,
      desc: `${formatTime(talk.startAt)} ${talk.area}에서 합류해요. 이미 봤거나 따로 봐도 괜찮아요`,
    },
  ].filter(Boolean)

  const [joinType, setJoinType] = useState(options[0].value)
  const [state, setState] = useState({ sending: false, error: null })
  const [shared, setShared] = useState(false)

  const submit = async () => {
    if (!user) {
      navigate('/member/login', { state: { from: location.pathname } })
      return
    }
    setState({ sending: true, error: null })
    try {
      await applyMeetup(meetup._id, joinType)
      setState({ sending: false, error: null })
      onChange() // myMembership 포함된 모임 다시 불러오기
    } catch (e) {
      setState({ sending: false, error: e.message })
    }
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShared(true)
      setTimeout(() => setShared(false), 1500)
    } catch {
      setShared(false)
    }
  }

  const mine = meetup.myMembership
  const pendingCount = meetup.isHost ? (meetup.members || []).filter((m) => m.status === 'pending').length : 0

  // 신청 박스 본문 — 보는 사람에 따라
  let body
  if (meetup.isHost) {
    body = (
      <div className="apply-done" role="status">
        <strong>내가 연 모임이에요</strong>
        <span>
          {meetup.status === 'closed' ? '모집을 마감했어요. ' : ''}
          {pendingCount > 0 ? `승인을 기다리는 신청이 ${pendingCount}개 있어요. ` : ''}확정 {meetup.approvedCount}/{meetup.capacity}명
        </span>
      </div>
    )
  } else if (mine?.status === 'approved') {
    body = (
      <div className="apply-done" role="status">
        <strong>참여가 확정됐어요</strong>
        <span>
          {JOIN_LABEL[mine.joinType]} · {talk.place}
        </span>
      </div>
    )
  } else if (mine?.status === 'pending') {
    body = (
      <div className="apply-done apply-done--wait" role="status">
        <strong>승인을 기다리고 있어요</strong>
        <span>{JOIN_LABEL[mine.joinType]}으로 신청했어요. 호스트가 승인하면 정확한 장소가 열려요.</span>
      </div>
    )
  } else {
    body = (
      <>
        <div className="apply-head">
          <span>어떻게 참여할까요?</span>
          <span className={`status status--${status.tone}`}>{status.label}</span>
        </div>

        <fieldset className="join-options" disabled={closed || started}>
          <legend className="sr-only">참여 방식</legend>
          {options.map((o) => (
            <label key={o.value} className={`join-option${joinType === o.value ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="joinType"
                value={o.value}
                checked={joinType === o.value}
                onChange={() => setJoinType(o.value)}
              />
              <span className="join-option__text">
                <span className="join-option__title">{o.title}</span>
                <span className="join-option__desc">{o.desc}</span>
                {o.note && <span className="join-option__note">{o.note}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      </>
    )
  }

  const canApply = !meetup.isHost && !mine
  const buttonLabel = closed
    ? meetup.status === 'cancelled'
      ? '취소된 모임이에요'
      : '마감된 모임이에요'
    : started
      ? '이미 시작한 모임이에요'
      : state.sending
        ? '신청 중...'
        : user
          ? '참여 신청하기'
          : '로그인하고 신청하기'

  return (
    <aside className="side-box">
      <div className="side-box__head">
        <span className="side-box__title">{meetup.title}</span>
        <span className="side-box__sub">
          {formatMeetupWhen(talk.startAt)} · {talk.area}
        </span>
      </div>
      <div className="side-box__line" />

      {body}

      <div className="side-box__actions">
        <button type="button" className="square-btn" aria-label={shared ? '주소를 복사했어요' : '공유하기 (주소 복사)'} onClick={share}>
          {shared ? <span className="square-btn__done">복사됨</span> : <ShareIcon />}
        </button>
        {canApply ? (
          <button
            type="button"
            className="btn btn--primary btn--lg side-box__cta"
            disabled={closed || started || state.sending}
            onClick={submit}
          >
            {buttonLabel}
          </button>
        ) : meetup.isHost && meetup.status !== 'cancelled' && !started ? (
          <Link to={`/meetup/${meetup._id}/edit`} className="btn btn--line btn--lg side-box__cta">
            모임 수정 · 마감
          </Link>
        ) : (
          <Link to="/meetup" className="btn btn--line btn--lg side-box__cta">
            다른 모임 보기
          </Link>
        )}
      </div>

      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {mine && !started && meetup.status !== 'cancelled' && <LeaveButton meetup={meetup} approved={mine.status === 'approved'} />}
      {confirmed && meetup.status !== 'cancelled' ? (
        <Link to={`/chat/meetup/${meetup._id}`} className="review-box__chat">
          모임 채팅 열기 ›
        </Link>
      ) : (
        <p className="side-box__note">호스트가 승인하면 참여가 확정돼요. 승인되면 정확한 장소와 모임 채팅이 열려요.</p>
      )}
    </aside>
  )
}

// 참여 취소 — 신청 중이면 '신청 취소', 확정이면 '참여 취소'(모임 채팅에서도 나감). 다시 신청할 수 있음
//   취소하면 모임 목록(/meetup)으로 이동
function LeaveButton({ meetup, approved }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = approved ? '참여 취소' : '신청 취소'

  const close = () => {
    setOpen(false)
    setError('')
  }

  const onConfirm = async () => {
    setBusy(true)
    try {
      await leaveMeetup(meetup._id)
      navigate('/meetup', { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="side-box__leave" onClick={() => setOpen(true)}>
        {label}하기
      </button>
      {open && (
        <ConfirmDialog
          title={approved ? '모임 참여를 취소할까요?' : '참여 신청을 취소할까요?'}
          confirmLabel={label}
          danger
          busy={busy}
          error={error}
          onConfirm={onConfirm}
          onClose={close}
        >
          <p className="dialog__text">{approved ? '모임 채팅에서도 나가요. 자리가 남아 있으면 다시 신청할 수 있어요.' : '자리가 남아 있으면 다시 신청할 수 있어요.'}</p>
        </ConfirmDialog>
      )}
    </>
  )
}
