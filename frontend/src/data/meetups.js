// 모임 데이터 — 화면은 이 함수들만 사용. USE_MOCK_MEETUPS 로 목업/실제 API 전환
//
// 응답 모양 (백엔드 services/meetupService.js serialize 와 같음):
//   meetup = Meetup 스키마 필드
//          + event: { _id, title, subtitle, category, genre, runType, posterUrl, venue, area, district,
//                     location, startDate, endDate, runningTime, sessionsText }
//          + host:  { _id, nickname, profileImage, hostedCount(이 사람이 연 모임 수) }
//          + approvedCount (승인된 참여자 수 — 호스트 제외. capacity 도 호스트 제외)
//          + isHost (보는 사람이 호스트인지) · myMembership: { status, joinType } | null (내 신청)
//          - talk.place · members 는 호스트 · 승인된 참여자 전용
//            members: [{ user: { _id, nickname, profileImage }, joinType, status, appliedAt, approvedAt }]
//            (호스트는 대기 중 신청자까지, 승인된 참여자는 승인된 사람끼리 · 상세에서만)
import { USE_MOCK_MEETUPS as USE_MOCK, delay } from './config'
import { apiGet, apiPatch, apiPost, apiPostForm } from '../api'
import mockMeetups, { mockUsers } from './mock/meetups'
import mockEvents from './mock/events'
import { fetchEvent } from './events'
import { periodRange } from '../utils/period'

// 목업 모임이 실제 API 행사를 참조할 때 — 만들 때 받아 둔 행사 사용
const fetchedEvents = new Map()
const findEvent = (id) => mockEvents.find((e) => e._id === id) || fetchedEvents.get(id)

const EVENT_FIELDS = ['_id', 'title', 'subtitle', 'category', 'genre', 'runType', 'posterUrl', 'venue', 'area', 'district', 'location', 'startDate', 'endDate', 'runningTime', 'sessionsText']

const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k]]))

// 백엔드 serialize 를 목업에서 흉내
export function toMeetupResponse(doc) {
  const event = findEvent(doc.event)
  const host = mockUsers.find((u) => u._id === doc.host)
  const hostedCount = mockMeetups.filter((m) => m.host === doc.host).length
  const { members = [], talk, ...rest } = doc
  return {
    ...rest,
    talk: { startAt: talk.startAt, area: talk.area, startTitle: talk.startTitle },
    event: event ? pick(event, EVENT_FIELDS) : null,
    host: host ? { ...host, hostedCount } : null,
    approvedCount: members.filter((m) => m.status === 'approved').length,
    isHost: false, // 목업엔 로그인 사용자 없음
    myMembership: null,
  }
}

const byStartAt = (a, b) => new Date(a.talk.startAt) - new Date(b.talk.startAt)

/**
 * 모임 목록 — 가까운 날짜순. 이미 시작한 모임은 기본 제외
 * @param {{
 *   eventId?: string, category?: string, district?: string,
 *   period?: ''|'today'|'week'|'weekend'|'month',
 *   joinType?: ''|'watch'|'talk',   // watch = 관람부터 함께 가능 / talk = 이야기 자리만
 *   alcohol?: ''|'yes'|'no', budget?: string,
 *   q?: string, openOnly?: boolean, includePast?: boolean
 * }} params
 */
export async function fetchMeetups(params = {}) {
  if (USE_MOCK) {
    await delay()
    const { eventId, category, district, period, joinType, alcohol, budget, q, openOnly, includePast } = params
    const range = periodRange(period)
    const keyword = q?.trim()
    const now = new Date()
    return mockMeetups
      .map(toMeetupResponse)
      .filter((m) => includePast || new Date(m.talk.startAt) >= now)
      .filter((m) => !eventId || m.event?._id === eventId)
      .filter((m) => !category || m.event?.category === category)
      .filter((m) => !district || m.event?.district === district)
      .filter((m) => !range || (new Date(m.talk.startAt) >= range[0] && new Date(m.talk.startAt) <= range[1]))
      .filter((m) => !joinType || (joinType === 'watch') === Boolean(m.watch?.enabled))
      .filter((m) => !alcohol || (alcohol === 'yes') === m.alcohol)
      .filter((m) => !budget || m.budget === budget)
      .filter((m) => !keyword || m.title.includes(keyword) || m.event?.title.includes(keyword))
      .filter((m) => !openOnly || (m.status === 'open' && m.approvedCount < m.capacity))
      .sort(byStartAt)
  }
  const { meetups } = await apiGet('/api/meetup/list', { params })
  return meetups
}

