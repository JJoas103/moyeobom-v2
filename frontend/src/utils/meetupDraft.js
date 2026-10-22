// 모임 만들기 ② — 행사 정보로 입력칸 기본값 제안
import { addMinutes, ceilTo10 } from './datetime'

const firstSessionTime = (event) => event.sessionsText?.match(/(\d{1,2}):(\d{2})/)

/** 다음에 열리는 날 (오늘이 기간 안이면 내일, 아니면 시작일) */
function nextDay(event, now = new Date()) {
  const start = new Date(event.startDate)
  const day = start > now ? start : new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const end = event.endDate ? new Date(event.endDate) : null
  if (end && day > end && end > now) return end
  return day
}

/** 목록에 보일 동네 — '혜화역 2번 출구 근처 가게' → '혜화역 근처' */
export function guessArea(place = '') {
  const station = place.match(/([가-힣A-Za-z0-9]+역)/)
  if (station) return `${station[1]} 근처`
  return ''
}

/**
 * 기본값 제안
 *  - 회차형 + 러닝타임이 있으면: 관람 회차 = 다음 날 첫 회차, 이야기 자리 = 끝나고 10분 뒤
 *  - 그 밖에는 다음 날 19:00
 */
export function suggestDraft(event) {
  const day = nextDay(event)
  const m = firstSessionTime(event)
  let sessionAt = null
  let talkStart

  if (m) {
    sessionAt = new Date(day)
    sessionAt.setHours(Number(m[1]), Number(m[2]), 0, 0)
  }

  if (sessionAt && event.runningTime) {
    talkStart = ceilTo10(addMinutes(sessionAt, event.runningTime + 10))
  } else {
    talkStart = new Date(day)
    talkStart.setHours(19, 0, 0, 0)
  }

  const meetPlace = {
    film: '상영관 매표소 앞',
    exhibition: '전시관 입구',
    festival: '행사장 입구',
  }[event.category] || '공연장 1층 로비'

  return {
    talkStart,
    sessionAt: sessionAt || addMinutes(talkStart, -150),
    meetPlace,
    suggestedFromSession: Boolean(sessionAt && event.runningTime),
    sessionEnd: sessionAt && event.runningTime ? addMinutes(sessionAt, event.runningTime) : null,
  }
}
