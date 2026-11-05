import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../common/Avatar'
import Dialog, { ConfirmDialog } from '../common/Dialog'
import { CloseIcon } from '../common/Icons'
import MetaLine from '../common/MetaLine'
import MannerBadge from '../common/MannerBadge'
import MoreMenu from '../common/MoreMenu'
import ReportDialog from '../common/ReportDialog'
import { approveMember, rejectMember, removeMember, reportMember } from '../../data/meetups'
import { JOIN_LABEL } from '../../data/constants'
import { formatMeetupWhen } from '../../utils/format'
import { EMPTY_REPORT } from '../../utils/report'

const CAPACITY_MAX = 10 // models/Meetup.js capacity max

// 거절 · 내보내기 확인 팝업 문구
const CONFIRM = {
  reject: {
    title: (name) => `${name}님 신청을 거절할까요?`,
    text: '따로 알리지 않고, 다시 신청할 수는 있어요.',
    label: '거절',
    run: rejectMember,
    done: (name) => `${name}님 신청을 거절했어요.`,
  },
  remove: {
    title: (name) => `${name}님을 내보낼까요?`,
    text: '모임 채팅에서도 나가요. 따로 알리지 않고, 다시 신청할 수는 있어요.',
    label: '내보내기',
    run: removeMember,
    done: (name) => `${name}님을 내보냈어요. 자리가 하나 비었어요.`,
  },
}

/**
 * 모임 상세 '참여자 관리' 팝업 — 호스트 전용, 이야기 자리 시작 전까지
 *   신청 탭: 승인 · 거절 / 확정 탭: ⋯ 메뉴 내보내기 · 신고
 * onChange: 처리 뒤 모임 상세 다시 불러오기
 */
