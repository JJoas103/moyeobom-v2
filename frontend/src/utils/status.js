// 상태 배지 — 날짜·인원으로 계산 (DB 저장 안 함)
// tone: 'open' | 'soon' | 'closed' | 'plan' → CSS .status--{tone}

const DAY = 24 * 60 * 60 * 1000

const startOfDay = (v) => {
  const d = new Date(v)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 행사 상태: 상영 중 / 진행 중 / D-n / 예정 / 종료 */
export function eventStatus(event, now = new Date()) {
  const start = new Date(event.startDate)
  const end = event.endDate ? new Date(event.endDate) : null

  if (end && end < now) return { tone: 'closed', label: '종료' }
  if (start > now) return { tone: 'plan', label: event.runType === 'screening' ? '개봉 예정' : '예정' }
  if (event.runType === 'screening' && !end) return { tone: 'open', label: '상영 중' }
  if (end) {
    const left = Math.round((startOfDay(end) - startOfDay(now)) / DAY)
    if (left <= 7) return { tone: 'open', label: left === 0 ? '오늘 종료' : `D-${left}` }
  }
  return { tone: 'open', label: '진행 중' }
}

/** 모임 상태: n자리 남음 / 1자리 남음 / 마감 / 끝난 모임 / 취소됨 */
export function meetupStatus(meetup, now = new Date()) {
  const left = meetup.capacity - (meetup.approvedCount || 0)
  if (meetup.status === 'cancelled') return { tone: 'closed', label: '취소됨', left: 0 }
  if (meetup.talk?.startAt && new Date(meetup.talk.startAt) <= now) return { tone: 'closed', label: '끝난 모임', left: 0 }
  if (meetup.status !== 'open' || left <= 0) return { tone: 'closed', label: '마감', left: 0 }
  if (left === 1) return { tone: 'soon', label: '1자리 남음', left }
  return { tone: 'open', label: `${left}자리 남음`, left }
}
