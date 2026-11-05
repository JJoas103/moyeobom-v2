import { JOIN_LABEL } from '../../data/constants'
import { posterTone } from '../../utils/poster'
import { profileImageUrl } from '../../utils/user'

/**
 * 모임 상세 '함께하는 사람' — 정원 점 + 보는 사람에 따라
 *   호스트 · 승인된 참여자: 확정 명단 / 그 밖: 안내 문구
 * 신청 승인 · 거절 · 내보내기는 참여자 관리 팝업(MemberManageDialog)에서
 */
export default function MeetupMembers({ meetup, status }) {
  const approved = (meetup.members || []).filter((m) => m.status === 'approved')

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
      {approved.length > 0 ? (
        <MemberList members={approved} />
      ) : meetup.isHost ? (
        <p className="detail-note">아직 확정한 사람이 없어요.</p>
      ) : (
        <p className="detail-note">닉네임은 승인된 참여자끼리만 보여요.</p>
      )}
    </section>
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
