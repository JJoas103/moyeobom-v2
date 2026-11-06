// 매너 점수 — 화면에 쓰는 문구와 색. 점수 계산은 서버(services/mannerService.js)가 한다
//
// 이 기능의 목적은 "왜 내 점수가 깎였지? 왜 올랐지?"를 남기지 않는 것이다. 그래서
// 규칙 전문(MANNER_RULES)과 **일부러 안 움직이는 것**(MANNER_ZERO)을 둘 다 화면에 띄운다.
// 숨기면 추측이 시작된다.

export const MANNER_BASE = 50
export const MANNER_MAX = 100

// 단계 — **경계는 여기 한 곳에만 둔다.** mannerTone 도 점수 카드의 매도 이걸 읽는다.
//   tone: 'high' | 'mid' | 'base' | 'low' → CSS .manner-badge--{tone} · .manner-sum--{tone}
//   label 은 배지·카드에 그대로 나가는 말, short 는 매 아래 좁은 칸에 들어가는 짧은 말.
export const MANNER_BANDS = [
  { min: 0, tone: 'low', label: '아쉬워요' },
  { min: 40, tone: 'base', label: '보통이에요', short: '보통' },
  { min: 60, tone: 'mid', label: '좋아요' },
  { min: 80, tone: 'high', label: '아주 좋아요' },
]

/** 칸 이름과 너비(%) — 점수 카드의 매가 쓴다. 합은 항상 100 이다 */
export const mannerBandSpans = () =>
  MANNER_BANDS.map((band, i) => ({
    ...band,
    name: band.short || band.label,
    width: (MANNER_BANDS[i + 1]?.min ?? MANNER_MAX) - band.min,
  }))

export function mannerTone(score) {
  const n = typeof score === 'number' ? score : MANNER_BASE
  const band = [...MANNER_BANDS].reverse().find((b) => n >= b.min) || MANNER_BANDS[0]
  return { tone: band.tone, label: band.label, score: n }
}

// ⚠ 변동분에 부호를 붙이는 signed() 가 있었는데 지웠다 (2026-11-07).
//   하이픈(-)은 마이너스 기호가 아니라서 폭이 짧고 아래 붙어 **숫자 앞에 오면 오탈자로 보였다.**
//   이 앱의 숫자는 전부 알약에 담겨 있고(.manner-badge · .mypage-tag · .status--*) 이력만
//   맨 글자라 혼자 겉돌았다. 지금은 **알약 색 + 화살표**로 방향을 말한다 (PraiseTab 의 Delta),
//   규칙 목록은 **그룹 제목('오를 때' · '깎일 때')**이 방향을 말한다. 부호로 되돌리지 말 것.

// 점수가 움직이는 규칙 전문. points 는 서버 응답의 manner.rules 로 채운다 (한 곳에서만 정한다)
//
// 개설 가점(+5)의 조건은 줄마다 반복하지 않고 패널 맨 위에 한 문장으로 한 번만 쓴다
// (PraiseTab 의 MannerRules) — 줄마다 적으면 when 칸이 길어져 오를 때 · 깎일 때가 한눈에 안 들어온다.
// 참여 가점(+2)은 2026-11-06 에 없앴다 — 참석을 확인할 방법이 없다. MANNER_ZERO 가 그 이유를 말한다.
// 깎일 때는 **작은 것부터** 적는다 (RuleList 가 배열 순서를 그대로 쓴다) — 심각도가 읽히게.
// leave_late 는 '이야기 자리 하루 안에' 였는데 **기준점이 없어 반대로 읽혔다** (2026-11-07) —
// "하루 안에 취소"가 *참여한 뒤 하루 안*, 즉 일찍 취소한 쪽으로도 읽힌다. 그래서 '만나기 하루 전에'.
// 이 패널은 모임 화면 밖(마이페이지)이라 앱 용어('이야기 자리')를 모르는 상태로 읽는 자리다.
export const MANNER_RULES = [
  { key: 'meetup_open', label: '모임을 열었어요', when: '평가 마감 때' },
  { key: 'review_submit', label: '평가를 보냈어요', when: '바로' },
  { key: 'review_praise', label: '매너가 좋았다는 평가를 받았어요', when: '평가 마감 때' },
  { key: 'friend_matched', label: '친구가 됐어요', when: '바로' },
  { key: 'review_low', label: '매너가 아쉬웠다는 평가를 받았어요', when: '평가 마감 때' },
  { key: 'review_skip', label: '평가를 안 보냈어요', when: '평가 마감 때' },
  { key: 'leave_late', label: '만나기 하루 전에 참여를 취소했어요', when: '바로' },
  { key: 'host_cancel', label: '참여자가 있는 모임을 취소했어요', when: '바로' },
  { key: 'manner_report', label: '신고로 제재를 받았어요', when: '관리자 확인 뒤' },
]

// 일부러 점수를 움직이지 않는 것 — 이유까지 적는다.
// 화면에서는 규칙 패널 **안쪽 토글**로 접어 둔다 (기본은 안 보임, 2026-11-05).
// 지우지는 않는다 — "노쇼는 왜 안 깎여?" · "한 명만 아쉽다고 하면 왜 안 깎여?" 에
// 답할 수단이 없으면 추측이 시작된다 (CLAUDE.md 원칙 3).
export const MANNER_ZERO = [
  ['만나기 하루 전보다 일찍 취소했을 때', '미리 알려 주면 손해가 없어요'],
  ['신청 중에 취소했을 때', '아직 자리를 맡은 게 아니에요'],
  ['참여자가 없는 모임을 취소했을 때', '아무도 영향받지 않았어요'],
  [
    '모임에 참여했을 때',
    '실제로 왔는지 확인할 방법이 없어서 참여만으로는 점수를 주지 않아요. 함께한 분들의 평가로 움직여요',
  ],
  ["'또 만나고 싶어요'를 받았을 때", '한쪽만 고른 건 아무에게도 알리지 않아요'],
  [
    '약속에 나타나지 않았을 때',
    '오셨는지 따로 확인하지 않아요. 대신 함께한 분들이 매너를 아쉽게 평가하면 그걸로 움직여요',
  ],
  ['신고가 접수됐을 때', '관리자가 확인하기 전에는 깎이지 않아요. 신고만으로는 아무 일도 일어나지 않아요'],
  ['차단하거나 친구를 끊었을 때', '누구의 잘못인지 알 수 없어요'],
]

// 늦은 취소 판정 — **팝업에 경고를 띄울지 고르는 데만** 쓴다 (ApplyBox 의 LeaveButton).
// 점수를 정하는 쪽은 서버 단독이다 (services/socialRules.js 의 같은 이름 함수 · LATE_LEAVE_HOURS).
// 여기 값이 틀려도 점수는 안 틀린다 — 경고를 못 띄우거나 괜히 띄울 뿐이다.
// 서버 규칙을 프런트가 거울처럼 들고 있는 건 utils/event.js 의 canOpenMeetup 과 같은 방식이다.
const LATE_LEAVE_HOURS = 24

export const isLateLeave = (talkStartAt, now = new Date()) =>
  new Date(talkStartAt) - now <= LATE_LEAVE_HOURS * 60 * 60 * 1000
