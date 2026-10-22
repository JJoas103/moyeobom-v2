import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// SPA 는 스크롤 위치 유지 (목록 중간 → 상세도 중간부터) → 라우트 변경 시 맨 위로
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
