import { assetUrl } from './asset'

/** 프로필 사진 주소 — 없으면 null (화면은 기본 아바타 색) */
export const profileImageUrl = (user) => (user?.profileImage ? assetUrl(`/images/profile/${user.profileImage}`) : null)

/** 가입 서버 오류가 어느 단계 칸인지 — 그 단계로 돌아가 보여 줌 (① 계정 ② 취향 ③ 지역) */
export function stepOfErrors(fieldErrors) {
  if (['email', 'password', 'password2', 'nickname', 'uploadFile'].some((key) => fieldErrors[key])) return 1
  if (fieldErrors.tastes) return 2
  return 3
}
