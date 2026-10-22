import { posterTone } from '../../utils/poster'
import { formatMonthDay, formatTime, formatWeekday } from '../../utils/format'

// 모임 만들기 · 수정 — 모임 카드 미리보기
export default function CardPreview({ event, imageUrl, startAt }) {
  const tone = posterTone(event._id)
  return (
    <div className="card-preview" style={imageUrl ? undefined : { background: tone.bg }}>
      {imageUrl && <img src={imageUrl} alt="" />}
      {startAt && (
        <span className="card-preview__badge">
          {formatMonthDay(startAt)} {formatWeekday(startAt)} {formatTime(startAt)}
        </span>
      )}
      {!imageUrl && (
        <div className="card-preview__text" style={{ color: tone.ink }}>
          {event.subtitle && <span>{event.subtitle}</span>}
          <strong>{event.title}</strong>
        </div>
      )}
    </div>
  )
}
