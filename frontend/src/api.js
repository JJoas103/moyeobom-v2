// 모든 서버 호출의 입구.
// 1) credentials: 'include' — 세션 쿠키 전송 (로그인 유지)
// 2) 네트워크 실패(백엔드 꺼짐) · HTTP 에러 구분 → 한국어 메시지로 throw
// 3) 에러 객체에 status, fieldErrors 포함 → 호출하는 쪽에서 분기

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const NETWORK_ERROR = '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.'

function buildUrl(path, params) {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    })
  }
  return url
}

async function request(path, { method = 'GET', params, body, form } = {}) {
  const options = { method, credentials: 'include' }

  if (form) {
    // FormData — Content-Type 직접 지정 안 함 (브라우저가 boundary 포함)
    options.body = form
  } else if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(buildUrl(path, params), options)
  } catch {
    throw new Error(NETWORK_ERROR)
  }

  const data = await res.json().catch(() => null)

  if (!res.ok || data?.success === false) {
    const error = new Error(data?.message || `요청에 실패했습니다 (${res.status})`)
    error.status = res.status
    if (data?.fieldErrors) error.fieldErrors = data.fieldErrors
    if (data?.authRequired) error.authRequired = true
    throw error
  }
  return data
}

export const apiGet = (path, { params } = {}) => request(path, { params })
export const apiPost = (path, body) => request(path, { method: 'POST', body })
export const apiPatch = (path, body) => request(path, { method: 'PATCH', body })
export const apiDelete = (path) => request(path, { method: 'DELETE' })
export const apiPostForm = (path, form) => request(path, { method: 'POST', form })
export const apiPatchForm = (path, form) => request(path, { method: 'PATCH', form })
