import { Link } from 'react-router-dom'

// 찜 목록 — 찜 기능이 아직 없어 안내만 (TODO(찜 단계): 행사 · 모임 찜 모델 · API)
export default function LikesTab() {
  return (
    <div className="state-box">
      <strong>찜 기능을 준비하고 있어요</strong>
      행사 · 모임 찜은 곧 열려요.
      <div className="my-empty__action">
        <Link to="/event" className="btn btn--line">
          행사 둘러보기
        </Link>
      </div>
    </div>
  )
}
