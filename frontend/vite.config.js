import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 프록시 없음 — API 주소는 VITE_API_BASE_URL 절대 URL, 쿠키는 credentials: 'include'
export default defineConfig({
  plugins: [react()],

  // ⚠ FullCalendar 는 의존성 사전 번들에서 뺀다 (2026-11-09).
  //   esbuild 가 사전 번들하면 daygrid 의 뷰 클래스가 깨져 모임 만들기 ③ '언제' 에서
  //   `Class constructor DayTableView cannot be invoked without 'new'` 로 터지고,
  //   FullCalendar 가 통째로 죽으면서 **화면이 하얘진다**(폼이 사라져 아무것도 못 한다).
  //   node_modules/.vite 를 지워도 재현된다 — 캐시 문제가 아니라 사전 번들 자체가 원인이다.
  //   dev 전용 설정이라 빌드(rollup)에는 영향이 없다. 대신 dev 에서 그 패키지만 모듈을
  //   여러 번 받아 첫 로딩이 조금 느리다.
  optimizeDeps: {
    exclude: ['@fullcalendar/core', '@fullcalendar/daygrid', '@fullcalendar/interaction', '@fullcalendar/react'],
  },
})
