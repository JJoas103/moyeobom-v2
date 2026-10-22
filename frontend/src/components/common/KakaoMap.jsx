import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../../utils/loadKakaoMaps'
import { PinIcon } from './Icons'

/**
 * 카카오 지도 한 점 표시. 키가 없거나 불러오지 못하면 회색 자리 + 안내 문구.
 * markers: [{ lat, lng, title }]
 */
export default function KakaoMap({ lat, lng, title, height = 240, level = 4 }) {
  const boxRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (lat == null || lng == null) return
    let cancelled = false
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !boxRef.current) return
        const center = new kakao.maps.LatLng(lat, lng)
        const map = new kakao.maps.Map(boxRef.current, { center, level })
        new kakao.maps.Marker({ map, position: center, title })
      })
      .catch((e) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [lat, lng, title, level])

  if (lat == null || lng == null || error) {
    return (
      <div className="map-placeholder" style={{ height }}>
        <PinIcon />
        <span>{error ? `카카오 지도 자리 — ${error}` : '위치 정보가 없는 행사예요'}</span>
      </div>
    )
  }

  return <div ref={boxRef} className="map-box" style={{ height }} role="img" aria-label={`${title} 위치 지도`} />
}
