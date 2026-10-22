// 모임 평가 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/reviewService.js getReview 와 같음):
//   review = {
//     meetup: { _id, title, imageUrl, talk: { startAt, area }, capacity,
//               event: { _id, title, posterUrl, category, venue, area } },
//     opensAt, closesAt,                  // 이야기 자리 다음날 12:00 ~ +48시간
//     state: 'before' | 'open' | 'closed',
//     targets: [{ user: { _id, nickname, profileImage }, isHost }],   // 확정 참여자 (나 제외)
//     submitted: { praisedCount, againCount } | null,
//   }
import { apiGet, apiPost } from '../api'

export async function fetchReview(meetupId) {
  const { review } = await apiGet(`/api/meetup/${meetupId}/review`)
  return review
}

/** 평가 보내기 — praised: 칭찬할 사람 _id 들, again: 또 만나고 싶은 사람 _id 들 (비공개) */
export async function submitReview(meetupId, { praised, again }) {
  const { result } = await apiPost(`/api/meetup/${meetupId}/review`, { praised, again })
  return result // { praisedCount, againCount }
}
