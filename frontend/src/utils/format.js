// 날짜·시간 표시 — EJS 때 res.locals 에 있던 포맷 함수들은 전부 여기로.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n) => String(n).padStart(2, '0')

const toDate = (v) => (v instanceof Date ? v : new Date(v))

/** '09.30' */
export const formatMonthDay = (v) => {
  const d = toDate(v)
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
}

/** '화' */
export const formatWeekday = (v) => WEEKDAYS[toDate(v).getDay()]

/** '22:10' */
export const formatTime = (v) => {
  const d = toDate(v)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** '09.30 화 22:10' — 모임 카드 */
export const formatMeetupWhen = (v) => `${formatMonthDay(v)} ${formatWeekday(v)} ${formatTime(v)}`

/** '2026.09.26' */
export const formatFullDate = (v) => {
  const d = toDate(v)
  return `${d.getFullYear()}.${formatMonthDay(d)}`
}

/** '9월 28일 월요일' — 홈 상단 */
export const formatTodayTitle = (v = new Date()) => {
  const d = toDate(v)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`
}

/** '10.03 (금) 12:00' — 평가 마감 */
export const formatDeadline = (v) => `${formatMonthDay(v)} (${formatWeekday(v)}) ${formatTime(v)}`

/** 남은 시간 '44시간 12분' · 하루 안 남으면 '3시간 5분' · 1시간 안이면 '25분' */
export function formatTimeLeft(until, now = new Date()) {
  const min = Math.max(0, Math.floor((toDate(until) - now) / 60000))
  const h = Math.floor(min / 60)
  return h > 0 ? `${h}시간 ${min % 60}분` : `${min}분`
}

/** 남은 날 'n일 남음' — 친구 요청 기한 (하루 안이면 'n시간 남음') */
export function formatDaysLeft(until, now = new Date()) {
  const ms = toDate(until) - now
  if (ms <= 0) return '만료됨'
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  return days >= 1 ? `${days}일 남음` : `${Math.max(1, Math.ceil(ms / (60 * 60 * 1000)))}시간 남음`
}

/** 채팅 시각 '오후 7:05' */
export function formatChatTime(v) {
  const d = toDate(v)
  const h = d.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${pad(d.getMinutes())}`
}

/** 채팅방 목록 시각 — 오늘 '오후 7:05' / 어제 '어제' / 그 전 '09.26' */
export function formatRoomTime(v, now = new Date()) {
  const d = toDate(v)
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / (24 * 60 * 60 * 1000))
  if (diff <= 0) return formatChatTime(d)
  if (diff === 1) return '어제'
  return formatMonthDay(d)
}

/** 채팅 날짜 구분선 '10월 4일 토요일' */
export const formatChatDate = (v) => formatTodayTitle(v)

/**
 * 행사 기간 한 줄 — 카드 meta 용
 *  상영: '09.17 개봉'
 *  하루: '10.02'
 *  진행 중: '~11.09'
 *  예정: '10.03 – 10.05'
 */
export function formatEventPeriod(event, now = new Date()) {
  const { runType, startDate, endDate } = event
  if (runType === 'screening' && !endDate) return `${formatMonthDay(startDate)} 개봉`
  if (!endDate) return formatMonthDay(startDate)
  const s = toDate(startDate)
  const e = toDate(endDate)
  if (s.toDateString() === e.toDateString()) return formatMonthDay(s)
  if (s <= now) return `~${formatMonthDay(e)}`
  return `${formatMonthDay(s)} – ${formatMonthDay(e)}`
}
