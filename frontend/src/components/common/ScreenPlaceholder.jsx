// 구현 전 화면 자리 — 화면 완성 시 실제 화면으로 교체
// children 으로 데이터 연결 상태 간단히 표시
export default function ScreenPlaceholder({ title, artboard, children }) {
  return (
    <section>
      <div className="page-head">
        <h1>{title}</h1>
        <span className="spacer" />
        <span style={{ fontSize: 14, color: 'var(--text-sub)' }}>시안: {artboard}</span>
      </div>
      <div style={{ padding: '32px 0', color: 'var(--text-body)', fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}
