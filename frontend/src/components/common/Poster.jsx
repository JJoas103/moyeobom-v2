import { categoryOf } from '../../data/constants'
import { posterTone } from '../../utils/poster'
import { assetUrl } from '../../utils/asset'

/**
 * 세로 3:4 포스터. 이미지 없으면 _id 기준 단색 톤 + 영문 라벨 + 제목
 * 사용처: 행사 카드 · 모임 카드 · 상세 상단
 */
export default function Poster({ id, imageUrl, category, subtitle, title, showBadge = true, size = 'md', children }) {
  const cat = categoryOf(category)
  const tone = posterTone(id)

  return (
    <div className={`poster poster--${size}`} style={imageUrl ? undefined : { background: tone.bg }}>
      {imageUrl ? (
        <img src={assetUrl(imageUrl)} alt="" loading="lazy" />
      ) : (
        <div className="poster__fallback" style={{ color: tone.ink }}>
          {subtitle && <span className="poster__eng">{subtitle}</span>}
          <span className="poster__title">{title}</span>
        </div>
      )}

      {showBadge && (
        <span className="poster__badge">
          <span className="cat-dot" style={{ background: cat.color }} />
          {cat.label}
        </span>
      )}

      {children}
    </div>
  )
}
