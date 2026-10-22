// 백엔드 스키마의 enum 값 → 화면 표시용 라벨·색
// models/Event.js CATEGORIES, models/Meetup.js BUDGETS 와 같은 키

export const CATEGORIES = [
  { key: 'performance', label: '공연', color: 'var(--cat-stage)' },
  { key: 'play', label: '연극', color: 'var(--cat-stage)' },
  { key: 'film', label: '영화', color: 'var(--cat-etc)' },
  { key: 'exhibition', label: '전시', color: 'var(--cat-exhibit)' },
  { key: 'festival', label: '축제', color: 'var(--cat-festival)' },
  { key: 'classic', label: '클래식 · 국악', color: 'var(--cat-stage)' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]))
export const categoryOf = (key) => CATEGORY_MAP[key] || { key, label: key, color: 'var(--cat-etc)' }

export const RUN_TYPE_LABEL = { session: '회차형', period: '기간형', screening: '상영' }

export const BUDGETS = [
  { key: 'under1', label: '1만 원 이하' },
  { key: '1to2', label: '1~2만 원' },
  { key: '2to3', label: '2~3만 원' },
  { key: 'over3', label: '3만 원 이상' },
]
const BUDGET_MAP = Object.fromEntries(BUDGETS.map((b) => [b.key, b.label]))
export const budgetLabel = (key) => BUDGET_MAP[key] || key

// 모임 종류 (카드 · 필터)
export const JOIN_KIND = {
  watch: '관람부터 함께 가능',
  talk: '이야기 자리만',
}

// 신청한 참여 방식 (신청 박스 · 신청자 목록)
export const JOIN_LABEL = {
  watch: '관람부터 함께',
  talk: '이야기 자리만',
}

// 포스터 이미지가 없을 때 쓰는 단색 톤 [배경, 글자]
export const POSTER_TONES = [
  ['#2F3A4A', '#F4F2EC'],
  ['#D9CBB8', '#26221E'],
  ['#A9B7C6', '#26221E'],
  ['#C7A9A0', '#26221E'],
  ['#9FB2A1', '#26221E'],
  ['#5B4A5E', '#F4F2EC'],
  ['#C9A66B', '#26221E'],
  ['#3A3833', '#F4F2EC'],
]

// 서울 자치구 — 지역 필터
export const SEOUL_DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구',
  '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구',
  '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
]

/** '공연 · 뮤지컬 · 회차형' — 분류와 장르가 같으면(연극 · 연극) 한 번만 */
export function categoryText(event, { withRunType = false } = {}) {
  const parts = [categoryOf(event.category).label, event.genre]
  if (withRunType) parts.push(RUN_TYPE_LABEL[event.runType])
  return [...new Set(parts.filter(Boolean))].join(' · ')
}
