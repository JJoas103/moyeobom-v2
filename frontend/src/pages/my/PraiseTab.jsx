import { useState } from 'react'
import { Link } from 'react-router-dom'
import MiniPoster from '../../components/common/MiniPoster'
import { formatMonthDay, formatWeekday } from '../../utils/format'
import { mannerTone, signed, MANNER_RULES, MANNER_ZERO } from '../../utils/manner'

const DOT_MAX = 8 // 이보다 많으면 점 대신 숫자만

// 받은 매너 평가 · 매너 점수
//
// '아쉬웠어요'는 여기 싣지 않는다 — 과반을 넘겨 점수가 움직였으면 아래 변동 이력에 한 줄 남고,
// 못 넘겼으면 점수도 안 움직였다. 보여 주면 역추적과 상처만 남는다 (services/myPageService.js)
//
// 이 탭의 목적은 "왜 내 점수가 이 숫자지?"를 남기지 않는 것이다. 그래서 셋을 함께 보여준다.
//   ① 점수(한 줄)   ② 규칙 — 오를 때 · 깎일 때   ③ 변동 이력 + 검산
// 검산 줄(50 + 이력 합 = 점수)이 맞지 않으면 서버 불변식이 깨진 것이다 (npm run manner:check)
//
// '일부러 안 움직이는 것'은 ② 안쪽 토글로 접어 둔다 (2026-11-05) — 기본 화면을 가볍게 하되
// "노쇼는 왜 안 깎여?" 에 답할 수단은 남긴다. 지우지 않는 이유는 utils/manner.js 주석 참고.
export default function PraiseTab({ praise, manner }) {
  return (
    <div className="mypage-panel">
      <MannerSum manner={manner} />
      <MannerRules rules={manner.rules} />
      <MannerLog manner={manner} />

      {praise.meetups.length === 0 ? (
        <div className="state-box">
          <strong>아직 받은 매너 평가가 없어요</strong>
          평가가 마감되면 여기에 모여요.
        </div>
      ) : (
        <>
          <div className="praise-sum">
            <span className="praise-sum__big">{praise.total}</span>
            <div className="praise-sum__text">
              <strong>매너가 좋았다는 평가</strong>
              <span>모임 {praise.meetups.length}곳 · 평가를 낸 사람 중</span>
            </div>
            <span className="mypage-tags">
              <span className="mypage-tag">평가 마감된 모임</span>
              <span className="mypage-tag">평가자 비공개</span>
            </span>
          </div>

          <ul className="mypage-list">
            {praise.meetups.map(({ meetup, praisedCount, ratedCount }) => (
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
                    {ratedCount <= DOT_MAX && (
                      <span className="praise-meter__dots" aria-hidden="true">
                        {Array.from({ length: ratedCount }, (_, i) => (
                          <i key={i} className={i < praisedCount ? 'is-on' : ''} />
                        ))}
                      </span>
                    )}
                    <b aria-label={`평가를 낸 ${ratedCount}명 중 ${praisedCount}명이 매너가 좋았다고 했어요`}>
                      {praisedCount}/{ratedCount}명
                    </b>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// 점수 — 큰 숫자 하나 + 라벨 한 줄. 설명 문단은 두지 않는다 (2026-11-05)
//   문단이 3~4줄로 감기면 카드가 높아져서 숫자가 빈 상자 가운데 떠 보인다.
//   '50점에서 시작한다'는 맨 아래 검산 줄(MannerLog)이 이미 말하고 있어 빠지는 정보도 없다.
function MannerSum({ manner }) {
  const { tone, label } = mannerTone(manner.score)

  return (
    <div className={`manner-sum manner-sum--${tone}`}>
      <span className="manner-sum__big">{manner.score}</span>
      <strong className="manner-sum__label">매너 점수 · {label}</strong>
    </div>
  )
}

// 규칙 — 오를 때 · 깎일 때를 짧게. 활동 가점의 조건은 줄마다 반복하지 않고 맨 위 한 문장으로 한 번만
function MannerRules({ rules }) {
  const [open, setOpen] = useState(false)
  const [zeroOpen, setZeroOpen] = useState(false)
  const rows = MANNER_RULES.map((r) => ({ ...r, points: rules?.[r.key] ?? 0 }))
  const up = rows.filter((r) => r.points > 0)
  const down = rows.filter((r) => r.points < 0)

  return (
    <div className="manner-rules">
      <button type="button" className="manner-rules__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        점수가 이렇게 움직여요
        <span>{open ? '접기' : '펼치기'}</span>
      </button>

      {open && (
        <div className="manner-rules__body">
          <p className="manner-rules__note">
            모임을 열거나 참여한 점수는 <b>평가를 보내야</b> 올라가요.
          </p>

          <RuleList title="오를 때" rows={up} />
          <RuleList title="깎일 때" rows={down} />

          <div className="manner-rules__sub">
            <button type="button" className="manner-rules__subtoggle" aria-expanded={zeroOpen} onClick={() => setZeroOpen((v) => !v)}>
              이런 건 점수를 움직이지 않아요
              <span>{zeroOpen ? '접기' : '펼치기'}</span>
            </button>
            {zeroOpen && (
              <ul className="manner-rules__zero">
                {MANNER_ZERO.map(([what, why]) => (
                  <li key={what}>
                    <b>{what}</b>
                    <span>{why}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function RuleList({ title, rows }) {
  if (rows.length === 0) return null
  return (
    <div className="manner-rules__group">
      <h3>{title}</h3>
      <ul className="manner-rules__list">
        {rows.map((r) => (
          <li key={r.key}>
            <b className={r.points < 0 ? 'is-down' : 'is-up'}>{signed(r.points)}</b>
            <span className="manner-rules__what">{r.label}</span>
            <span className="manner-rules__when">{r.when}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// 변동 이력 + 검산 — 이력을 다 더하면 점수가 나온다는 걸 직접 보여준다
function MannerLog({ manner }) {
  const { log, base, logSum, score } = manner
  if (!log?.length) {
    return <p className="manner-log__none">아직 점수가 움직인 일이 없어요. {base}점에서 시작한 그대로예요.</p>
  }

  return (
    <div className="my-section">
      <h2 className="my-section__title">
        점수가 움직인 일<span>최근 {log.length}건</span>
      </h2>
      <ul className="manner-log">
        {log.map((row) => (
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
            <b className={row.scoreChange < 0 ? 'is-down' : 'is-up'}>{signed(row.scoreChange)}</b>
          </li>
        ))}
      </ul>
      <p className="manner-log__check">
        {base}점 {signed(logSum)} = <b>{score}점</b>
        <span>지금까지의 변동을 모두 더한 값이에요</span>
      </p>
    </div>
  )
}
