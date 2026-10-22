import { API_BASE_URL } from '../api'

/**
 * 백엔드에 올린 파일 경로('/images/upload/…')를 브라우저가 열 수 있는 주소로.
 * 외부 주소(행사 포스터 https://…) · 미리보기(blob:) · 빈 값은 그대로
 */
export const assetUrl = (path) => (path && path.startsWith('/') ? `${API_BASE_URL}${path}` : path || null)
