// 행사 회차 텍스트(Event.sessionsText) → 달력에 칠할 시간 띠
//
// 출처(서울시 문화행사 PRO_TIME)는 사람이 쓴 문장이라 정해진 형식이 없다. 확인한 모양 (2026-11-09, 열린 행사 76건):
//   '19:30' · '19:00 – 20:30'                       → 기간 내내 매일
//   '수 19:30' · '평일 19:30, 주말 15:00 (월 공연 없음)' → 요일별
//   '화-일 10:00 – 18:00 매주 월요일 휴관'             → 운영 시간 + 휴관 요일
//   '*11.14(토) 18:00 공연' · '둘째주 수요일 … 또는 …' → 일부만 (status 'partial')
//   '공연별 상이' · '상시 운영'                        → 못 읽음 (status 'none')
// **보여 주기만 한다** — 저장하는 값은 호스트가 고른 talk.startAt 하나다. 틀려도 화면에 원문을 같이 띄우므로
// 예외 표시(※ · *) 뒤는 읽지 않고 'partial' 로 알린다. 서버는 이 결과를 쓰지 않는다.

const DAY_KEYS = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

// 요일 한 글자 — '공휴일' · '11월' · '일반' 의 글자는 요일이 아니다 (앞에 한글 · 숫자, 뒤에 '요일' 아닌 한글이면 제외)
const DAY_ITEM = '(?<![가-힣\\d])[월화수목금토일](?:요일|(?![가-힣]))'
const DAY_LIST = `(?:평일|주말|매일|${DAY_ITEM}(?:\\s*[-–~,·./]\\s*${DAY_ITEM})*)`

// 휴관 요일 — '매일'은 넣지 않고, 요일과 '휴관' 사이에 다른 요일 · 시각 · 예외 표시가 끼면 안 된다
//   ('10:00 – 17:00, 매일 ※매주 월요일 휴관' 을 매일 휴관으로 읽었었다). '일-월/ 공휴일 휴관' 의 '공휴일'은 통과
const CLOSED_DAY_LIST = `(?:평일|주말|${DAY_ITEM}(?:\\s*[-–~,·./]\\s*${DAY_ITEM})*)`
const CLOSED_RE = new RegExp(
  `(?:매주\\s*)?(${CLOSED_DAY_LIST})(?:공휴일|[^\\d:※*월화수목금토일]){0,12}?(?:휴관|휴무|공연\\s*없음|공연없음)`,
  'g',
)
const TOKEN_RE = new RegExp(`(\\d{1,2}):(\\d{2})(?:\\s*[–~-]\\s*(\\d{1,2}):(\\d{2}))?|(${DAY_LIST})`, 'g')
// 날 · 철마다 다르다는 말 — 읽은 띠가 맞는 날도 있고 틀린 날도 있다
const UNSURE_RE = /상이|둘째|셋째|넷째|마지막주|또는|격주|홈페이지|휴관|휴무|없음|하절기|동절기|평시|\d{1,2}\s*-\s*\d{1,2}\s*월/

const hm = (h, m) => `${String(Number(h)).padStart(2, '0')}:${m}`

/** '화 - 일요일' → [2,3,4,5,6,0] · '월,수,목' → [1,3,4] · '평일' → [1..5] */
function parseDayList(s) {
  if (s.startsWith('평일')) return [1, 2, 3, 4, 5]
  if (s.startsWith('주말')) return [0, 6]
  if (s.startsWith('매일')) return ALL_DAYS
  const out = []
  let prev = null
  let range = false
  for (const m of s.matchAll(/([월화수목금토일])(?:요일)?|([-–~])/g)) {
    if (m[2]) {
      range = true
      continue
    }
    const d = DAY_KEYS[m[1]]
    if (range && prev !== null) {
      for (let x = (prev + 1) % 7; ; x = (x + 1) % 7) {
        out.push(x)
        if (x === d) break
      }
    } else out.push(d)
    prev = d
    range = false
  }
  return [...new Set(out)]
}

/**
 * @returns {{ status: 'full'|'partial'|'none', closed: number[], clauses: { days: number[]|null, slots: { start, end }[] }[] }}
 *   days null = 매일 · start/end 'HH:MM' · end null = 끝나는 시각 모름
 */
