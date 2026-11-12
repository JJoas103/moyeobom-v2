// 매너 점수 — 화면 문구와 색만. 점수 계산은 서버(services/mannerService.js)

export const MANNER_BASE = 50
export const MANNER_MAX = 100

// 단계 — 경계(40 · 60 · 80)는 여기 한 곳에만. CSS · JSX 에 숫자를 박지 말 것
//   tone → CSS .manner-badge--{tone} · .manner-sum--{tone}. short 는 좁은 자리용 짧은 말
export const MANNER_BANDS = [
  { min: 0, tone: 'low', label: '아쉬워요' },
  { min: 40, tone: 'base', label: '보통이에요', short: '보통' },
  { min: 60, tone: 'mid', label: '좋아요' },
  { min: 80, tone: 'high', label: '아주 좋아요' },
]

/** 눈금 숫자 [0, 40, 60, 80, 100] — 매의 경계 자리에 찍는다 */
export const mannerBandEdges = () => [...MANNER_BANDS.map((b) => b.min), MANNER_MAX]

/** 점수 → 단계. label 은 '보통이에요'(배지·머리줄), name 은 '보통'(매 위 칩처럼 좁은 자리) */
export function mannerTone(score) {
  const n = typeof score === 'number' ? score : MANNER_BASE
  const band = [...MANNER_BANDS].reverse().find((b) => n >= b.min) || MANNER_BANDS[0]
  return { tone: band.tone, label: band.label, name: band.short || band.label, score: n }
}

// 점수가 움직이는 규칙 전문 — points 는 서버 응답 manner.rules 로 채운다
//   숫자에 부호(+/-)를 붙이지 않는다 — 방향은 그룹 제목('오를 때' · '깎일 때')과 색이 말한다
//   깎일 때는 작은 것부터 (RuleList 가 배열 순서 그대로). host: true = 호스트에게만 해당
//   문구: '만나기 하루 전에'(기준점이 있어야 반대로 안 읽힘) · '참여자를 받은'(approvedEver 기준)
export const MANNER_RULES = [
  { key: 'meetup_open', label: '모임을 열었어요', when: '평가 마감 때', host: true },
  { key: 'review_submit', label: '평가를 보냈어요', when: '바로' },
  { key: 'review_praise', label: '매너가 좋았다는 평가를 받았어요', when: '평가 마감 때' },
  { key: 'friend_matched', label: '친구가 됐어요', when: '바로' },
  { key: 'review_low', label: '매너가 아쉬웠다는 평가를 받았어요', when: '평가 마감 때' },
  { key: 'review_skip', label: '평가를 안 보냈어요', when: '평가 마감 때' },
  { key: 'leave_late', label: '만나기 하루 전에 참여를 취소했어요', when: '바로' },
  { key: 'host_cancel', label: '참여자를 받은 모임을 취소했어요', when: '바로', host: true },
  { key: 'manner_report', label: '신고로 제재를 받았어요', when: '관리자 확인 뒤' },
]

// 일부러 점수를 움직이지 않는 것과 이유 — 규칙 패널 안쪽 토글 ("노쇼는 왜 안 깎여?"에 답하는 자리)
export const MANNER_ZERO = [
  ['만나기 하루 전보다 일찍 취소했을 때', '미리 알려 주면 손해가 없어요'],
  ['신청 중에 취소했을 때', '아직 자리를 맡은 게 아니에요'],
  ['아무도 승인하지 않은 모임을 취소했을 때', '아무도 영향받지 않았어요'],
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

// 늦은 취소 판정 — 취소 팝업에 경고를 띄울지만 고른다. 점수는 서버(socialRules.isLateLeave) 단독
const LATE_LEAVE_HOURS = 24

export const isLateLeave = (talkStartAt, now = new Date()) =>
  new Date(talkStartAt) - now <= LATE_LEAVE_HOURS * 60 * 60 * 1000
