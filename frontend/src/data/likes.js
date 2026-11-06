// 찜 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/likeService.js 와 같음):
//   GET    /api/likes              → { events: [event(data/events.js)], meetups: [meetup(data/meetups.js)] }  최근 찜한 순
//   GET    /api/likes/ids          → { events: [_id], meetups: [_id] }  카드 하트 표시용
//   POST   /api/likes/:type/:id    → 찜하기 (이미 찜했어도 성공)
//   DELETE /api/likes/:type/:id    → 찜 풀기
//   type: 'event' | 'meetup'. 끝난 행사도 남고, 취소된 모임은 빠짐 · 새로 찜할 수 없음
import { apiDelete, apiGet, apiPost } from '../api'

export const fetchLikes = () => apiGet('/api/likes')

export const fetchLikeIds = () => apiGet('/api/likes/ids')

export const addLike = (type, id) => apiPost(`/api/likes/${type}/${id}`)

export const removeLike = (type, id) => apiDelete(`/api/likes/${type}/${id}`)
