// 카카오 지도 SDK — Promise 를 모듈 레벨에 캐싱 (중복 로드 방지 · StrictMode 에서 effect 2번 실행)
let loadPromise = null

export function loadKakaoMaps() {
  if (window.kakao?.maps) return Promise.resolve(window.kakao)
  if (loadPromise) return loadPromise

  const appKey = import.meta.env.VITE_KAKAO_MAP_API

  loadPromise = new Promise((resolve, reject) => {
    if (!appKey) {
      reject(new Error('카카오 지도 API 키(VITE_KAKAO_MAP_API)가 설정되지 않았습니다.'))
      return
    }
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = () => {
      loadPromise = null // 실패하면 다음에 다시 시도할 수 있게
      reject(new Error('카카오 지도 스크립트를 불러오지 못했습니다.'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
