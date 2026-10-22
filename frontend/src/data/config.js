// 목업/실제 API 전환 — 도메인마다 따로. 백엔드 API가 붙은 쪽만 false
export const USE_MOCK_EVENTS = false // GET /api/event/* 연결됨
export const USE_MOCK_MEETUPS = false // GET·POST /api/meetup/* 연결됨
export const MOCK_DELAY_MS = 260 // 목업도 살짝 지연 (로딩 상태 확인용)

export function delay(ms = MOCK_DELAY_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
