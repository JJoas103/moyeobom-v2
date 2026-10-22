import { Link } from 'react-router-dom'

/** 섹션 제목줄: 제목 · 숫자 · 오른쪽 '모두 보기 ›' 링크, 아래 얇은 선 */
export default function SectionHead({ title, count, moreTo, moreLabel }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {count != null && <span className="section-head__count">{count}</span>}
      <span className="spacer" />
      {moreTo && (
        <Link to={moreTo} className="section-head__more">
          {moreLabel} ›
        </Link>
      )}
    </div>
  )
}
