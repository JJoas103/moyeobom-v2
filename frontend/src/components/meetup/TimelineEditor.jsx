import { CloseIcon } from '../common/Icons'
import { formatTime } from '../../utils/format'
import { TIMELINE_HOURS, TIMELINE_ROWS_MAX, TIMELINE_TITLE_MAX, rowAt } from '../../utils/timeline'

const STEP_MIN = 10

/**
 * 시간 고르기 목록 — 이야기 자리 시작 10분 뒤부터 TIMELINE_HOURS 안, 10분 단위 'HH:MM'
 * (12시간 안이라 같은 'HH:MM' 이 두 번 나오지 않는다. 자정을 넘긴 줄은 옆에 '다음날'이 붙는다)
 * 기본 시간 입력 대신 select — 좁은 칸에서 '오후'만 보이는 문제 때문
 */
function timeOptions(talkStart, current) {
  if (!talkStart) return current ? [current] : []
  const out = []
  const first = new Date(talkStart)
  first.setMinutes(Math.floor(first.getMinutes() / STEP_MIN) * STEP_MIN + STEP_MIN, 0, 0)
  const last = talkStart.getTime() + TIMELINE_HOURS * 60 * 60 * 1000
  for (let t = first.getTime(); t <= last; t += STEP_MIN * 60 * 1000) out.push(formatTime(new Date(t)))
  // 저장된 값이 목록 밖이면(10분 단위가 아님 · 범위 밖) 맨 앞에 남겨 둔다 — 검사가 알려 준다
  if (current && !out.includes(current)) out.unshift(current)
  return out
}

/**
 * 모임 만들기 ④ — 모임 상세 타임라인을 그 모양 그대로 쓴다
 *   맨 위: 관람 동행(있으면, 고정) → 이야기 자리 시작(③의 시각, 고정) → 호스트가 추가하는 줄 [시간 · 할 일]
 *   rows: [{ time: 'HH:MM' | '', title }] — 저장할 때 rowAt 으로 날짜를 붙인다
 */
export default function TimelineEditor({ talkStart, area, watch, rows, onChange, error }) {
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i) => onChange(rows.filter((_, j) => j !== i))
  const add = () => onChange([...rows, { time: '', title: '' }])

  return (
    <div className="tl-edit">
      <ol className="tl-edit__list">
        {watch && (
          <li className="tl-edit__row tl-edit__row--fixed tl-edit__row--watch">
            <span className="tl-edit__time">먼저</span>
            <span className="tl-edit__dot" aria-hidden="true" />
            <span className="tl-edit__card">
              <span className="tl-edit__who">관람부터 함께</span>
              같이 볼 회차는 채팅에서 결정
            </span>
          </li>
        )}
        <li className="tl-edit__row tl-edit__row--fixed">
          <span className="tl-edit__time">{talkStart ? formatTime(talkStart) : '--:--'}</span>
          <span className="tl-edit__dot" aria-hidden="true" />
          <span className="tl-edit__card">
            <span className="tl-edit__who">모두</span>
            이야기 자리 · {area || '동네'}
            <span className="tl-edit__lock">시각은 '언제'에서 변경</span>
          </span>
        </li>
        {rows.map((r, i) => {
          const at = rowAt(talkStart, r.time)
          const nextDay = at && talkStart && at.toDateString() !== talkStart.toDateString()
          return (
            <li key={i} className="tl-edit__row">
              <span className="tl-edit__time">
                <select
                  className={`input tl-edit__time-select${r.time ? '' : ' is-empty'}`}
                  value={r.time}
                  aria-label={`${i + 1}번째 줄 시간`}
                  aria-invalid={(error && !at) || undefined}
                  onChange={(e) => update(i, { time: e.target.value })}
                >
                  <option value="" disabled>
                    시간
                  </option>
                  {timeOptions(talkStart, r.time).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {nextDay && <span className="tl-edit__next">다음날</span>}
              </span>
              <span className="tl-edit__dot" aria-hidden="true" />
              <span className="tl-edit__card tl-edit__card--input">
                <input
                  className="input"
                  value={r.title}
                  maxLength={TIMELINE_TITLE_MAX + 10}
                  placeholder="예: 근처 술집으로 2차"
                  aria-label={`${i + 1}번째 줄 할 일`}
                  aria-invalid={(error && !r.title.trim()) || undefined}
                  onChange={(e) => update(i, { title: e.target.value })}
                />
                <button type="button" className="tl-edit__remove" aria-label={`${i + 1}번째 줄 지우기`} onClick={() => remove(i)}>
                  <CloseIcon size={16} />
                </button>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="tl-edit__foot">
        {rows.length < TIMELINE_ROWS_MAX ? (
          <button type="button" className="btn btn--line" onClick={add}>
            + 줄 추가
          </button>
        ) : (
          <span className="field__hint">{TIMELINE_ROWS_MAX}줄까지</span>
        )}
        <span className="field__hint">선택 · 이야기 자리 시작 뒤 {TIMELINE_HOURS}시간 안</span>
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
