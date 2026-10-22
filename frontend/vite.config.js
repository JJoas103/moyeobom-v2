import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 프록시 없음 — API 주소는 VITE_API_BASE_URL 절대 URL, 쿠키는 credentials: 'include'
export default defineConfig({
  plugins: [react()],
})
