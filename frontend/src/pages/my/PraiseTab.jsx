import { Link } from 'react-router-dom'
import MiniPoster from '../../components/common/MiniPoster'
import { formatMonthDay, formatWeekday } from '../../utils/format'

const DOT_MAX = 8 // 이보다 많으면 점 대신 숫자만

// 받은 칭찬 — 평가가 마감된 모임별 '함께한 사람 n명 중 m명이 칭찬'. 누가 칭찬했는지는 보여주지 않음
export default function PraiseTab({ praise }) {
  if (praise.meetups.length === 0) {
    return (
      <div className="state-box">
        <strong>아직 받은 칭찬이 없어요</strong>
        평가가 마감되면 여기에 모여요.
      </div>
    )
  }

  return (
    <div className="mypage-panel">
      <div className="praise-sum">
        <span className="praise-sum__big">{praise.total}</span>
        <div className="praise-sum__text">
          <strong>받은 칭찬</strong>
          <span>모임 {praise.meetups.length}곳</span>
        </div>
        <span className="mypage-tags">
          <span className="mypage-tag">평가 마감된 모임</span>
          <span className="mypage-tag">익명</span>
        </span>
      </div>

      <ul className="mypage-list">
        {praise.meetups.map(({ meetup, praisedCount, othersCount }) => (
          <li key={meetup._id}>
            <Link to={`/meetup/${meetup._id}`} className="mypage-row">
              <MiniPoster meetup={meetup} width={48} height={64} />
              <span className="mypage-row__main">
                <span className="mypage-row__title one-line">{meetup.title}</span>
                <span className="mypage-row__sub one-line">
                  {formatMonthDay(meetup.talk.startAt)} ({formatWeekday(meetup.talk.startAt)})
                  {meetup.event && ` · ${meetup.event.title}`}
                </span>
              </span>
              <span className="praise-meter">
                {othersCount <= DOT_MAX && (
                  <span className="praise-meter__dots" aria-hidden="true">
                    {Array.from({ length: othersCount }, (_, i) => (
                      <i key={i} className={i < praisedCount ? 'is-on' : ''} />
                    ))}
                  </span>
                )}
                <b aria-label={`${othersCount}명 중 ${praisedCount}명 칭찬`}>
                  {praisedCount}/{othersCount}명
                </b>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
