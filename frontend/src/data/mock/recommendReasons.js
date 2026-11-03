// 추천 이유 — 로그인 사용자 기준 서버 계산 (services/recommendService.js) → event.recommendReasons
// 지금은 화면 확인용 (몇 개 행사에만)
import { mockId } from './time'

const mockRecommendReasons = {
  [mockId(2)]: [
    { type: 'taste', value: 'performance' },
    { type: 'district', value: '종로구' },
    { type: 'history', value: 'play' },
  ],
  [mockId(4)]: [{ type: 'taste', value: 'exhibition' }],
}

export default mockRecommendReasons
