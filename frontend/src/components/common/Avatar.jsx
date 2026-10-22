import { posterTone } from '../../utils/poster'
import { profileImageUrl } from '../../utils/user'

/** 사람 동그라미 — 프로필 사진, 없으면 _id 기준 고정 색 */
export default function Avatar({ user, size = 36 }) {
  const image = profileImageUrl(user)
  const style = { width: size, height: size }
  return image ? (
    <img className="avatar" src={image} alt="" style={style} />
  ) : (
    <span className="avatar" style={{ ...style, background: posterTone(user?._id).bg }} aria-hidden="true" />
  )
}
