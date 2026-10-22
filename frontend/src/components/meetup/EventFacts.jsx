import { Link } from 'react-router-dom'
import { categoryText } from '../../data/constants'
import { posterTone } from '../../utils/poster'
import { formatFullDate, formatMonthDay } from '../../utils/format'
import { estimateEndText } from '../../utils/event'

// 모임 만들기 · 수정 왼쪽 '행사에서 가져온 정보' (canChange=false 면 '행사 바꾸기' 숨김)
export default function EventFacts({ event, canChange = true }) {
  const tone = posterTone(event._id)
  const end = estimateEndText(event)
  const rows = [
    ['기간', event.endDate ? `${formatFullDate(event.startDate)} – ${formatMonthDay(event.endDate)}` : `${formatFullDate(event.startDate)} 개봉`],
    ['회차', event.sessionsText],
    ['예상 종료', end],
    ['장소', event.venue],
    ['지역', event.district],
    ['요금', event.priceText],
  ].filter(([, v]) => v)

  return (
    <aside className="facts">
      <div className="facts__box">
        <div className="facts__head">
          <span>행사에서 가져온 정보</span>
          {canChange && (
            <Link to={`/meetup/new?event=${event._id}`} className="facts__change">
              행사 바꾸기
            </Link>
          )}
        </div>
        <div className="facts__event">
          <span className="facts__poster" style={{ background: tone.bg, color: tone.ink }}>
            {event.posterUrl ? <img src={event.posterUrl} alt="" /> : <span>{event.title}</span>}
          </span>
          <span className="facts__name">
            <span>{categoryText(event, { withRunType: true })}</span>
            <strong>{event.title}</strong>
          </span>
        </div>
        <dl className="facts__list">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="facts__note">공공데이터에서 가져온 정보라 입력할 필요도, 고칠 수도 없어요.</p>
    </aside>
  )
}

