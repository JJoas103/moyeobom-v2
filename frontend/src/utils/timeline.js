// 모임 상세 '그날 저녁' 타임라인 — 모임·행사 정보로 시간순 구성
// who: 'watch' = 관람부터 함께하는 사람만 / 'event' = 행사 일정(자동) / 'all' = 모두 (제목은 호스트 작성)
// at 이 null 인 줄은 시각 없이 맨 앞에 온다 — 회차를 채팅에서 정하는 관람 (2026-11-09 부터)

// 호스트가 쓰는 줄 (meetup.timeline, 2026-11-09) — 백엔드 meetupService 와 같게
export const TIMELINE_ROWS_MAX = 5 // 첫 줄(이야기 자리 시작) 제외
export const TIMELINE_HOURS = 12 // 이야기 자리 시작에서 이 시간 안
export const TIMELINE_TITLE_MAX = 30

/** 모임 만들기 타임라인 줄 'HH:MM' → 이야기 자리 시작 기준 Date — 시작보다 이르거나 같으면 다음날(자정 넘김) */
export function rowAt(talkStart, time) {
  if (!talkStart || !/^\d{2}:\d{2}$/.test(time || '')) return null
  const [h, m] = time.split(':').map(Number)
  const d = new Date(talkStart)
  d.setHours(h, m, 0, 0)
  if (d <= talkStart) d.setDate(d.getDate() + 1)
  return d
}

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
    // 그 전에 만든 모임만 회차 · 만나는 곳이 저장돼 있다
    if (!watch.sessionAt) items.push({ at: null, who: 'watch', title: '같이 볼 회차는 채팅에서 정해요' })
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

  // 초록칸 — 이야기 자리 시작. startTitle 은 2026-11-09 전 모임에만 있다
  items.push({ at: talk.startAt, who: 'all', title: talk.startTitle || `이야기 자리 · ${talk.area}` })
  // 그 뒤 호스트가 쓴 줄
  for (const r of meetup.timeline || []) items.push({ at: r.at, who: 'all', title: r.title })

  return items.sort((a, b) => (a.at === null ? -1 : b.at === null ? 1 : new Date(a.at) - new Date(b.at)))
}