export default function MemberManageDialog({ meetup: initial, onChange, onClose }) {
  const [meetup, setMeetup] = useState(initial) // 처리 응답으로 바로 갱신
  const members = meetup.members || []
  const pending = members.filter((m) => m.status === 'pending')
  const approved = members.filter((m) => m.status === 'approved')
  const left = meetup.capacity - approved.length
  const full = left <= 0

  const [tab, setTab] = useState(pending.length === 0 && approved.length > 0 ? 'approved' : 'pending')
  const [busy, setBusy] = useState(null) // 처리 중인 사용자 _id
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [confirm, setConfirm] = useState(null) // { kind: 'reject' | 'remove', user }
  const [report, setReport] = useState(null) // { user, value: { reason, detail } }

  const nameOf = (user) => user?.nickname || '알 수 없음'

  const run = async (action, userId, doneMessage) => {
    setBusy(userId)
    setError(null)
    setNotice(null)
    try {
      setMeetup(await action(meetup._id, userId))
      setNotice(doneMessage)
      setConfirm(null)
      onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const changeTab = (next) => {
    setTab(next)
    setNotice(null)
    setError(null)
  }

  const closeConfirm = () => {
    setConfirm(null)
    setError(null)
  }

  const askConfirm = (kind, user) => {
    setError(null)
    setConfirm({ kind, user })
  }

  const closeReport = () => {
    setReport(null)
    setError(null)
  }

  const submitReport = async () => {
    setBusy(report.user._id)
    setError(null)
    setNotice(null)
    try {
      await reportMember(meetup._id, report.user._id, report.value)
      setNotice(`${nameOf(report.user)}님을 신고했어요. 상대에게는 알리지 않아요.`)
      setReport(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const confirmText = confirm && CONFIRM[confirm.kind]

  return (
    <>
      <Dialog label="참여자 관리" onClose={onClose} width={640} className="manage">
        <div className="manage__head">
          <span className="manage__title-box">
            <span className="manage__title">참여자 관리</span>
            <span className="manage__sub">
              <MetaLine items={[meetup.title, formatMeetupWhen(meetup.talk.startAt)]} />
            </span>
          </span>
          <button type="button" className="manage__close" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="manage__capacity">
          <strong>
            확정 {approved.length}/{meetup.capacity}
          </strong>
          <span className="manage__dots" aria-hidden="true">
            {approved.map((m) => (
              <Avatar key={m.user?._id} user={m.user} size={16} />
            ))}
            {Array.from({ length: Math.max(left, 0) }, (_, i) => (
              <span key={i} className="manage__dot-empty" />
            ))}
          </span>
          <span className="spacer" />
          <span className={`manage__left${full ? ' is-full' : ''}`}>{full ? '자리가 다 찼어요' : `${left}자리 남았어요`}</span>
          <span className="manage__note">호스트 제외</span>
        </div>

        <div className="manage__tabs" role="tablist" aria-label="참여자 구분">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pending'}
            className={`manage__tab${tab === 'pending' ? ' is-active' : ''}`}
            onClick={() => changeTab('pending')}
          >
            신청 {pending.length}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'approved'}
            className={`manage__tab${tab === 'approved' ? ' is-active' : ''}`}
            onClick={() => changeTab('approved')}
          >
            확정 {approved.length}
          </button>
        </div>

        <div className="manage__body" role="tabpanel">
          {notice && (
            <p className="manage__notice" role="status">
              {notice}
            </p>
          )}
          {error && !confirm && !report && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          {tab === 'pending' ? (
            <>
              {full && pending.length > 0 && (
                <p className="manage__full">
                  <strong>자리가 다 찼어요.</strong>
                  {meetup.capacity < CAPACITY_MAX && (
                    <>
                      {' '}
                      더 승인하려면 <Link to={`/meetup/${meetup._id}/edit`}>정원을 늘려</Link> 주세요.
                    </>
                  )}
                </p>
              )}
              {pending.length === 0 ? (
                <p className="manage__empty">
                  기다리는 신청이 없어요.
                  <br />
                  새 신청이 오면 여기서 승인해요.
                </p>
              ) : (
                <ul className="applicants__list">
                  {pending.map((m) => (
                    <li key={m.user?._id} className="applicant">
                      <PersonText member={m} />
                      <button
                        type="button"
                        className="manage__reject"
                        disabled={Boolean(busy)}
                        onClick={() => askConfirm('reject', m.user)}
                      >
                        거절
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        disabled={full || Boolean(busy)}
                        onClick={() => run(approveMember, m.user._id, `${nameOf(m.user)}님을 승인했어요. 모임 채팅에 들어왔어요.`)}
                      >
                        {busy === m.user?._id ? '승인 중…' : '승인'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : approved.length === 0 ? (
            <p className="manage__empty">
              아직 확정한 사람이 없어요.
              <br />
              신청 탭에서 승인해 주세요.
            </p>
          ) : (
            <>
              {meetup.watch?.enabled && (
                <p className="manage__summary">
                  <MetaLine
                    items={[
                      `${JOIN_LABEL.watch} ${approved.filter((m) => m.joinType === 'watch').length}명`,
                      `${JOIN_LABEL.talk} ${approved.filter((m) => m.joinType === 'talk').length}명`,
                    ]}
                  />
                </p>
              )}
              <ul className="applicants__list">
                {approved.map((m) => (
                  <li key={m.user?._id} className="applicant">
                    <PersonText member={m} />
                    <MoreMenu
                      label={`${nameOf(m.user)}님 메뉴`}
                      size={44}
                      items={[
                        { label: '내보내기', onSelect: () => askConfirm('remove', m.user) },
                        { label: '신고하기', danger: true, onSelect: () => setReport({ user: m.user, value: EMPTY_REPORT }) },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Dialog>

      {confirm && (
        <ConfirmDialog
          title={confirmText.title(nameOf(confirm.user))}
          confirmLabel={confirmText.label}
          danger
          busy={Boolean(busy)}
          error={error}
          onConfirm={() => run(confirmText.run, confirm.user._id, confirmText.done(nameOf(confirm.user)))}
          onClose={closeConfirm}
        >
          <p className="dialog__text">{confirmText.text}</p>
        </ConfirmDialog>
      )}

      {report && (
        <ReportDialog
          title={`${nameOf(report.user)}님을 신고할까요?`}
          value={report.value}
          onChange={(value) => setReport({ ...report, value })}
          busy={Boolean(busy)}
          error={error}
          onConfirm={submitReport}
          onClose={closeReport}
        >
          <p className="dialog__text">신고한 사실은 상대에게 알리지 않아요.</p>
        </ReportDialog>
      )}
    </>
  )
}

// 사람 한 줄 — 닉네임 · 참여 방식 · 매너 점수
// 점수는 호스트가 승인을 판단하는 자리라 띄운다. 평가 화면에는 띄우지 않는다 (CLAUDE.md)
function PersonText({ member }) {
  return (
    <>
      <Avatar user={member.user} size={40} />
      <span className="applicant__text">
        <span className="manage__name">
          <strong>{member.user?.nickname || '알 수 없음'}</strong>
          <span className={`manage__join manage__join--${member.joinType}`}>{JOIN_LABEL[member.joinType]}</span>
        </span>
        <span className="manage__manner">
          매너 점수 <MannerBadge manner={member.user?.manner} label />
        </span>
      </span>
    </>
  )
}
