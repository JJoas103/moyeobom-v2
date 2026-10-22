import { Link } from 'react-router-dom'
import { categoryOf, categoryText } from '../../data/constants'
import { posterTone } from '../../utils/poster'
import { formatEventPeriod } from '../../utils/format'
import { estimateEndText } from '../../utils/event'

// 모임 상세 '이 모임의 행사' — 작은 행사 카드
export default function EventMiniCard({ event }) {
  if (!event) return null
  const cat = categoryOf(event.category)
  const tone = posterTone(event._id)
  const end = estimateEndText(event)
  const meta = [formatEventPeriod(event), event.venue, end && `${end} 종료`].filter(Boolean).join(' · ')

  return (
    <Link to={`/event/${event._id}`} className="event-mini">
      <span className="event-mini__poster" style={{ background: tone.bg, color: tone.ink }}>
        {event.posterUrl ? <img src={event.posterUrl} alt="" /> : <span>{event.title}</span>}
      </span>
      <span className="event-mini__body">
        <span className="event-mini__cat">
          <span className="cat-dot" style={{ background: cat.color }} />
          {categoryText(event, { withRunType: true })}
        </span>
        <span className="event-mini__title">{event.title}</span>
        <span className="event-mini__meta">{meta}</span>
      </span>
      <span className="event-mini__more">행사 보기 ›</span>
    </Link>
  )
}
