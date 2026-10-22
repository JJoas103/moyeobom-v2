// 기간 필터 — '이번 주' 같은 키 → [시작, 끝] 날짜 범위
// 백엔드 services/eventService.js periodRange 와 같은 규칙 (서울 시간)

export const PERIODS = [
  { key: '', label: '전체 기간' },
  { key: 'today', label: '오늘' },
  { key: 'week', label: '이번 주' },
  { key: 'weekend', label: '이번 주말' },
  { key: 'month', label: '이번 달' },
]

export const periodLabel = (key) => PERIODS.find((p) => p.key === key)?.label || '전체 기간'

const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const endOfDay = (d) => {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** 주는 월요일 시작 · 일요일 끝 */
export function periodRange(key, now = new Date()) {
  const today = startOfDay(now)
  const dow = (today.getDay() + 6) % 7 // 월=0 … 일=6
  switch (key) {
    case 'today':
      return [today, endOfDay(today)]
    case 'week':
      return [today, endOfDay(addDays(today, 6 - dow))]
    case 'weekend': {
      const sat = addDays(today, 5 - dow)
      return [dow === 6 ? today : sat, endOfDay(addDays(today, 6 - dow))]
    }
    case 'month':
      return [today, endOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0))]
    default:
      return null
  }
}

/** 행사 기간이 범위와 겹치는지 (endDate 없으면 계속 진행 중) */
export function overlaps(event, range) {
  if (!range) return true
  const [from, to] = range
  const start = new Date(event.startDate)
  const end = event.endDate ? new Date(event.endDate) : null
  return start <= to && (!end || end >= from)
}
