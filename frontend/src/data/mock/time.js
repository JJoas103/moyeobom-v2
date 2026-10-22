// 목업 날짜는 '오늘' 기준 상대값 — 날짜가 지나도 '진행 중' 유지

export function mockId(n) {
  return n.toString(16).padStart(24, '0') // ObjectId 처럼 보이는 24자리
}

// at(2, '22:10') → 오늘로부터 2일 뒤 22:10 의 ISO 문자열 (API 응답과 같은 형태)
export function at(offsetDays, hhmm = '00:00') {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}
