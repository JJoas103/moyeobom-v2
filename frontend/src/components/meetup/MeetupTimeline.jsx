import { buildTimeline } from '../../utils/timeline'
import { formatTime } from '../../utils/format'

const WHO_LABEL = { watch: '관람부터 함께', event: '행사', all: '모두' }

// 모임 상세 타임라인 — 관람 만남 · 행사(자동) · 모두(호스트 작성) 시간순
export default function MeetupTimeline({ meetup }) {
  const items = buildTimeline(meetup)
  const hasWatch = meetup.watch?.enabled

  return (
    <section className="detail-section">
      <div className="section-head">
        <h2>타임 라인</h2>
        <span className="spacer" />
        {hasWatch && (
          <span className="timeline-legend">
            <span>○ 관람부터 함께만</span>
            <span className="is-all">● 모두</span>
          </span>
        )}
      </div>

      <ol className="timeline">
        {items.map((it, i) => (
          <li key={i} className={`timeline__item timeline__item--${it.who}`}>
            <time className="timeline__time" dateTime={it.at}>
              {formatTime(it.at)}
            </time>
            <span className="timeline__dot" aria-hidden="true" />
            <div className="timeline__card">
              <span className="timeline__who">{WHO_LABEL[it.who]}</span>
              <span className="timeline__title">{it.title}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
