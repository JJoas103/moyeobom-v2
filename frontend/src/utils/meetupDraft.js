// 모임 만들기 ② — 행사 정보로 입력칸 기본값 제안
import { addMinutes, ceilTo10 } from './datetime'
import { talkAvailableFrom } from './sessions'

// 러닝타임을 모르는 회차형 — 회차 시각에서 이만큼 뒤를 이야기 자리로 제안한다 (끝나는 시각 어림)
const GUESS_AFTER_SESSION_MIN = 150

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
 * 이야기 자리 시각 기본값 — 회차가 끝난 뒤로 잡는다 (기본값일 뿐 호스트가 자유롭게 바꾼다)
 *  - 회차형 · 상영 + 첫 회차 시각
 *      러닝타임이 있으면 끝나고 10분 뒤, 없으면 회차 2시간 반 뒤 어림 — 그냥 19:00 이면 19:30 공연보다 앞서 버린다
 *  - 그 밖에는 다음 날 19:00 — 전시 · 축제의 시각은 회차가 아니라 운영 시간이다.
 *      그날 운영이 19:00 뒤에 끝나면 끝나는 시각으로 (sessions.talkAvailableFrom)
 */
export function suggestDraft(event) {
  const day = nextDay(event)
  const m = event.runType !== 'period' && firstSessionTime(event)

  if (m) {
    const sessionAt = new Date(day)
    sessionAt.setHours(Number(m[1]), Number(m[2]), 0, 0)
    const after = event.runningTime ? event.runningTime + 10 : GUESS_AFTER_SESSION_MIN
    return { talkStart: ceilTo10(addMinutes(sessionAt, after)) }
  }

  const talkStart = new Date(day)
  talkStart.setHours(19, 0, 0, 0)
  const from = talkAvailableFrom(event, talkStart)
  return { talkStart: from && from > talkStart ? ceilTo10(from) : talkStart }
}
