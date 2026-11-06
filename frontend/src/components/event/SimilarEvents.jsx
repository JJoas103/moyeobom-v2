import SectionHead from '../common/SectionHead'
import EventCard from './EventCard'
import { useAsync } from '../../utils/useAsync'
import { fetchEvents } from '../../data/events'

// 행사 상세 '비슷한 행사' — 같은 분류 3개 (없으면 섹션째 숨김)
export default function SimilarEvents({ event }) {
  // 보고 있는 행사가 섞여 올 수 있어 한 건 넉넉히 받는다
  const { data } = useAsync(() => fetchEvents({ category: event.category, limit: 4 }), [event._id])
  const list = (data?.events || []).filter((e) => e._id !== event._id).slice(0, 3)
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