export async function fetchMeetup(id) {
  if (USE_MOCK) {
    await delay()
    const doc = mockMeetups.find((m) => m._id === id)
    if (!doc) {
      const error = new Error('모임을 찾을 수 없습니다')
      error.status = 404
      throw error
    }
    return toMeetupResponse(doc)
  }
  const { meetup } = await apiGet(`/api/meetup/${id}`)
  return meetup
}

/** 모임 사진 업로드 — 모임 만들기 제출 전에 먼저 올림 → 받은 경로를 body.imageUrl 에 사용 */
export async function uploadMeetupImage(file) {
  if (USE_MOCK) {
    await delay()
    return URL.createObjectURL(file) // 목업은 미리보기 주소 그대로
  }
  const form = new FormData()
  form.append('image', file)
  const { imageUrl } = await apiPostForm('/api/meetup/image', form)
  return imageUrl
}

/** 모임 만들기 ② 제출 — body 는 Meetup 스키마 필드 (event, title, intro, imageUrl, talk, alcohol, budget, capacity, watch) */
export async function createMeetup(body) {
  if (USE_MOCK) {
    await delay()
    if (!findEvent(body.event)) fetchedEvents.set(body.event, await fetchEvent(body.event))
    const doc = {
      ...body,
      _id: Date.now().toString(16).padStart(24, '0'),
      host: mockUsers[0]._id,
      members: [],
      status: 'open',
    }
    mockMeetups.push(doc) // 새로고침하면 사라짐 (목업)
    return toMeetupResponse(doc)
  }
  const { meetup } = await apiPost('/api/meetup', body)
  return meetup
}

/** 모임 수정 — 호스트만. body 는 만들기와 같음 (행사는 못 바꿈) */
export async function updateMeetup(id, body) {
  if (USE_MOCK) {
    await delay()
    throw new Error('목업에서는 수정할 수 없어요')
  }
  const { meetup } = await apiPatch(`/api/meetup/${id}`, body)
  return meetup
}

/** 모집 마감 · 다시 열기 · 모임 취소 — status: 'closed' | 'open' | 'cancelled'. 호스트만 */
export async function setMeetupStatus(id, status) {
  if (USE_MOCK) {
    await delay()
    throw new Error('목업에서는 바꿀 수 없어요')
  }
  const { meetup } = await apiPost(`/api/meetup/${id}/status`, { status })
  return meetup
}

/**
 * 참여 신청 — joinType: 'watch'(관람부터 함께) | 'talk'(이야기 자리만). 로그인 필요
 * 호스트 승인제라 결과는 항상 'pending'
 */
export async function applyMeetup(id, joinType) {
  if (USE_MOCK) {
    await delay()
    const doc = mockMeetups.find((m) => m._id === id)
    if (!doc) throw new Error('모임을 찾을 수 없습니다')
    if (doc.status !== 'open') throw new Error('마감된 모임이에요')
    return { status: 'pending', joinType }
  }
  const { member } = await apiPost(`/api/meetup/${id}/apply`, { joinType })
  return member
}

/** 신청 승인 — 호스트만. 바뀐 모임(상세 응답 모양) 반환 */
export async function approveMember(id, userId) {
  if (USE_MOCK) {
    await delay()
    throw new Error('목업에서는 승인할 수 없어요')
  }
  const { meetup } = await apiPost(`/api/meetup/${id}/members/${userId}/approve`)
  return meetup
}
