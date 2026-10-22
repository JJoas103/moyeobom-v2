// 행사 데이터 — 화면은 이 함수들만 사용. USE_MOCK_EVENTS 로 목업/실제 API 전환
//
// 응답 모양 (백엔드 GET /api/event/* 와 같음):
//   event = Event 스키마 필드 + meetupCount(이 행사로 열린 모임 수) + openMeetupCount(지금 모집 중)
import { USE_MOCK_EVENTS as USE_MOCK, delay } from './config'
import { apiGet } from '../api'
import mockEvents from './mock/events'
import mockMeetups from './mock/meetups'
import mockRecommendReasons from './mock/recommendReasons'
import { toMeetupResponse } from './meetups'
import { periodRange, overlaps } from '../utils/period'

function withCounts(event) {
  const meetups = mockMeetups.filter((m) => m.event === event._id).map(toMeetupResponse)
  return {
    ...event,
    meetupCount: meetups.length,
    openMeetupCount: meetups.filter((m) => m.status === 'open' && m.approvedCount < m.capacity).length,
  }
}

const isEnded = (e) => e.endDate && new Date(e.endDate) < new Date()

/**
 * 행사 목록
 * @param {{
 *   category?: string, genre?: string, district?: string,
 *   period?: ''|'today'|'week'|'weekend'|'month',
 *   q?: string, hasMeetup?: boolean, includeEnded?: boolean,
 *   sort?: 'meetups'|'endingSoon'
 * }} params
 */
export async function fetchEvents(params = {}) {
  if (USE_MOCK) {
    await delay()
    const { category, genre, district, period, q, hasMeetup, includeEnded, sort = 'meetups' } = params
    const range = periodRange(period)
    const keyword = q?.trim()
    const list = mockEvents
      .map(withCounts)
      .filter((e) => includeEnded || !isEnded(e))
      .filter((e) => !category || e.category === category)
      .filter((e) => !genre || e.genre === genre)
      .filter((e) => !district || e.district === district)
      .filter((e) => overlaps(e, range))
      .filter((e) => !keyword || e.title.includes(keyword))
      .filter((e) => !hasMeetup || e.meetupCount > 0)
    if (sort === 'meetups') list.sort((a, b) => b.meetupCount - a.meetupCount)
    if (sort === 'endingSoon') list.sort((a, b) => new Date(a.endDate || '9999') - new Date(b.endDate || '9999'))
    return list
  }
  const { events } = await apiGet('/api/event/list', { params })
  return events
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
    return { ...withCounts(event), recommendReasons: mockRecommendReasons[id] || null }
  }
  const { event } = await apiGet(`/api/event/${id}`)
  return event
}
