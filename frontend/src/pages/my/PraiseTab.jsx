import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpIcon, ArrowDownIcon } from '../../components/common/Icons'
import { formatMonthDay } from '../../utils/format'
import { mannerTone, mannerBandEdges, MANNER_MAX, MANNER_RULES, MANNER_ZERO } from '../../utils/manner'

// 매너 점수 탭 — ① 점수 + 0~100 매 ② 규칙(오를 때 · 깎일 때, 안쪽에 '일부러 안 움직이는 것') ③ 변동 이력
//   ④ '받은 평가' 모임별 목록이 있었는데 2026-11-18 에 걷어냈다 — 이력 줄이 모임 제목 · 날짜 ·
//   건수 · 링크를 이미 다 말해서 같은 사실이 두 번 나왔다 (잃은 것은 분모 '3명 중 2명' 하나).
//   그 목록은 '좋았어요'만 모아서, 아쉬움만 받은 사람에게는 이력의 '아쉬웠다는 평가를 받았어요'
//   바로 아래 '아직 받은 매너 평가가 없어요' 가 붙는 모순도 있었다.
export default function PraiseTab({ manner }) {
  return (
    <div className="mypage-panel">
      <MannerSum manner={manner} />
      <MannerRules rules={manner.rules} />
      <MannerLog manner={manner} />
    </div>
  )
}

// 점수 — 큰 숫자 + 라벨, 그 아래 0~100 매 (경계 숫자 줄 + 내 단계는 표시점 위 칩)
//   경계는 MANNER_BANDS 에서만. --at(0~1)은 scale 에 한 번 주고 칩 · 표시점이 물려받는다
//   스크린 리더에는 매 전체를 한 문장으로 읽어 준다
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
          {/* 개설 가점(+5) 조건을 한 문장으로 요약하던 안내가 있었는데 2026-11-19 에 뺐다 —
              '반 이상이 아쉬워하면'이 틀렸다. 실제 판정은 mannerService.forfeitsActivity 로
              **2명 이상이면서 절반 초과**이고(평가자 2명 중 1명 · 4명 중 2명은 그대로 붙는다),
              '승인된 참여자 1명 이상'이라는 세 번째 조건은 아예 빠져 있었다.
              정확히 쓰면 표 위에 올 문장으로는 너무 길다 — 틀린 요약보다 없는 편이 낫다.
              조건 전문은 CLAUDE.md '매너 점수' 절에 있다 */}
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

// 변동 이력 — 줄마다 무슨 일로 몇 점. 합계 줄은 두지 않는다 (최근 30건만이라 합이 맞지 않는다)
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

// 한 줄의 변동 — 부호 대신 알약 색 + 화살표
//   0 인 줄(경계에 걸린 이력)은 화살표 없이 중립색 — 이유는 옆 manner-log__note 가 말한다
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
