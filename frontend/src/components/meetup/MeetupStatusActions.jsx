import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setMeetupStatus } from '../../data/meetups'

// 수정 페이지 아래 — 모집 마감 · 다시 열기 · 모임 취소
export default function MeetupStatusActions({ meetup }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const closed = meetup.status === 'closed'

  const change = async (status) => {
    if (status === 'cancelled' && !window.confirm('모임을 취소할까요? 취소하면 되돌릴 수 없고, 목록에서도 빠져요.')) return
    setBusy(status)
    setError(null)
    try {
      await setMeetupStatus(meetup._id, status)
      navigate(`/meetup/${meetup._id}`, { state: { statusChanged: status } })
    } catch (e) {
      setError(e.message)
      setBusy(null)
    }
  }

  return (
    <section className="status-actions" aria-label="모집 상태">
      <div className="status-actions__row">
        <span className="status-actions__text">
          <strong>{closed ? '지금 신청을 받지 않아요' : '지금 신청을 받고 있어요'}</strong>
          <span>{closed ? '다시 열면 신청을 받을 수 있어요.' : '마감하면 새 신청을 받지 않아요. 언제든 다시 열 수 있어요.'}</span>
        </span>
        <button type="button" className="btn btn--line" disabled={Boolean(busy)} onClick={() => change(closed ? 'open' : 'closed')}>
          {busy === 'open' || busy === 'closed' ? '바꾸는 중...' : closed ? '다시 모집하기' : '모집 마감하기'}
        </button>
      </div>
      <div className="status-actions__row">
        <span className="status-actions__text">
          <strong>모임 취소</strong>
          <span>되돌릴 수 없어요. 취소한 모임은 목록에서 빠져요.</span>
        </span>
        <button type="button" className="btn btn--line status-actions__danger" disabled={Boolean(busy)} onClick={() => change('cancelled')}>
          {busy === 'cancelled' ? '취소하는 중...' : '모임 취소하기'}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

