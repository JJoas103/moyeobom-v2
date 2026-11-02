// 친구 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/friendService.js 와 같음):
//   meetup(작은 요약) = { _id, title, imageUrl, talk: { startAt, area }, capacity,
//                        event: { _id, title, posterUrl, category, venue, area } }
//   friend  = { _id(친구 관계 id), user: { _id, nickname, profileImage }, memo(본인만 보는 메모),
//               roomId(1:1 채팅방), meetup(처음 만난 모임), since }
// 친구는 평가에서 서로 '또 만나고 싶어요'를 고르면 그 자리에서 생긴다 (요청 · 수락 없음).
// 새로 생기면 서버가 'friends:changed' 를 보내므로 목록을 다시 불러오면 된다.
import { apiDelete, apiGet, apiPatch, apiPost } from '../api'

export const MEMO_MAX = 30 // 임시 — 메모 글자 수 (목업 제안값)

/** → { friends } */
export const fetchFriends = () => apiGet('/api/friends')

export async function saveFriendMemo(friendId, memo) {
  const data = await apiPatch(`/api/friends/${friendId}/memo`, { memo })
  return data.memo
}

export const unfriend = (friendId) => apiDelete(`/api/friends/${friendId}`)

export const blockUser = (userId) => apiPost('/api/friends/block', { userId })

/** 내가 차단한 사람 → { blocks: [{ user, blockedAt }] } */
export const fetchBlocks = () => apiGet('/api/friends/blocks')

/** 차단 풀기 — 끊긴 친구는 다시 이어지지 않음 */
export const unblockUser = (userId) => apiDelete(`/api/friends/blocks/${userId}`)
