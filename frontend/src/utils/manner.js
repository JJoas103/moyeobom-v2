// 매너 점수 — 화면에 쓰는 문구와 색. 점수 계산은 서버(services/mannerService.js)가 한다
//
// 이 기능의 목적은 "왜 내 점수가 깎였지? 왜 올랐지?"를 남기지 않는 것이다. 그래서
// 규칙 전문(MANNER_RULES)과 **일부러 안 움직이는 것**(MANNER_ZERO)을 둘 다 화면에 띄운다.
// 숨기면 추측이 시작된다.

export const MANNER_BASE = 50

// tone: 'high' | 'mid' | 'base' | 'low' → CSS .manner-badge--{tone} · .manner-sum--{tone}
export function mannerTone(score) {
  const n = typeof score === 'number' ? score : MANNER_BASE
  if (n >= 80) return { tone: 'high', label: '아주 좋아요', score: n }
  if (n >= 60) return { tone: 'mid', label: '좋아요', score: n }
  if (n >= 40) return { tone: 'base', label: '보통이에요', score: n }
  return { tone: 'low', label: '아쉬워요', score: n }
}

/** 변동분에 부호 — +2 · -3 */
export const signed = (n) => (n > 0 ? `+${n}` : String(n))

// 점수가 움직이는 규칙 전문. points 는 서버 응답의 manner.rules 로 채운다 (한 곳에서만 정한다)
//
// 활동 가점의 조건('평가를 보내야 올라간다')은 줄마다 반복하지 않고 패널 맨 위에 한 문장으로
// 한 번만 쓴다 (PraiseTab 의 MannerRules) — 줄마다 적으면 when 칸이 길어져서 오를 때 · 깎일 때가
// 한눈에 안 들어온다.
// 깎일 때는 **작은 것부터** 적는다 (RuleList 가 배열 순서를 그대로 쓴다) — 심각도가 읽히게.
export const MANNER_RULES = [
  { key: 'meetup_open', label: '모임을 열었어요', when: '평가 마감 때' },
  { key: 'meetup_join', label: '모임에 참여했어요', when: '평가 마감 때' },
  { key: 'review_submit', label: '평가를 보냈어요', when: '바로' },
  { key: 'review_praise', label: '매너가 좋았다는 평가를 받았어요 (1건마다)', when: '평가 마감 때' },
  { key: 'friend_matched', label: '친구가 됐어요', when: '바로' },
  { key: 'review_skip', label: '평가를 안 보냈어요', when: '평가 마감 때' },
  { key: 'leave_late', label: '이야기 자리 하루 안에 참여를 취소했어요', when: '바로' },
  { key: 'review_low', label: '여러 분이 매너를 아쉽게 평가했어요', when: '평가 마감 때' },
  { key: 'host_cancel', label: '참여자가 있는 모임을 취소했어요', when: '바로' },
]

// 일부러 점수를 움직이지 않는 것 — 이유까지 적는다.
// 화면에서는 규칙 패널 **안쪽 토글**로 접어 둔다 (기본은 안 보임, 2026-11-05).
// 지우지는 않는다 — "노쇼는 왜 안 깎여?" · "한 명만 아쉽다고 하면 왜 안 깎여?" 에
// 답할 수단이 없으면 추측이 시작된다 (CLAUDE.md 원칙 3).
export const MANNER_ZERO = [
  ['이야기 자리 하루 전까지 미리 취소했을 때', '미리 알려 주면 손해가 없어요'],
  ['신청 중에 취소했을 때', '아직 자리를 맡은 게 아니에요'],
  ['참여자가 없는 모임을 취소했을 때', '아무도 영향받지 않았어요'],
  [
    '한 사람만 매너를 아쉽게 평가했을 때',
    '평가한 분들의 과반이 그렇게 평가했을 때만 점수가 움직여요. 한 사람의 평가만으로는 깎이지 않아요',
  ],
  ["'또 만나고 싶어요'를 받았을 때", '한쪽만 고른 건 아무에게도 알리지 않아요'],
  [
    '약속에 나타나지 않았을 때',
    '확인할 방법이 없어 따로 깎지는 않아요. 대신 평가를 보낼 수 없어서 그 모임의 참여가 인정되지 않아요',
  ],
  ['신고를 받았을 때', '확인 절차가 아직 없어요'],
  ['차단하거나 친구를 끊었을 때', '누구의 잘못인지 알 수 없어요'],
]
