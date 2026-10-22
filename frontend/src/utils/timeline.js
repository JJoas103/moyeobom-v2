// 모임 상세 '그날 저녁' 타임라인 — 모임·행사 정보로 시간순 구성
// who: 'watch' = 관람부터 함께하는 사람만 / 'event' = 행사 일정(자동) / 'all' = 모두 (제목은 호스트 작성)

// 행사 칸 제목 — [시작, 끝]
const EVENT_WORDS = {
  performance: ['공연 시작', '커튼콜'],
  play: ['공연 시작', '커튼콜'],
  classic: ['공연 시작', '공연 끝'],
  film: ['상영 시작', '엔딩 크레딧'],
  exhibition: ['관람 시작', '관람 마무리'],
  festival: ['행사 시작', '행사 마무리'],
}

export function buildTimeline(meetup) {
  const { event, watch, talk } = meetup
  const items = []
  const words = EVENT_WORDS[event?.category] || ['행사 시작', '행사 끝']

  if (watch?.enabled) {
    if (watch.meetAt) {
      items.push({ at: watch.meetAt, who: 'watch', title: `${watch.meetPlace || '행사장 앞'}에서 만나요` })
    }
    if (watch.sessionAt) {
      items.push({ at: watch.sessionAt, who: 'event', title: words[0] })
      if (event?.runningTime) {
        const end = new Date(new Date(watch.sessionAt).getTime() + event.runningTime * 60 * 1000)
        items.push({ at: end.toISOString(), who: 'event', title: words[1] })
      }
    }
  }

  // 초록칸 — 호스트가 모임 만들기에서 쓴 제목 (없는 옛 데이터는 기본 문구)
  items.push({ at: talk.startAt, who: 'all', title: talk.startTitle || `이야기 자리 · ${talk.area}` })

  return items.sort((a, b) => new Date(a.at) - new Date(b.at))
}
