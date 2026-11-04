// 행사 데이터 — 화면은 이 함수들만 사용. USE_MOCK_EVENTS 로 목업/실제 API 전환
//
// 응답 모양 (백엔드 GET /api/event/* 와 같음):
//   event = Event 스키마 필드 + meetupCount(이 행사로 열린 모임 수) + openMeetupCount(지금 모집 중)
//   GET /api/event/recommended → { event | null, reasons, basis: 'taste' | 'popular' }
//   추천 이유(서버) = { type: 'taste' | 'district' | 'history', value } → 화면에는 toReason 으로 { label, text }
//
//   목록은 한 페이지씩 온다 — fetchEvents → { events, total, genres }
//     total  = 조건에 맞는 전체 수 (머리줄 개수 · '더 보기' 가 남았는지 판단)
//     genres = 이 조건에서 나오는 분야 전부 (분야 선택지 — 한 페이지만 보고 만들면 선택지가 빠진다)
//   목록 event 는 카드에 필요한 필드만 온다. description 같은 큰 필드는 상세(fetchEvent)에서만
import { USE_MOCK_EVENTS as USE_MOCK, delay } from './config'
import { apiGet } from '../api'
import mockEvents from './mock/events'
import mockMeetups from './mock/meetups'
import mockRecommendReasons from './mock/recommendReasons'
import { toMeetupResponse } from './meetups'
import { categoryOf } from './constants'
import { dayRange, periodRange, overlaps } from '../utils/period'

function toReason({ type, value }) {
  if (type === 'taste') return { label: '취향', text: categoryOf(value).label }
  if (type === 'district') return { label: '지역', text: value }
  return { label: '이력', text: `${categoryOf(value).label} 모임` }
}
const toReasons = (reasons) => reasons?.map(toReason) ?? null

function withCounts(event) {
  const meetups = mockMeetups.filter((m) => m.event === event._id).map(toMeetupResponse)
  return {
    ...event,
    meetupCount: meetups.length,
    openMeetupCount: meetups.filter((m) => m.status === 'open' && m.approvedCount < m.capacity).length,
  }
}

const isEnded = (e) => e.endDate && new Date(e.endDate) < new Date()

export const PAGE_SIZE = 15 // 목록 한 페이지 (백엔드 eventService LIST_LIMIT 과 같게)

/**
 * 행사 목록 — 한 페이지씩
 * @param {{
 *   category?: string, genre?: string, district?: string,
 *   period?: ''|'today'|'week'|'weekend'|'month',
 *   from?: string, to?: string,   // 'YYYY-MM-DD' — 있으면 period 대신 이 날짜 범위 (달력)
 *   q?: string, hasMeetup?: boolean, includeEnded?: boolean,
 *   sort?: 'meetups'|'endingSoon', page?: number, limit?: number
 * }} params
 * @returns {Promise<{ events, total, genres }>}
 */
export async function fetchEvents(params = {}) {
  if (USE_MOCK) {
    await delay()
    const { category, genre, district, period, from, to, q, hasMeetup, includeEnded, sort = 'endingSoon', page = 1, limit = PAGE_SIZE } = params
    const range = dayRange(from, to) || periodRange(period)
    const keyword = q?.trim()
    const all = mockEvents
      .map(withCounts)
      .filter((e) => includeEnded || !isEnded(e))
      .filter((e) => !category || e.category === category)
      .filter((e) => !district || e.district === district)
      .filter((e) => overlaps(e, range))
      .filter((e) => !keyword || e.title.includes(keyword))
      .filter((e) => !hasMeetup || e.meetupCount > 0)
    // 분야 선택지는 분야를 고르기 전 기준 (서버와 같게)
    const genres = [...new Set(all.map((e) => e.genre).filter(Boolean))].sort()
    const list = all.filter((e) => !genre || e.genre === genre)
    if (sort === 'meetups') list.sort((a, b) => b.meetupCount - a.meetupCount)
    if (sort === 'endingSoon') list.sort((a, b) => new Date(a.endDate || '9999') - new Date(b.endDate || '9999'))
    const start = (Math.max(page, 1) - 1) * limit
    return { events: list.slice(start, start + limit), total: list.length, genres }
  }
  const { events, total, genres } = await apiGet('/api/event/list', { params })
  return { events, total, genres }
}

/**
 * 홈 추천 행사 하나 → { event, reasons: [{ label, text }], basis }
 * basis 'taste' = 취향 · 지역 · 이력 중 맞는 조건이 있음 / 'popular' = 모집 중인 모임 많은 순 → 곧 끝나는 순
 */
export async function fetchRecommendedEvent() {
  if (USE_MOCK) {
    await delay()
    const end = (e) => new Date(e.endDate || '9999').getTime()
    const [event = null] = mockEvents
      .map(withCounts)
      .filter((e) => !isEnded(e))
      .sort((a, b) => b.openMeetupCount - a.openMeetupCount || end(a) - end(b))
    return { event, reasons: [], basis: 'popular' } // 목업엔 로그인 사용자 없음
  }
  const { event, reasons, basis } = await apiGet('/api/event/recommended')
  return { event, reasons: toReasons(reasons), basis }
}

/** 최근 끝난 행사 — 모임 만들기 ①. 허용 기간(유통기한)은 미결정이라 임시 14일 */
export const RECENT_ENDED_DAYS = 14

export async function fetchRecentEndedEvents() {
  if (USE_MOCK) {
    await delay()
    const from = Date.now() - RECENT_ENDED_DAYS * 24 * 60 * 60 * 1000
    return mockEvents
      .filter((e) => isEnded(e) && new Date(e.endDate).getTime() >= from)
      .map(withCounts)
  }
  const { events } = await apiGet('/api/event/recent-ended')
  return events
}

export async function fetchEvent(id) {
  if (USE_MOCK) {
    await delay()
    const event = mockEvents.find((e) => e._id === id)
    if (!event) {
      const error = new Error('행사를 찾을 수 없습니다')
      error.status = 404
      throw error
    }
    // recommendReasons: 로그인 사용자 전용 (없으면 null)
    return { ...withCounts(event), recommendReasons: toReasons(mockRecommendReasons[id]) }
  }
  const { event } = await apiGet(`/api/event/${id}`)
  return { ...event, recommendReasons: toReasons(event.recommendReasons) }
}
