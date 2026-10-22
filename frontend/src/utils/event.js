// 행사 상세에서 쓰는 계산 — DB에 저장하지 않는 값들
import { RECENT_ENDED_DAYS } from '../data/events'

export const SOURCE_INFO = {
  KOPIS: { label: '공연예술통합전산망', home: 'https://www.kopis.or.kr' },
  KOBIS: { label: '영화관입장권통합전산망', home: 'https://www.kobis.or.kr' },
  SEOUL: { label: '서울시 문화행사 정보', home: 'https://culture.seoul.go.kr' },
}

export function sourceOf(event) {
  const info = SOURCE_INFO[event.source?.name] || { label: event.source?.name, home: '' }
  return { label: info.label, url: event.source?.url || info.home }
}

/** 회차 · 러닝타임 한 줄 — '화–금 19:30 · 150분' (없으면 빈 문자열) */
export const timeLineOf = (event) =>
  [event.sessionsText, event.runningTime && `${event.runningTime}분`].filter(Boolean).join(' · ')

/**
 * 예상 종료 시각 — 회차 문구의 첫 시작 시각 + 러닝타임.
 * '화–금 19:30 · 토·일 14:00' + 150분 → '약 22:00'
 * 계산할 수 없으면 null (전시·축제 같은 기간형, 영화)
 */
export function estimateEndText(event) {
  if (event.runType !== 'session' || !event.runningTime || !event.sessionsText) return null
  const m = event.sessionsText.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  const total = Number(m[1]) * 60 + Number(m[2]) + event.runningTime
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  const firstLabel = event.sessionsText.split('·')[0].replace(m[0], '').trim()
  return `${firstLabel ? firstLabel + ' ' : ''}약 ${hh}:${mm}`
}

/** 이 행사로 지금 모임을 열 수 있는지 — 끝난 지 RECENT_ENDED_DAYS 일까지 허용 (임시값) */
export function canOpenMeetup(event, now = new Date()) {
  if (!event.endDate) return true
  const end = new Date(event.endDate)
  return now.getTime() - end.getTime() <= RECENT_ENDED_DAYS * 24 * 60 * 60 * 1000
}
