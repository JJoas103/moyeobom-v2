import { useParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import ErrorMessage from '../../components/ErrorMessage'
import MeetupForm from '../../components/meetup/MeetupForm'
import { useAsync } from '../../utils/useAsync'
import { fetchEvent } from '../../data/events'
import '../../styles/detail.css' // section-head · side-box 같은 공통 조각
import '../../styles/create.css'

// 시안 v2 · 모임 만들기 ② 모임 정보 (V2CreateMeetup)
export default function CreateInfo() {
  const { eventId } = useParams()
  const { data: event, loading, error } = useAsync(() => fetchEvent(eventId), [eventId])

  if (error?.status === 404) {
    return <ErrorMessage title="행사를 찾을 수 없어요" message="모임 만들기 처음 단계에서 행사를 다시 골라 주세요." />
  }

  return (
    <DataState loading={loading && !event} error={error}>
      {event && <MeetupForm key={event._id} event={event} />}
    </DataState>
  )
}
