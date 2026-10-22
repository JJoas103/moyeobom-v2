import { useState } from 'react'
import { approveMember } from '../../data/meetups'
import { JOIN_LABEL } from '../../data/constants'
import { posterTone } from '../../utils/poster'
import { formatMeetupWhen } from '../../utils/format'
import { profileImageUrl } from '../../utils/user'

/**
 * 모임 상세 '함께하는 사람' — 정원 점 + 보는 사람에 따라
 *   호스트: 신청자 목록 · 승인 / 승인된 참여자: 서로의 닉네임 / 그 밖: 안내 문구
 * onChange: 승인 뒤 모임 다시 불러오기
 */
export default function MeetupMembers({ meetup, status, onChange }) {
  return (
    <section className="detail-section">
      <div className="section-head">
        <h2>함께하는 사람</h2>
        <span className="spacer" />
        <span className="section-head__right">
          확정 {meetup.approvedCount}/{meetup.capacity}
        </span>
      </div>
      <div className="member-row" aria-label={`확정 ${meetup.approvedCount}명, 남은 자리 ${status.left}개`}>
        {Array.from({ length: meetup.capacity }, (_, i) =>
          i < meetup.approvedCount ? (
            <span key={i} className="member-dot" style={{ background: posterTone(`${meetup._id}${i}`).bg }} />
          ) : (
            <span key={i} className="member-dot member-dot--empty" />
          ),
        )}
      </div>
      {meetup.isHost ? (
        <HostMembers meetup={meetup} onChange={onChange} />
      ) : meetup.members ? (
        <MemberList members={meetup.members} />
      ) : (
        <p className="detail-note">닉네임은 승인된 참여자끼리만 보여요.</p>
      )}
    </section>
  )
}

// 호스트에게만 — 신청자 목록 · 승인
function HostMembers({ meetup, onChange }) {
  const [busy, setBusy] = useState(null) // 승인 중인 사용자 _id
  const [error, setError] = useState(null)
  const members = meetup.members || []
  const pending = members.filter((m) => m.status === 'pending')
  const approved = members.filter((m) => m.status === 'approved')
  const full = meetup.approvedCount >= meetup.capacity

  const approve = async (userId) => {
    setBusy(userId)
    setError(null)
    try {
      await approveMember(meetup._id, userId)
      onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (members.length === 0) return <p className="detail-note">아직 신청한 사람이 없어요. 신청이 오면 여기서 승인해요.</p>

  return (
    <div className="applicants">
      {pending.length > 0 && (
        <>
          <span className="applicants__label">승인 기다리는 신청 {pending.length}</span>
          <ul className="applicants__list">
            {pending.map((m) => (
              <li key={m.user?._id} className="applicant">
                <MemberAvatar user={m.user} />
                <span className="applicant__text">
                  <strong>{m.user?.nickname || '알 수 없음'}</strong>
                  <span>
                    {JOIN_LABEL[m.joinType]} · {formatMeetupWhen(m.appliedAt)} 신청
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn--line btn--sm"
                  disabled={full || busy === m.user?._id}
                  onClick={() => approve(m.user._id)}
                >
                  {busy === m.user?._id ? '승인 중...' : '승인'}
                </button>
              </li>
            ))}
          </ul>
          {full && <p className="detail-note">정원이 다 차서 더 승인할 수 없어요.</p>}
        </>
      )}
      {approved.length > 0 && (
        <>
          <span className="applicants__label">확정 {approved.length}</span>
          <MemberList members={approved} />
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// 확정된 사람 목록 — 닉네임 · 참여 방식
function MemberList({ members }) {
  return (
    <ul className="applicants__list">
      {members.map((m) => (
        <li key={m.user?._id} className="applicant">
          <MemberAvatar user={m.user} />
          <span className="applicant__text">
            <strong>{m.user?.nickname || '알 수 없음'}</strong>
            <span>{JOIN_LABEL[m.joinType]}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function MemberAvatar({ user }) {
  const image = profileImageUrl(user)
  return image ? (
    <img className="avatar" src={image} alt="" />
  ) : (
    <span className="avatar" style={{ background: posterTone(user?._id).bg }} aria-hidden="true" />
  )
}
