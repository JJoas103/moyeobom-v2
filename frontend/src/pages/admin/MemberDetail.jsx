import { Link, useParams } from 'react-router-dom'
import Avatar from '../../components/common/Avatar'
import DataState from '../../components/common/DataState'
import MannerBadge from '../../components/common/MannerBadge'
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon } from '../../components/common/Icons'
import { useAsync } from '../../utils/useAsync'
import { formatMonthDay } from '../../utils/format'
import { PROVIDER_LABEL } from '../../data/constants'
import { fetchMember, REPORT_REASON_LABEL, REPORT_STATUS_LABEL } from '../../data/admin'
import '../../styles/admin.css'
import '../../styles/my.css' // 매너 이력 줄(.manner-log · .manner-delta)을 마이페이지와 같은 모양으로

// 회원 상세 — 읽기만. 매너 이력은 본인 화면과 같은 서버 문구를 그대로 보여 준다
export default function MemberDetail() {
  const { id } = useParams()
  const { data, loading, error } = useAsync(() => fetchMember(id), [id])

  return (
    <div className="admin admin--detail">
      <Link to="/admin?tab=members" className="admin-back">
        <ChevronLeftIcon />
        회원 목록
      </Link>

      <DataState loading={loading} error={error}>
        {data && <Body {...data} />}
      </DataState>
    </div>
  )
}

function Body({ member, manner, reports, meetups }) {
  return (
    <>
      <header className="admin-member">
        <Avatar user={member} size={64} />
        <div className="admin-member__info">
          <h1>
            {member.nickname}
            <MannerBadge manner={member.manner} label />
            {member.role === 'admin' && <span className="admin-tag">관리자</span>}
          </h1>
          {/* PROVIDER_LABEL.local 이 이미 '이메일 가입'이다 — 뒤에 '가입'을 또 붙이지 말 것 */}
          <p className="admin-dim">
            {member.email} · {PROVIDER_LABEL[member.provider] || member.provider}
            {member.createdAt && ` · ${formatMonthDay(member.createdAt)}`}
          </p>
        </div>
        <dl className="admin-stats">
          <Stat label="연 모임" value={meetups.hosted} />
          <Stat label="참여한 모임" value={meetups.joined} />
          <Stat label="받은 신고" value={reports.receivedCount} />
        </dl>
      </header>

      <div className="admin-detail__grid">
        <section className="admin-card admin-card--wide" aria-label="매너 점수가 바뀐 기록">
          <h2>
            점수가 바뀐 기록
            <span className="admin-dim">최근 {manner.logs.length}건</span>
          </h2>
          {manner.logs.length === 0 ? (
            <p className="admin-dim">아직 점수가 바뀐 적이 없어요. 50점에서 시작한 그대로예요.</p>
          ) : (
            <>
              <ul className="manner-log">
                {manner.logs.map((row) => (
                  <li key={row._id}>
                    <span className="manner-log__text">
                      {row.meetup ? (
                        <Link to={`/meetup/${row.meetup}`} className="one-line">
                          {row.message}
                        </Link>
                      ) : (
                        <span className="one-line">{row.message}</span>
                      )}
                      {row.scoreChange !== row.requested && (
                        <span className="manner-log__note">
                          {row.requested > 0 ? '최고점이라 더 오르지 않았어요' : '최저점이라 더 깎이지 않았어요'}
                        </span>
                      )}
                    </span>
                    <span className="manner-log__date">{formatMonthDay(row.createdAt)}</span>
                    <Delta change={row.scoreChange} />
                  </li>
                ))}
              </ul>
              {/* 불변식은 점수 = 50 + Σ(전체 이력)이다. 목록이 최근 n건까지라 보이는 줄의 합과
                  현재 점수가 다를 수 있다 — 그래서 '여기까지의 합'이라고 못 박아 적는다.
                  전원에 대한 검사는 npm run manner:check 가 한다 */}
              {manner.logs.length >= manner.logLimit && (
                <p className="admin-note">최근 {manner.logLimit}건까지만</p>
              )}
            </>
          )}
        </section>

        <section className="admin-card" aria-label="받은 신고">
          <h2>
            받은 신고
            {reports.receivedCount > reports.received.length && (
              <span className="admin-dim">{reports.receivedCount}건 중 최근 {reports.received.length}건</span>
            )}
          </h2>
          <ReportList rows={reports.received} empty="받은 신고가 없어요." />
        </section>

        <section className="admin-card" aria-label="한 신고">
          <h2>이 회원이 한 신고</h2>
          <ReportList rows={reports.filed} empty="한 신고가 없어요." />
        </section>
      </div>
    </>
  )
}

function Stat({ label, value }) {
  return (
    <div className="admin-stats__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function ReportList({ rows, empty }) {
  if (!rows.length) return <p className="admin-dim">{empty}</p>
  return (
    <ul className="admin-list">
      {rows.map((r) => (
        <li key={r._id}>
          <Link to={`/admin/reports/${r._id}`} className="one-line">
            {REPORT_REASON_LABEL[r.reason] || '이유 없음'}
          </Link>
          <span className="admin-dim">{formatMonthDay(r.createdAt)}</span>
          <span className={`admin-status admin-status--${r.status}`}>{REPORT_STATUS_LABEL[r.status]}</span>
        </li>
      ))}
    </ul>
  )
}

// 마이페이지의 Delta 와 같은 모양 — 부호 대신 알약 색 + 화살표로 방향을 말한다 (utils/manner.js 주석)
// change 가 0 인 줄은 경계에 걸려 못 움직인 이력이라 화살표를 붙이지 않는다
function Delta({ change }) {
  const size = Math.abs(change)
  const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const read = { up: `${size}점 올랐어요`, down: `${size}점 깎였어요`, flat: '점수가 움직이지 않았어요' }[dir]

  return (
    <span className={`manner-delta manner-delta--${dir}`} aria-label={read}>
      {dir === 'up' && <ArrowUpIcon />}
      {dir === 'down' && <ArrowDownIcon />}
      {size}
    </span>
  )
}
