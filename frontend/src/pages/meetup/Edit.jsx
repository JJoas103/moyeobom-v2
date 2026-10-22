import { useParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import ErrorMessage from '../../components/ErrorMessage'
import { useAsync } from '../../utils/useAsync'
import { fetchMeetup } from '../../data/meetups'
import { fetchEvent } from '../../data/events'
import MeetupForm from '../../components/meetup/MeetupForm'
import '../../styles/detail.css'
import '../../styles/create.css'

// 모임 수정 — 모임 만들기 ② 폼을 수정 모드로 (호스트만)
export default function MeetupEdit() {
  const { id } = useParams()
  const { data, loading, error } = useAsync(async () => {
    const meetup = await fetchMeetup(id)
    const event = meetup.event ? await fetchEvent(meetup.event._id) : null // 행사 정보 칸에 쓸 전체 필드
    return { meetup, event }
  }, [id])

  if (error?.status === 404) return <ErrorMessage title="모임을 찾을 수 없어요" message="주소가 바뀌었거나 없는 모임이에요." />
  if (data && !data.meetup.isHost) return <ErrorMessage title="호스트만 수정할 수 있어요" message="내가 연 모임만 수정할 수 있어요." />
  if (data?.meetup.status === 'cancelled') return <ErrorMessage title="취소된 모임이에요" message="취소된 모임은 수정할 수 없어요." />
  if (data && new Date(data.meetup.talk.startAt) <= new Date()) {
    return <ErrorMessage title="이미 시작한 모임이에요" message="시작한 모임은 수정할 수 없어요." />
  }

  return (
    <DataState loading={loading && !data} error={error}>
      {data?.event && <MeetupForm key={data.meetup._id} event={data.event} meetup={data.meetup} />}
    </DataState>
  )
}
