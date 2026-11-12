import { mannerTone, MANNER_BASE } from '../../utils/manner'

// 매너 점수 배지 — 모임 호스트 · 참여자 · 친구 줄에 붙는 작은 표시
//   숫자를 크게 쓰지 않는다. title 로 뜻을 함께 알려준다
//   평가 화면에는 쓰지 않는다 (점수를 보고 칭찬을 고르면 평가가 점수를 따라간다)
export default function MannerBadge({ manner, label = false }) {
  const { tone, label: text, score } = mannerTone(manner?.score ?? MANNER_BASE)

  return (
    <span className={`manner-badge manner-badge--${tone}`} title={`매너 점수 ${score}점 · ${text}`}>
      <b>{score}</b>
      {label && <span>{text}</span>}
    </span>
  )
}
