import { categoryOf, categoryText } from '../../data/constants'
import { posterTone } from '../../utils/poster'
import { eventStatus } from '../../utils/status'
import { formatEventPeriod } from '../../utils/format'

/** 모임 만들기 ① — 라디오로 고르는 행사 한 줄 */
export default function EventPickRow({ event, checked, onChange }) {
  const cat = categoryOf(event.category)
  const tone = posterTone(event._id)
  const ended = eventStatus(event).tone === 'closed'
  const place = event.district || (event.runType === 'screening' ? '상영 중' : '')
  const period = ended ? `~${formatEventPeriod(event).replace('~', '')} 종료` : formatEventPeriod(event)

  return (
    <label className={`pick-row${checked ? ' is-selected' : ''}`}>
      <input type="radio" name="pickEvent" value={event._id} checked={checked} onChange={() => onChange(event)} />
      <span className="pick-row__poster" style={{ background: tone.bg }} aria-hidden="true">
        {event.posterUrl && <img src={event.posterUrl} alt="" />}
      </span>
      <span className="pick-row__body">
        <span className="pick-row__tags">
          <span className="pick-row__cat">
            <span className="cat-dot" style={{ background: cat.color }} />
            {categoryText(event)}
          </span>
          {ended && <span className="pick-row__ended">끝난 행사</span>}
        </span>
        <span className="pick-row__title">{event.title}</span>
        <span className="pick-row__meta">{[period, place].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="pick-row__count">
        {event.meetupCount > 0 ? `이 행사로 열린 모임 ${event.meetupCount}` : '아직 열린 모임 없음'}
      </span>
    </label>
  )
}
