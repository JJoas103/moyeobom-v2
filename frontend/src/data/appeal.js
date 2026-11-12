// 이의제기 — 제재받은 당사자용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/appealService.js 와 같음):
//   sanction = { _id(신고 id), meetupTitle, sanctionedAt,
//                canAppeal(아직 안 냈으면 true),
//                appeal: { text, at, status('open'|'accepted'|'rejected'), reply, decidedAt } | null }
//
// **제재 1건당 한 번만** 낼 수 있다 — 낸 뒤에는 canAppeal 이 false 가 된다.
// 신고자 · 신고 이유 · 증거는 내려오지 않는다 (신고자를 역추적할 여지를 만들지 않는다).
import { apiGet, apiPost } from '../api'

export const APPEAL_MAX = 500 // models/Report.js APPEAL_MAX

export const APPEAL_STATUS_LABEL = {
  open: '검토 중',
  accepted: '제재가 취소됐어요',
  rejected: '제재가 그대로예요',
}

/** → { sanctions } — 내가 받은 (아직 유효한) 제재와 이의 상태 */
export const fetchMySanctions = () => apiGet('/api/member/appeals')

/** → { appeal } */
export const submitAppeal = (reportId, text) => apiPost(`/api/member/appeals/${reportId}`, { text })
