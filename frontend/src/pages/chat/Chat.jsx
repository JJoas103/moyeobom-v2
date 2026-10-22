import { useState } from 'react'
import { useParams } from 'react-router-dom'
import RoomList from '../../components/chat/RoomList'
import ChatRoom from '../../components/chat/ChatRoom'
import { ChatIcon } from '../../components/common/Icons'
import { useAsync } from '../../utils/useAsync'
import { useSocketEvent } from '../../context/SocketContext'
import { fetchRooms } from '../../data/chat'
import '../../styles/chat.css'

// 시안 · 채팅 (chat-meetup.html · chat-friend.html) — 방 목록 | 대화 | 모임 정보 · 참여자
export default function Chat() {
  const { roomId } = useParams()
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const { data: rooms, error } = useAsync(() => fetchRooms(), [version])

  // 새 메시지 · 읽음 · 방 변화 → 목록(안 읽은 수 · 마지막 메시지) 다시
  useSocketEvent('chat:message', reload)
  useSocketEvent('chat:rooms', reload)

  return (
    <div className="chat-shell">
      <RoomList rooms={rooms} error={error} currentId={roomId} />
      {roomId ? (
        <ChatRoom key={roomId} roomId={roomId} onRead={reload} />
      ) : (
        <div className="chat-empty">
          <ChatIcon size={28} />
          <strong>채팅방을 골라 주세요</strong>
          <span>모임 채팅은 호스트가 승인한 참여자끼리, 1:1 채팅은 친구끼리 열려요.</span>
        </div>
      )}
    </div>
  )
}
