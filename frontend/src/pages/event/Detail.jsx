import { Link, useParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import ErrorMessage from '../../components/ErrorMessage'
import EventHero from '../../components/event/EventHero'
import EventMeetups from '../../components/event/EventMeetups'
import EventInfo from '../../components/event/EventInfo'
import EventPlace from '../../components/event/EventPlace'
import SimilarEvents from '../../components/event/SimilarEvents'
import EventSideBox from '../../components/event/EventSideBox'
import { useAsync } from '../../utils/useAsync'
import { fetchEvent } from '../../data/events'
import { fetchMeetups } from '../../data/meetups'
import { categoryOf } from '../../data/constants'
import '../../styles/detail.css'

// 시안 v2 · 행사 상세 (V2EventDetail)
export default function EventDetail() {
  const { id } = useParams()
  const eventState = useAsync(() => fetchEvent(id), [id])
  const meetupState = useAsync(() => fetchMeetups({ eventId: id }), [id])
  const event = eventState.data

  if (eventState.error?.status === 404) {
    return <ErrorMessage title="행사를 찾을 수 없어요" message="끝났거나 정보가 바뀐 행사일 수 있어요." />
  }

  return (
    <DataState loading={eventState.loading && !event} error={eventState.error}>
      {event && <EventDetailView key={event._id} event={event} meetups={meetupState.data} meetupsLoading={meetupState.loading} />}
    </DataState>
  )
}

function EventDetailView({ event, meetups, meetupsLoading }) {
  const cat = categoryOf(event.category)

  return (
    <div className="detail">
      <nav className="breadcrumb" aria-label="위치">
        <Link to="/event">행사</Link> › <Link to={`/event?category=${event.category}`}>{cat.label}</Link>
        {event.genre && <> › {event.genre}</>}
      </nav>

      <div className="detail__grid">
        <div className="detail__main">
          <EventHero event={event} />
          <EventMeetups event={event} meetups={meetups} loading={meetupsLoading} />
          <EventInfo event={event} />
          <EventPlace event={event} />
          <SimilarEvents event={event} />
        </div>

        <EventSideBox event={event} meetups={meetups} />
      </div>
    </div>
  )
}
