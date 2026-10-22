import Poster from '../common/Poster'
import { ExternalIcon } from '../common/Icons'
import { RUN_TYPE_LABEL, categoryText } from '../../data/constants'
import { eventStatus } from '../../utils/status'
import { formatEventPeriod } from '../../utils/format'
import { sourceOf, timeLineOf } from '../../utils/event'

// 행사 상세 상단 — 포스터 · 상태 · 제목 · 추천 이유 · 출처
export default function EventHero({ event }) {
  const status = eventStatus(event)
  const source = sourceOf(event)
  const placeLine = [formatEventPeriod(event), event.venue].filter(Boolean).join(' · ')
  const timeLine = timeLineOf(event)

  return (
    <section className="event-hero">
      <div className="event-hero__poster">
        <Poster
          id={event._id}
          imageUrl={event.posterUrl}
          category={event.category}
          subtitle={event.subtitle}
          title={event.title}
          size="lg"
        />
      </div>

      <div className="event-hero__info">
        <div className="tag-row">
          <span className={`status status--${status.tone}`}>{status.label}</span>
          <span className="tag">{categoryText(event)}</span>
          <span className="tag">{RUN_TYPE_LABEL[event.runType]}</span>
        </div>
        <h1 className="detail__title">{event.title}</h1>
        <div className="event-hero__lines">
          <span>{placeLine}</span>
          {timeLine && <span>{timeLine}</span>}
        </div>

        {event.recommendReasons?.length > 0 && (
          <div className="reason-box">
            <span className="reason-box__label">추천 이유</span>
            {event.recommendReasons.map((r) => (
              <span key={r.label}>
                <strong>{r.label}</strong> {r.text}
              </span>
            ))}
          </div>
        )}

        <div className="event-hero__source">
          <span>행사 정보 출처 · {source.label}</span>
          {source.url && (
            <a href={source.url} target="_blank" rel="noreferrer" className="btn btn--line btn--sm">
              행사 원문 보기 <ExternalIcon />
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
