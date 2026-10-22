import { useState } from 'react'
import SectionHead from '../common/SectionHead'
import KakaoMap from '../common/KakaoMap'

// 행사 상세 '장소' — 지도 · 주소 복사
export default function EventPlace({ event }) {
  const [copied, setCopied] = useState(false)
  // 영화처럼 정해진 장소가 없는 행사만 안내 문구 · 주소 없으면(서울시 데이터) 장소명만
  const noFixedPlace = event.runType === 'screening' && !event.location
  const placeText = event.address || event.venue

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(event.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="detail-section">
      <SectionHead title="장소" />
      {noFixedPlace ? (
        <div className="empty-inline">상영관마다 달라요. 보는 곳은 각자 정하고, 이야기 자리에서 만나요.</div>
      ) : (
        <>
          <KakaoMap lat={event.location?.lat} lng={event.location?.lng} title={event.venue} />
          {placeText && (
            <div className="place-row">
              <span>{placeText}</span>
              {event.address && (
                <button type="button" className="btn btn--line btn--sm" onClick={copy}>
                  {copied ? '복사했어요' : '주소 복사'}
                </button>
              )}
            </div>
          )}
        </>
      )}
      <p className="detail-note">모임 장소는 호스트가 정하고, 승인된 참여자에게만 보여요.</p>
    </section>
  )
}
