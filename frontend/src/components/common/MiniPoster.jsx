import { posterTone } from '../../utils/poster'
import { assetUrl } from '../../utils/asset'

/** 작은 포스터 조각 — 채팅방 목록 · 친구 카드 · 평가 화면. meetup(작은 요약) 기준: 모임 사진 → 행사 포스터 → 단색 */
export default function MiniPoster({ meetup, width = 40, height = 52, radius = 6 }) {
  const src = meetup?.imageUrl || meetup?.event?.posterUrl
  return (
    <span
      className="mini-poster"
      style={{ width, height, borderRadius: radius, background: src ? undefined : posterTone(meetup?.event?._id || meetup?._id).bg }}
      aria-hidden="true"
    >
      {src && <img src={assetUrl(src)} alt="" loading="lazy" />}
    </span>
  )
}
