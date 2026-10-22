/** 정보 목록 한 줄 — 아이콘 · 라벨 · 값 (<ul className="info-list"> 안에서 사용) */
export default function InfoRow({ icon, label, children }) {
  return (
    <li>
      <span className="info-list__icon">{icon}</span>
      <span className="info-list__label">{label}</span>
      <span>{children}</span>
    </li>
  )
}
