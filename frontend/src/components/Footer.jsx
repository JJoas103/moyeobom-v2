export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span className="site-footer__brand">모여봄</span>
        {/* 지금 들어오는 행사는 전부 서울시 문화행사다. KOPIS · KOBIS 는 Event 의
            source enum 에 자리만 있고 가져오는 코드가 없으니 적지 않는다 (붙이면 그때 추가). */}
        <span>행사 정보 · 서울시 문화행사 정보</span>
        <span className="spacer" />
        <span>대학 팀 프로젝트</span>
      </div>
    </footer>
  )
}
