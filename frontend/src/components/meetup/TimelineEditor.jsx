import { CloseIcon } from '../common/Icons'
import { formatTime } from '../../utils/format'
import { TIMELINE_HOURS, TIMELINE_ROWS_MAX, TIMELINE_TITLE_MAX, rowAt } from '../../utils/timeline'

const plusHour = (time) => {
  const [h, m] = time.split(':').map(Number)
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 모임 만들기 ④ — 모임 상세 타임라인을 그 모양 그대로 쓴다
 *   맨 위: 관람 동행(있으면, 고정) → 이야기 자리 시작(③의 시각, 고정) → 호스트가 추가하는 줄 [시각 · 할 일]
 *   rows: [{ time: 'HH:MM', title }] — 저장할 때 rowAt 으로 날짜를 붙인다
 */
export default function TimelineEditor({ talkStart, area, watch, rows, onChange, error }) {
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i) => onChange(rows.filter((_, j) => j !== i))
  const add = () => {
    const last = rows.at(-1)?.time || (talkStart ? formatTime(talkStart) : '19:00')
    onChange([...rows, { time: plusHour(last), title: '' }])
  }

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
          const nextDay = at && talkStart && at.getDate() !== talkStart.getDate()
          return (
            <li key={i} className="tl-edit__row">
              <span className="tl-edit__time">
                <input
                  type="time"
                  className="input tl-edit__time-input"
                  value={r.time}
                  aria-label={`${i + 1}번째 줄 시각`}
                  aria-invalid={(error && !at) || undefined}
                  onChange={(e) => update(i, { time: e.target.value })}
                />
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
