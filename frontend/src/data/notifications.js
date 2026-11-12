// 알림 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/notificationService.js 와 같음):
//   GET  /api/notification?limit=  → { notifications: [{ _id, type, message, link, readAt, createdAt }] }  최근 순
//   GET  /api/notification/unread  → { count }
//   POST /api/notification/read { ids? } → { read }   // ids 가 없으면 전부 읽음
//   DELETE /api/notification          → { cleared }  // 내 알림 전부 지우기
//   DELETE /api/notification/:id      → { removed }  // 한 건 지우기 (내 알림만)
//
//   type: meetup_apply | meetup_approved | meetup_left | meetup_cancelled | meetup_updated
//         review_open | review_closing | friend_matched | manner_down
//   message 는 백엔드 문구 그대로. link 는 저장만 되고 화면에서 쓰지 않는다. readAt null = 안 읽음
//
// 실시간(socket, 내 user 방으로만 옴): 'notify:changed' (목록 · 안 읽은 수 다시 불러오기)
import { apiDelete, apiGet, apiPost } from '../api'

export const fetchNotifications = async (limit) => (await apiGet('/api/notification', { params: { limit } })).notifications

export const fetchUnreadCount = async () => (await apiGet('/api/notification/unread')).count

/** 읽음 — ids 를 안 주면 전부 읽음 */
export const markRead = (ids) => apiPost('/api/notification/read', ids ? { ids } : {})

/** 모두 지우기 — 되돌릴 수 없다. 90일 자동 삭제를 기다리지 않고 직접 치우는 수단 */
export const clearNotifications = async () => (await apiDelete('/api/notification')).cleared

/** 한 건 지우기 */
export const removeNotification = async (id) => (await apiDelete(`/api/notification/${id}`)).removed
