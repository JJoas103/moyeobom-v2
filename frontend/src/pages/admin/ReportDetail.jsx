import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import MannerBadge from '../../components/common/MannerBadge'
import { ConfirmDialog } from '../../components/common/Dialog'
import { ChevronLeftIcon } from '../../components/common/Icons'
import { useAsync } from '../../utils/useAsync'
import { formatMeetupWhen, formatMonthDay } from '../../utils/format'
import {
  ADMIN_NOTE_MAX,
  decideAppeal,
  fetchReport,
  resolveReport,
  revertReport,
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
} from '../../data/admin'
import '../../styles/admin.css'

// 신고 한 건 — 증거를 보고 판정한다
//   대기 중 [기각] [제재하기] · 제재 [제재 취소] · 그 밖 버튼 없음
//   점수 변화는 서버 preview 를 그대로 보여 준다 (화면에서 계산하지 않음)

export default function ReportDetail() {
  const { id } = useParams()
  const { data, loading, error } = useAsync(() => fetchReport(id), [id])
  const [saved, setSaved] = useState(null) // 판정 뒤 서버가 돌려준 최신 신고
  const report = saved || data?.report

  return (
    <div className="admin admin--detail">
      <Link to="/admin?tab=reports" className="admin-back">
        <ChevronLeftIcon />
        신고 목록
      </Link>

      <DataState loading={loading} error={error}>
        {report && <Body report={report} onResolved={setSaved} />}
      </DataState>
    </div>
  )
}

