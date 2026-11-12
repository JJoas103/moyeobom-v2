// 모임 평가 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/reviewService.js getReview 와 같음):
//   review = {
//     meetup: { _id, title, imageUrl, talk: { startAt, area }, capacity,
//               event: { _id, title, posterUrl, category, venue, area } },
//     opensAt, closesAt,                  // 이야기 자리 다음날 12:00 ~ +48시간
//     state: 'before' | 'open' | 'closed',
//     targets: [{ user: { _id, nickname, profileImage }, isHost }],   // 확정 참여자 (나 제외)
//     submitted: { praisedCount, disappointedCount, againCount } | null,
//   }
import { apiGet, apiPost } from '../api'

// 매너 평가 3단계 — 화면과 서버가 쓰는 값. '보통'은 보내지 않는다(대상에서 나머지가 보통)
export const MANNER_GOOD = 'good'
export const MANNER_NORMAL = 'normal'
export const MANNER_LOW = 'low'

export async function fetchReview(meetupId) {
  const { review } = await apiGet(`/api/meetup/${meetupId}/review`)
  return review
}

/**
 * 평가 보내기
 * @param praised      매너가 좋았어요 (1건당 +1)
 * @param disappointed 매너가 아쉬웠어요 (1건당 -1)
 * @param again        또 만나고 싶어요 (비공개 — 서로 골랐을 때만 친구)
 */
export async function submitReview(meetupId, { praised, disappointed, again }) {
  const { result } = await apiPost(`/api/meetup/${meetupId}/review`, { praised, disappointed, again })
  return result // { praisedCount, disappointedCount, againCount }
}

/** { [userId]: 'good'|'normal'|'low' } → 서버가 받는 두 배열. '보통'은 어디에도 안 들어간다 */
export function splitRatings(ratings) {
  const ids = Object.keys(ratings || {})
  return {
    praised: ids.filter((id) => ratings[id] === MANNER_GOOD),
    disappointed: ids.filter((id) => ratings[id] === MANNER_LOW),
  }
}
