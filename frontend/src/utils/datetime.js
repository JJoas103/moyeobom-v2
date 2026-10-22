// <input type="datetime-local"> 값 ↔ Date 변환 (브라우저 현지 시각 기준)
const pad = (n) => String(n).padStart(2, '0')

/** Date → 'YYYY-MM-DDTHH:mm' (datetime-local 값) */
export function toLocalInput(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 'YYYY-MM-DDTHH:mm' → Date (빈 값이면 null) */
export function fromLocalInput(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 분 단위를 10분 단위로 올림 */
export function ceilTo10(date) {
  const d = new Date(date)
  const m = d.getMinutes()
  d.setMinutes(Math.ceil(m / 10) * 10, 0, 0)
  return d
}

export const addMinutes = (date, min) => new Date(new Date(date).getTime() + min * 60 * 1000)
