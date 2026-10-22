import SectionHead from '../common/SectionHead'
import EventCard from './EventCard'
import { useAsync } from '../../utils/useAsync'
import { fetchEvents } from '../../data/events'

// 행사 상세 '비슷한 행사' — 같은 분류 3개 (없으면 섹션째 숨김)
export default function SimilarEvents({ event }) {
  const { data } = useAsync(() => fetchEvents({ category: event.category }), [event._id])
  const list = (data || []).filter((e) => e._id !== event._id).slice(0, 3)
  if (data && list.length === 0) return null

  return (
    <section className="detail-section">
      <SectionHead title="비슷한 행사" moreTo={`/event?category=${event.category}`} moreLabel="행사 전체" />
      <div className="card-grid card-grid--3">
        {list.map((e) => (
          <EventCard key={e._id} event={e} />
        ))}
      </div>
    </section>
  )
}
