// 친구 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/friendService.js 와 같음):
//   meetup(작은 요약) = { _id, title, imageUrl, talk: { startAt, area }, capacity,
//                        event: { _id, title, posterUrl, category, venue, area } }
//   friend  = { _id(친구 관계 id), user: { _id, nickname, profileImage }, memo(본인만 보는 메모),
//               roomId(1:1 채팅방), meetup(처음 만난 모임), since }
//   request = { _id(요청 자리 id), user, meetup(만난 모임), expiresAt, expired }
//     received(받은 요청 — 수락만) · available(요청 가능) · sent(보낸 요청 — 대기 / 만료)
//     기한: 평가 마감 + 7일. '요청 가능'과 '보낸 요청'이 같은 때 만료. 만료 뒤엔 다시 요청할 수 없음
import { apiDelete, apiGet, apiPatch, apiPost } from '../api'

export const MEMO_MAX = 30 // 임시 — 메모 글자 수 (목업 제안값)

/** → { friends, receivedCount } */
export const fetchFriends = () => apiGet('/api/friends')

/** → { received, available, sent, friendCount } */
export const fetchFriendRequests = () => apiGet('/api/friends/requests')

/** 친구 요청 보내기 = 받은 요청 수락. → 'requested' | 'friends' */
export async function sendFriendRequest(linkId) {
  const { status } = await apiPost(`/api/friends/links/${linkId}/request`)
  return status
}

/** 모두 요청 보내기 · 모두 수락 → { requested, friends, failed } */
export async function sendFriendRequests(linkIds) {
  const { result } = await apiPost('/api/friends/links/request', { ids: linkIds })
  return result
}

export async function saveFriendMemo(friendId, memo) {
  const data = await apiPatch(`/api/friends/${friendId}/memo`, { memo })
  return data.memo
}

export const unfriend = (friendId) => apiDelete(`/api/friends/${friendId}`)

export const blockUser = (userId) => apiPost('/api/friends/block', { userId })