export function parseSessions(text) {
  if (!text) return { status: 'none', closed: [], clauses: [] }
  let t = text
  let partial = false
  const closed = new Set()

  // 1. 휴관 · 공연 없는 요일
  t = t.replace(CLOSED_RE, (_, days) => {
    parseDayList(days).forEach((d) => closed.add(d))
    return ' '
  })

  // 2. 예외 표시 뒤는 버린다 ('※ 9.15.(화)부터 21:00까지' · '*11.14(토) 18:00 공연')
  //    휴관만 적혀 있던 예외('(※매주 일요일 휴관)')는 1에서 이미 읽었으니 남은 게 없으면 넘어간다
  const cut = t.search(/[※*]/)
  if (cut >= 0) {
    if (t.slice(cut).replace(/[\s()[\]※*.,]/g, '')) partial = true
    t = t.slice(0, cut)
  }

  // 3. 시각이 든 괄호는 안내다 ('(입장마감 : 17:30)' · '(18:30 식사 / 19:30 공연)')
  t = t.replace(/\([^)]*\d{1,2}:\d{2}[^)]*\)/g, ' ').replace(/[()[\]]/g, ' ')
  if (UNSURE_RE.test(t)) partial = true

  // 4. 앞에서부터 — 요일이 나오면 새 절, 시각은 지금 절에 쌓는다
  const clauses = []
  let cur = { days: null, slots: [] }
  for (const m of t.matchAll(TOKEN_RE)) {
    if (m[5]) {
      const days = parseDayList(m[5])
      if (cur.slots.length) {
        clauses.push(cur)
        cur = { days, slots: [] }
      } else cur.days = days // '평일(화-금)' — 뒤의 요일이 앞을 고친다
      continue
    }
    // '20:00 까지' 는 회차가 아니라 마감 시각이다
    if (/^\s*까지/.test(t.slice(m.index + m[0].length))) {
      partial = true
      continue
    }
    cur.slots.push({ start: hm(m[1], m[2]), end: m[3] ? hm(m[3], m[4]) : null })
  }
  if (cur.slots.length) clauses.push(cur)
  else if (cur.days && clauses.length === 1 && clauses[0].days === null) clauses[0].days = cur.days // '9:00 – 18:00 화 - 일요일'
  else if (cur.days) partial = true

  if (!clauses.length) return { status: 'none', closed: [...closed], clauses: [] }
  return { status: partial ? 'partial' : 'full', closed: [...closed], clauses }
}

const startOfDay = (v) => {
  const d = new Date(v)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 그날 행사 시간이 처음 끝나는 시각 — 가장 먼저 끝나는 띠의 끝
 *   회차 15:00 · 19:30 → 15:00 회차의 끝 / 전시 10:00 – 18:00 → 18:00
 * null = 띠가 없는 날(휴관 · 기간 밖 · 못 읽은 행사)이거나 끝이 다음날로 넘어가는 경우('06:00 – 24:00')
 * **기본 제안 시각을 잡는 데만 쓴다** (utils/meetupDraft.js). 이야기 자리 시각을 막지는 않는다 —
 * 막던 규칙(빗금 · 검사)은 2026-11-09 에 걷었다: 호스트가 자유롭게 고른다
 */
export function talkAvailableFrom(event, date, parsed = parseSessions(event.sessionsText)) {
  const bands = bandsOn(parsed, event, date)
  if (!bands.length) return null
  const from = new Date(Math.min(...bands.map((b) => b.end.getTime())))
  return from.toDateString() === new Date(date).toDateString() ? from : null
}

/**
 * 그날 칠할 띠 — 행사 기간 밖 · 휴관 요일이면 빈 배열
 * kind 'open' = 운영 시간(전시 · 축제의 '10:00 – 18:00') / 'session' = 회차
 * 회차의 끝을 모르면 러닝타임으로, 그것도 없으면 2시간으로 어림한다 (guessed: true)
 */
export function bandsOn(parsed, event, date) {
  const day = startOfDay(date)
  if (day < startOfDay(event.startDate)) return []
  if (event.endDate && day > startOfDay(event.endDate)) return []
  if (parsed.closed.includes(day.getDay())) return []

  const isPeriod = event.runType === 'period'
  return parsed.clauses
    .filter((c) => !c.days || c.days.includes(day.getDay()))
    .flatMap((c) => c.slots)
    .map(({ start, end }) => {
      const at = (s) => {
        const d = new Date(day)
        const [h, m] = s.split(':').map(Number)
        d.setHours(h, m, 0, 0)
        return d
      }
      const s = at(start)
      if (end) {
        const e = at(end)
        if (e <= s) e.setDate(e.getDate() + 1) // '18:00 – 01:00'
        return { start: s, end: e, kind: isPeriod ? 'open' : 'session', label: `${start}–${end}`, guessed: false }
      }
      const minutes = event.runningTime || 120
      return {
        start: s,
        end: new Date(s.getTime() + minutes * 60 * 1000),
        kind: 'session',
        label: `${start} 회차`,
        guessed: !event.runningTime,
      }
    })
}