function Body({ report, onResolved }) {
  const [asking, setAsking] = useState('') // accept | reject | revert | appealAccept | appealReject
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')

  const close = () => {
    setAsking('')
    setNote('')
    setFailed('')
  }

  const run = async () => {
    setBusy(true)
    setFailed('')
    try {
      const call = {
        accept: () => resolveReport(report._id, 'accept', note),
        reject: () => resolveReport(report._id, 'reject', note),
        revert: () => revertReport(report._id, note),
        appealAccept: () => decideAppeal(report._id, 'accept', note),
        appealReject: () => decideAppeal(report._id, 'reject', note),
      }[asking]
      onResolved((await call()).report)
      close()
    } catch (err) {
      setFailed(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="admin-detail__head">
        <h1>
          {report.target.nickname}님 신고
          <MannerBadge manner={report.target.manner} label />
        </h1>
        <span className={`admin-status admin-status--${report.status}`}>{REPORT_STATUS_LABEL[report.status]}</span>
      </header>

      <div className="admin-detail__grid">
        <section className="admin-card" aria-label="신고 내용">
          <h2>신고 내용</h2>
          <dl className="admin-rows">
            <Row label="이유">{REPORT_REASON_LABEL[report.reason] || '이유 없음'}</Row>
            {report.detail && <Row label="적은 내용">{report.detail}</Row>}
            <Row label="신고한 사람">
              <Who user={report.reporter} />
            </Row>
            <Row label="신고 대상">
              <Who user={report.target} />
              {report.isTargetHost && <span className="admin-tag">호스트</span>}
            </Row>
            <Row label="받은 날">{formatMonthDay(report.createdAt)}</Row>
            <Row label="어디서">{<Where report={report} />}</Row>
          </dl>
        </section>

        <section className="admin-card" aria-label="증거">
          <h2>{report.isMessage ? '신고된 메시지' : '그 대화에서 한 말'}</h2>
          <Evidence report={report} />
        </section>

        <section className="admin-card" aria-label="판단 재료">
          <h2>판단 재료</h2>
          <dl className="admin-rows">
            <Row label="지금 매너 점수">{report.target.manner.score}점</Row>
            <Row label="다른 신고">
              {report.targetReportCount === 0 ? '없음' : `${report.targetReportCount}건`}
              {report.targetAcceptedCount > 0 && <span className="admin-tag admin-tag--warn">제재 {report.targetAcceptedCount}건</span>}
            </Row>
          </dl>
          <p className="admin-note">이유별 차등은 없어요</p>
        </section>

        {report.appeal && (
          <section className="admin-card admin-card--wide" aria-label="이의제기">
            <h2>
              이의제기
              <span className="admin-dim">{formatMonthDay(report.appeal.at)}</span>
            </h2>
            <blockquote className="admin-quote">{report.appeal.text}</blockquote>
            {report.appeal.status !== 'open' && (
              <p className="admin-note">
                {report.appeal.status === 'accepted' ? '무효처리했어요' : '이의를 기각했어요'}
                {report.appeal.reply && ` · ${report.appeal.reply}`}
              </p>
            )}
          </section>
        )}

        {(report.resolvedAt || report.adminNote || report.revertNote) && (
          <section className="admin-card" aria-label="처리 기록">
            <h2>처리 기록</h2>
            <dl className="admin-rows">
              {report.resolvedBy && <Row label="마지막 처리">{report.resolvedBy.nickname}</Row>}
              {report.resolvedAt && <Row label="처리한 날">{formatMonthDay(report.resolvedAt)}</Row>}
              {/* 제재 메모와 취소 메모를 갈라 둔다 — 취소가 제재 사유를 덮어쓰면 "왜 제재했었지" 에 답할 수 없다 */}
              {report.adminNote && <Row label={report.status === 'rejected' ? '기각 메모' : '제재 메모'}>{report.adminNote}</Row>}
              {report.revertNote && <Row label="취소 메모">{report.revertNote}</Row>}
            </dl>
          </section>
        )}
      </div>

      <div className="admin-actions">
        {/* 이의가 들어와 있으면 그 판정이 먼저다 — 제재 취소 버튼보다 앞에 둔다 */}
        {report.appeal?.status === 'open' && (
          <>
            <button type="button" className="btn btn--line" onClick={() => setAsking('appealReject')}>
              이의 기각
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setAsking('appealAccept')}>
              무효처리
            </button>
          </>
        )}
        {report.status === 'pending' && (
          <>
            <button type="button" className="btn btn--line" onClick={() => setAsking('reject')}>
              기각
            </button>
            <button type="button" className="btn btn--danger" onClick={() => setAsking('accept')}>
              제재하기
            </button>
          </>
        )}
        {report.status === 'accepted' && report.appeal?.status !== 'open' && (
          <button type="button" className="btn btn--line" onClick={() => setAsking('revert')}>
            제재 취소
          </button>
        )}
        {CLOSED_NOTE[report.status] && <p className="admin-note">{CLOSED_NOTE[report.status]}</p>}
      </div>

      {asking && (
        <ConfirmDialog
          title={DIALOG[asking].title(report.target.nickname)}
          confirmLabel={DIALOG[asking].confirm}
          danger={asking === 'accept'}
          busy={busy}
          width={420}
          error={failed}
          onConfirm={run}
          onClose={close}
        >
          {/* 점수가 움직이는 판정에만 점수 줄을 띄운다 (기각 · 이의 기각은 변동이 없다) */}
          {SHOWS_SCORE.has(asking) && report.preview && <ScoreMove preview={report.preview} />}
          {DIALOG[asking].body && <p className="dialog__text">{DIALOG[asking].body}</p>}
          {/* 취소 · 무효처리는 제재 사유를 다시 보여 준다 — 무엇을 되돌리는지 보고 적게 */}
          {asking !== 'accept' && asking !== 'reject' && report.adminNote && (
            <p className="admin-note">제재 메모 · {report.adminNote}</p>
          )}
          <label className="dialog-field">
            {ASKS_REPLY.has(asking) ? '답 (당사자에게 보여요)' : '메모 (관리자만 봐요)'}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={ADMIN_NOTE_MAX}
              placeholder={DIALOG[asking].note}
            />
            <span className="dialog-field__count">
              {note.length}/{ADMIN_NOTE_MAX}
            </span>
          </label>
        </ConfirmDialog>
      )}
    </>
  )
}

// 더 누를 것이 없는 신고의 안내 — 기각(변동 없음)과 제재 취소(깎였다 돌아옴)는 말을 가른다
const CLOSED_NOTE = {
  rejected: '기각했어요 · 점수 변동 없음',
  reverted: '제재를 취소했어요 · 깎였던 점수는 돌려줬어요',
  done: '관리자 화면이 없던 때 처리된 건이라 제재인지 기각인지 남아 있지 않아요',
}

// 점수 줄(ScoreMove)을 띄우는 판정 — 변동이 없는 기각 쪽엔 띄우지 않는다
const SHOWS_SCORE = new Set(['accept', 'revert', 'appealAccept'])
// 적는 글이 **당사자에게 보이는** 판정 — 이의 판정의 답은 공개다
const ASKS_REPLY = new Set(['appealAccept', 'appealReject'])

// 팝업 문구 — 짧게. 점수 줄이 이미 숫자를 말하므로 본문에서 되풀이하지 않는다
const DIALOG = {
  accept: {
    title: (name) => `${name}님을 제재할까요?`,
    body: '본인에게 알림이 가요',
    confirm: '제재하기',
    note: '왜 제재하는지',
  },
  reject: {
    title: (name) => `${name}님 신고를 기각할까요?`,
    body: '점수는 그대로예요',
    confirm: '기각하기',
    note: '왜 기각하는지',
  },
  revert: {
    title: (name) => `${name}님 제재를 취소할까요?`,
    body: '깎였던 점수가 돌아와요',
    confirm: '제재 취소하기',
    note: '왜 취소하는지',
  },
  appealAccept: {
    title: (name) => `${name}님 제재를 무효처리할까요?`,
    body: '깎였던 점수가 돌아와요',
    confirm: '무효처리하기',
    note: '왜 무효처리하는지',
  },
  appealReject: {
    title: (name) => `${name}님 이의를 기각할까요?`,
    body: '제재는 그대로예요',
    confirm: '이의 기각하기',
    note: '왜 기각하는지',
  },
}

// 점수 변화 `매너 점수  50점 → 43점` — 부호(-7)는 쓰지 않는다 (오탈자 · '-7점'으로 읽힘)
function ScoreMove({ preview }) {
  const down = preview.scoreAfter < preview.scoreNow
  return (
    <div className={`admin-score-move admin-score-move--${down ? 'down' : 'up'}`}>
      <span className="admin-score-move__label">매너 점수</span>
      <span className="admin-score-move__from">{preview.scoreNow}점</span>
      <span className="admin-score-move__arrow" aria-hidden="true">
        →
      </span>
      <span className="admin-score-move__to">{preview.scoreAfter}점</span>
      {/* 경계에 걸려 규칙보다 덜 움직이는 경우 — 숫자가 안 맞아 보이는 이유를 그 자리에서 말한다 */}
      {preview.applied < preview.requested && (
        <span className="admin-score-move__note">
          {down ? `최저점이라 ${preview.applied}점만 깎여요` : `${preview.applied}점만 돌아와요`}
        </span>
      )}
    </div>
  )
}

/** 탈퇴한 사람은 _id 가 비어 있다 — 링크를 걸면 없는 회원으로 간다 */
function Who({ user }) {
  if (!user._id) return <span className="admin-dim">{user.nickname}</span>
  return <Link to={`/admin/members/${user._id}`}>{user.nickname}</Link>
}

function Row({ label, children }) {
  return (
    <div className="admin-rows__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Where({ report }) {
  if (report.roomGone) return <span className="admin-dim">삭제된 대화</span>
  if (!report.meetup) return <>친구 1:1 대화</>
  return (
    <>
      <Link to={`/meetup/${report.meetup._id}`}>{report.meetup.title}</Link>
      {report.meetup.startAt && <span className="admin-dim">{formatMeetupWhen(report.meetup.startAt)}</span>}
      {report.meetup.status === 'cancelled' && <span className="admin-tag">취소된 모임</span>}
    </>
  )
}

function Evidence({ report }) {
  if (report.evidence) {
    return (
      <>
        <blockquote className="admin-quote">{report.evidence}</blockquote>
        {report.evidenceAt && <p className="admin-dim">{formatMonthDay(report.evidenceAt)}</p>}
        {/* 대화가 지워진 뒤에도 판단할 수 있게 판정 시점에 복사해 둔 것 (models/Report.js evidenceText) */}
        {report.evidenceFromSnapshot && <p className="admin-note">지워진 대화 · 처리할 때 남긴 내용</p>}
      </>
    )
  }
  if (report.recentMessages.length) {
    return (
      <ul className="admin-quotes">
        {report.recentMessages.map((m, i) => (
          <li key={i}>
            <span>{m.text}</span>
            <span className="admin-dim">{formatMonthDay(m.createdAt)}</span>
          </li>
        ))}
      </ul>
    )
  }
  return <p className="admin-dim">남은 대화가 없어요</p>
}
