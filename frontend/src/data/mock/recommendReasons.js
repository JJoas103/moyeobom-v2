// 추천 이유 — 로그인 사용자 기준 서버 계산 → event.recommendReasons (추천 단계)
// 지금은 화면 확인용 (몇 개 행사에만)
import { mockId } from './time'

const mockRecommendReasons = {
  [mockId(2)]: [
    { label: '취향', text: '뮤지컬을 고르셨어요' },
    { label: '이력', text: '지난달 연극 모임에 참여했어요' },
    { label: '지역', text: '사는 곳에서 가까워요' },
  ],
  [mockId(4)]: [
    { label: '취향', text: '전시를 고르셨어요' },
    { label: '친구', text: '친구 1명이 이 행사 모임에 참여해요' },
  ],
}

export default mockRecommendReasons
