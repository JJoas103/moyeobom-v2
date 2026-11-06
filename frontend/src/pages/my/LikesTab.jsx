import { useState } from 'react'
import { Link } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import EventCard from '../../components/event/EventCard'
import MeetupCard from '../../components/meetup/MeetupCard'
import { useLikes } from '../../context/LikesContext'
import { fetchLikes } from '../../data/likes'
import { useAsync } from '../../utils/useAsync'
import '../../styles/list.css'

// 찜 목록 — 행사 · 모임. 하트를 풀어도 다시 찜할 수 있게 다음에 열 때까지 카드는 남겨 둠
export default function LikesTab() {
  const { data, loading, error } = useAsync(() => fetchLikes(), [])
  const { isLiked } = useLikes()
  const [kind, setKind] = useState('event')

  const events = data?.events || []
  const meetups = data?.meetups || []
  const eventCount = events.filter((e) => isLiked('event', e._id)).length
  const meetupCount = meetups.filter((m) => isLiked('meetup', m._id)).length
  const kinds = [
    { key: 'event', label: '행사', count: eventCount },
    { key: 'meetup', label: '모임', count: meetupCount },
  ]

  return (
    <DataState loading={loading && !data} error={error}>
      {data &&
        (events.length === 0 && meetups.length === 0 ? (
          <div className="state-box">
            <strong>아직 찜한 게 없어요</strong>
            마음에 드는 행사와 모임에 하트를 눌러 모아 보세요.
            <div className="my-empty__action">
              <Link to="/event" className="btn btn--line">
                행사 둘러보기
              </Link>
              <Link to="/meetup" className="btn btn--line">
                모임 둘러보기
              </Link>
            </div>
          </div>
        ) : (
          <div className="my-likes">
            <div className="my-likes__chips" role="group" aria-label="찜 종류">
              {kinds.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={`chip${kind === k.key ? ' is-active' : ''}`}
                  aria-pressed={kind === k.key}
                  onClick={() => setKind(k.key)}
                >
                  {k.label} {k.count}
                </button>
              ))}
            </div>

            {kind === 'event' &&
              (events.length > 0 ? (
                <div className="card-grid my-grid">
                  {events.map((e) => (
                    <EventCard key={e._id} event={e} />
                  ))}
                </div>
              ) : (
                <p className="my-likes__empty">찜한 행사가 없어요.</p>
              ))}
            {kind === 'meetup' &&
              (meetups.length > 0 ? (
                <div className="card-grid my-grid">
                  {meetups.map((m) => (
                    <MeetupCard key={m._id} meetup={m} />
                  ))}
                </div>
              ) : (
                <p className="my-likes__empty">찜한 모임이 없어요.</p>
              ))}

            <p className="my-likes__note">끝난 행사도 찜에 남아요. 모임이 취소되면 찜에서 빠져요.</p>
          </div>
        ))}
    </DataState>
  )
}
