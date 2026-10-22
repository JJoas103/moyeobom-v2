import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ErrorMessage from '../../components/ErrorMessage'
import { fetchMeetupRoomId } from '../../data/chat'

/** /chat/meetup/:meetupId — 모임 상세 '모임 채팅 열기'. 방 id 를 받아 /chat/:roomId 로 */
export default function MeetupRoomRedirect() {
  const { meetupId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchMeetupRoomId(meetupId)
      .then((roomId) => !cancelled && navigate(`/chat/${roomId}`, { replace: true }))
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [meetupId, navigate])

  if (error) return <ErrorMessage title="모임 채팅에 들어갈 수 없어요" message={error.message} />
  return <div className="state-box">채팅방 여는 중...</div>
}
