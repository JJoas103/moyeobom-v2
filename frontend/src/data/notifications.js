// 알림 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/notificationService.js 와 같음):
//   GET  /api/notification?limit=  → { notifications: [{ _id, type, message, link, readAt, createdAt }] }  최근 순
//   GET  /api/notification/unread  → { count }
//   POST /api/notification/read { ids? } → { read }   // ids 가 없으면 전부 읽음
//
//   type: meetup_apply | meetup_approved | meetup_left | meetup_cancelled | meetup_updated
//         review_open | review_closing | friend_matched | manner_down
//   message 는 백엔드가 만든 문구를 그대로 보여준다 (화면마다 말투가 갈리지 않게)
//   link 를 누르면 그 화면으로 이동. readAt 이 null 이면 안 읽음
//
// 실시간(socket, 내 user 방으로만 옴): 'notify:changed' (목록 · 안 읽은 수 다시 불러오기)
//
// 알림이 오지 않는 것 (결정 사항 — CLAUDE.md)
//   · 채팅 새 메시지 — 헤더에 안 읽은 수 점이 이미 따로 있다
//   · 매너 점수가 오를 때 — 깎일 때만 알린다 (오른 건 마이페이지 이력에서 확인)
//   · 차단 · 친구 끊기 · 평가 제출
import { apiGet, apiPost } from '../api'

export const fetchNotifications = async (limit) => (await apiGet('/api/notification', { params: { limit } })).notifications

export const fetchUnreadCount = async () => (await apiGet('/api/notification/unread')).count

/** 읽음 — ids 를 안 주면 전부 읽음 */
export const markRead = (ids) => apiPost('/api/notification/read', ids ? { ids } : {})
