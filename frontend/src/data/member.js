// 마이 — 화면은 이 함수들만 사용 (실제 API 전용, 목업 없음)
//
// 응답 모양 (백엔드 services/myPageService.js 와 같음):
//   GET /api/member/me → {
//     profile: { _id, email, nickname, profileImage, provider, tastes, districts, createdAt },
//     stats:   { meetupCount(연 모임 + 승인된 모임, 취소 제외), friendCount, praiseCount },
//     praise:  { total, meetups: [{ meetup(작은 요약 — data/friends.js 와 같음), praisedCount, ratedCount }] },
//     upcoming: { hosted, joined },   // 아직 안 끝난 연 모임 · 참여(신청 중 포함) 모임 수 — 하나라도 있으면 탈퇴 불가
//     manner:  { score, base, logSum, rules, log: [{ _id, type, message, scoreChange, requested, meetup, createdAt }] },
//   }
//   받은 매너 평가는 평가가 마감된 모임만 · 누가 평가했는지는 없음 (분모 ratedCount = 실제로 평가를 낸 사람 수)
//   '아쉬웠어요'는 내려오지 않는다 — 과반을 넘겨 점수가 움직였으면 manner.log 에 한 줄 남는다
//   매너 점수: 불변식 base + logSum === score — 화면이 이 식을 검산 줄로 보여준다
//     scoreChange 는 실제 적용분, requested 는 규칙상 요청분. 다르면 0 · 100 경계에 걸린 것이다
//     rules 는 '이렇게 움직여요' 표에 쓰는 규칙별 점수 (백엔드 mannerService.SCORES)
import { apiGet, apiPatch, apiPatchForm, apiPost } from '../api'

export const WITHDRAW_TEXT = '탈퇴' // 소셜 가입자 탈퇴 확인 문구 (백엔드 myPageService 와 같음)

export const fetchMyPage = () => apiGet('/api/member/me')

/** 닉네임 · 프로필 사진 바꾸기 — file 있으면 새 사진, removeImage 면 기본 사진. → user */
export async function updateProfile({ nickname, file, removeImage }) {
  const form = new FormData()
  form.append('nickname', nickname)
  if (file) form.append('uploadFile', file)
  else if (removeImage) form.append('removeImage', 'true')
  const { user } = await apiPatchForm('/api/member/me', form)
  return user
}

/** 취향 · 관심 지역 바꾸기 — tastes 는 하나 이상. → user */
export async function updateTastes({ tastes, districts }) {
  const { user } = await apiPatch('/api/member/me/tastes', { tastes, districts })
  return user
}

/** 회원 탈퇴 — 이메일 가입자는 password, 소셜은 confirmText('탈퇴'). 성공하면 세션도 끝남 */
export const withdraw = ({ password, confirmText }) => apiPost('/api/member/withdraw', { password, confirmText })

/** 비밀번호 바꾸기 — 이메일 가입자만 */
export const changePassword = ({ currentPassword, password, password2 }) =>
  apiPatch('/api/member/me/password', { currentPassword, password, password2 })
