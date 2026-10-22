// 채팅 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/chatService.js 와 같음):
//   roomSummary = { _id, type: 'meetup'|'direct', title, meetup(작은 요약 — data/friends.js 참고) | null,
//                   partner: { _id, nickname, profileImage } | null (1:1),
//                   memberCount, lastMessage: { text, at, system, mine } | null,
//                   closed (읽기 전용 — 흐리게), closesAt, unread }
//   room(상세) = roomSummary + { friendshipId(1:1), isHost, canReport, noticeMax, notices: [message],
//                   members: [{ user, isHost, joinType, isMe, blocked }],
//                   reads: [{ user(_id), at }] }   // 내 메시지 옆 숫자 = 아직 안 읽은 사람 수
//   message = { _id, text, sender(_id) | null(시스템 안내), createdAt }
//
// 실시간(socket, 내 user 방으로만 옴): 'chat:message' { roomId, message } · 'chat:read' { roomId, userId, at }
//   · 'chat:notices' { roomId, notices } · 'chat:rooms' (목록 다시 불러오기)
import { apiDelete, apiGet, apiPost } from '../api'

export const MESSAGE_MAX = 500

export async function fetchRooms() {
  const { rooms } = await apiGet('/api/chat/rooms')
  return rooms
}

export async function fetchUnreadCount() {
  const { count } = await apiGet('/api/chat/unread')
  return count
}

/** 모임 상세 '모임 채팅 열기' → 방 _id */
export async function fetchMeetupRoomId(meetupId) {
  const { roomId } = await apiGet(`/api/chat/meetup/${meetupId}`)
  return roomId
}

/** → { room, messages, hasMore } */
export const fetchRoom = (roomId) => apiGet(`/api/chat/rooms/${roomId}`)

/** 더 이전 메시지 → { messages, hasMore } */
export const fetchOlderMessages = (roomId, before) => apiGet(`/api/chat/rooms/${roomId}/messages`, { params: { before } })

export async function sendMessage(roomId, text) {
  const { message } = await apiPost(`/api/chat/rooms/${roomId}/messages`, { text })
  return message
}

export const markRead = (roomId) => apiPost(`/api/chat/rooms/${roomId}/read`)

/** 공지 고정 · 풀기 — 호스트만. → notices */
export async function pinNotice(roomId, messageId) {
  const { notices } = await apiPost(`/api/chat/rooms/${roomId}/notices`, { messageId })
  return notices
}

export async function unpinNotice(roomId, messageId) {
  const { notices } = await apiDelete(`/api/chat/rooms/${roomId}/notices/${messageId}`)
  return notices
}

/** 신고 — 메시지({ messageId }) 또는 참여자({ userId }) */
export const reportInRoom = (roomId, target) => apiPost(`/api/chat/rooms/${roomId}/report`, target)
