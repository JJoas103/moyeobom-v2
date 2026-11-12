import { useState } from 'react'
import { Link } from 'react-router-dom'
import MiniPoster from '../../components/common/MiniPoster'
import { ArrowUpIcon, ArrowDownIcon } from '../../components/common/Icons'
import { formatMonthDay, formatWeekday } from '../../utils/format'
import { mannerTone, mannerBandEdges, MANNER_MAX, MANNER_RULES, MANNER_ZERO } from '../../utils/manner'

const DOT_MAX = 8 // 이보다 많으면 점 대신 숫자만

// 받은 매너 평가 · 매너 점수
//
// '아쉬웠어요'는 받은 평가 목록에 싣지 않는다 — 1건당 -1 이라 아래 변동 이력에 이미 한 줄 남는다.
// 누가 몇 건이었는지까지 보여 주면 역추적과 상처만 남는다 (services/myPageService.js)
//
// 이 탭의 목적은 "왜 내 점수가 이 숫자지?"를 남기지 않는 것이다. 그래서 셋을 함께 보여준다.
//   ① 점수 + 어느 단계인지 보이는 매   ② 규칙 — 오를 때 · 깎일 때   ③ 변동 이력
// 합계(검산) 줄은 두지 않는다 — 이유는 MannerLog 주석. 불변식은 npm run manner:check 가 본다.
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

// 점수 — 큰 숫자 + 라벨, 그 아래 0~100 매. 설명 문단은 두지 않는다 (2026-11-05)
//   문단이 3~4줄로 감기면 카드가 높아져서 숫자가 빈 상자 가운데 떠 보인다.
//
// 매를 더한 이유 (2026-11-07) — 숫자만으로는 **50 이 어디쯤인지 알 수 없었다.**
//   '보통이에요'라는 말은 있었지만 0~100 중 어느 자리인지, 다음 단계가 얼마나 먼지 안 보였다.
//   칸 경계(40·60·80)는 utils/manner.js 의 MANNER_BANDS 한 곳에서만 온다 — CSS 에 박지 않는다.
//   읽어 주기는 매 전체에 한 문장으로 붙인다 — 표시점과 칸 이름을 하나씩 읽으면 쓸모없이 길다.
//
// 칸 이름 넷을 매 아래 나란히 두지 않는다 (2026-11-08). 칸 폭이 40/20/20/20 이라 이름을 각자
//   칸 가운데에 두면 리듬이 어긋나고 오른쪽 끝('아주 좋아요' + 100)이 빽빽했다. 지금은
//   **경계 숫자만 줄로 두고 내 단계는 표시점 위 칩 하나로** 말한다 — 줄이 하나라 비틀 게 없다.
//   --at(0~1)은 scale 에 한 번만 주고 칩과 표시점이 같이 물려받는다 (custom property 는 상속된다).
function MannerSum({ manner }) {
  const { tone, label, name } = mannerTone(manner.score)
  const edges = mannerBandEdges()
  const at = Math.min(MANNER_MAX, Math.max(0, manner.score))

  return (
    <div className={`manner-sum manner-sum--${tone}`}>
      <div className="manner-sum__head">
        <span className="manner-sum__big">{manner.score}</span>
        <strong className="manner-sum__label">매너 점수 · {label}</strong>
      </div>

      <div
        className="manner-sum__scale"
        role="img"
        aria-label={`${MANNER_MAX}점 중 ${manner.score}점 — ${label}`}
        style={{ '--at': at / MANNER_MAX }}
      >
        <div className="manner-sum__now" aria-hidden="true">
          <span>{name}</span>
        </div>

        <div className="manner-sum__track" aria-hidden="true">
          {edges.slice(1, -1).map((v) => (
            <i key={v} className="manner-sum__edge" style={{ left: `${v}%` }} />
          ))}
          <i className="manner-sum__mark" />
        </div>

        {/* 눈금 숫자는 경계선과 같은 자리에 — 40 이 40 선 바로 아래 선다 */}
        <div className="manner-sum__marks" aria-hidden="true">
          {edges.map((v) => (
            <span key={v} style={{ left: `${v}%` }}>
              {v}
            </span>
          ))}
        </div>
      </div>
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
            모임을 열면 <b>+5</b>가 붙어요. 평가를 보내야 하고, 함께한 분들 <b>반 이상</b>이 매너를 아쉬워하면 인정되지 않아요.
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
            <b className={r.points < 0 ? 'is-down' : 'is-up'}>{Math.abs(r.points)}점</b>
            <span className="manner-rules__what">
              {r.label}
              {r.host && <span className="manner-rules__who">호스트</span>}
            </span>
            <span className="manner-rules__when">{r.when}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// 변동 이력 — 줄마다 무슨 일로 몇 점 움직였는지. 각 줄이 이미 설명이라 합계 줄은 두지 않는다
// (합이 0 이면 '50점 0 = 50점' 이 되어 아무 정보가 없고, 목록은 최근 30건까지만 보여주므로
//  보이는 줄을 더해도 전체 합과 맞지 않았다. 불변식은 npm run manner:check 가 보장한다)
function MannerLog({ manner }) {
  const { log, base } = manner
  if (!log?.length) {
    return <p className="manner-log__none">아직 점수가 바뀐 적이 없어요. {base}점에서 시작한 그대로예요.</p>
  }

  return (
    <div className="my-section">
      <h2 className="my-section__title">
        점수가 바뀐 기록<span>최근 {log.length}건</span>
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
            <Delta change={row.scoreChange} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// 한 줄이 몇 점 움직였는지 — 부호 대신 **알약 색 + 화살표**로 말한다 (2026-11-07 → utils/manner.js 주석)
//
// ⚠ change 가 0 인 줄이 있다 — 0·100 경계에 걸려 요청분만큼 못 움직인 이력이다.
//   화살표를 붙이면 '올랐다'고 거짓말이 되므로 중립색 알약에 0 만 넣는다. 왜 0 인지는
//   바로 옆 manner-log__note('최고점이라 더 오르지 않았어요')가 말한다.
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
