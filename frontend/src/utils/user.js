import { assetUrl } from './asset'

/** 프로필 사진 주소 — 없으면 null (화면은 기본 아바타 색) */
export const profileImageUrl = (user) => (user?.profileImage ? assetUrl(`/images/profile/${user.profileImage}`) : null)
