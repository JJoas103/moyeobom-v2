import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DataState from '../common/DataState'
import { PinIcon } from '../common/Icons'
import MetaLine from '../common/MetaLine'
import { posterTone } from '../../utils/poster'
import { assetUrl } from '../../utils/asset'
import { useAsync } from '../../utils/useAsync'
import { fetchEvents } from '../../data/events'
import { categoryOf } from '../../data/constants'
import { formatEventPeriod } from '../../utils/format'
import { loadKakaoMaps } from '../../utils/loadKakaoMaps'

const SEOUL = { lat: 37.5665, lng: 126.978 }
const FOCUS_LEVEL = 4 // 행사를 고르면 클러스터가 풀리는 정도로 가까이
const CLUSTER_STYLE = {
  width: '40px',
  height: '40px',
  lineHeight: '40px',
  borderRadius: '50%',
  background: 'rgba(31, 107, 82, 0.88)',
  color: '#ffffff',
  textAlign: 'center',
  fontSize: '14px',
  fontWeight: '700',
}

const hasLocation = (e) => e.location?.lat != null && e.location?.lng != null

function Thumb({ event, width, height }) {
  return (
    <span className="home-map__thumb" style={{ width, height, background: event.posterUrl ? undefined : posterTone(event._id).bg }} aria-hidden="true">
      {event.posterUrl && <img src={assetUrl(event.posterUrl)} alt="" loading="lazy" />}
    </span>
  )
}

// 지도 핀 — 카카오 오버레이는 React 밖이라 DOM 으로 직접 만듦 (번호는 숫자만 넣음)
function createPin(event, onPick) {
  const pin = document.createElement('button')
  pin.type = 'button'
  pin.className = 'home-pin'
  pin.style.setProperty('--pin', categoryOf(event.category).color)
  pin.setAttribute('aria-label', event.title)
  pin.addEventListener('click', onPick)
  if (event.meetupCount > 0) {
    const badge = document.createElement('span')
    badge.className = 'home-pin__badge'
    badge.textContent = String(event.meetupCount)
    pin.appendChild(badge)
  }
  return pin
}

// 지도로 보기 — 서울 전체 · 이번 주 · 위치가 있는 행사. 왼쪽 목록은 지금 지도에 보이는 행사만
export default function HomeMap() {
  const { data, loading, error } = useAsync(() => fetchEvents({ period: 'week' }), [])
  const events = useMemo(() => (data || []).filter(hasLocation), [data])

  const boxRef = useRef(null)
  const mapRef = useRef(null) // { kakao, map }
  const pinsRef = useRef(new Map()) // 행사 _id → 핀 DOM
  const [visibleIds, setVisibleIds] = useState(null) // null = 지도가 뜨기 전 (전부 보여 줌)
  const [selectedId, setSelectedId] = useState(null)
  const [mapError, setMapError] = useState(null)
  const [locateError, setLocateError] = useState(null)

  useEffect(() => {
    if (events.length === 0 || !boxRef.current) return undefined
    const box = boxRef.current
    const pins = pinsRef.current
    let cancelled = false

    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled) return
        const map = new kakao.maps.Map(box, { center: new kakao.maps.LatLng(SEOUL.lat, SEOUL.lng), level: 8 })
        const bounds = new kakao.maps.LatLngBounds()
        const overlays = events.map((event) => {
          const position = new kakao.maps.LatLng(event.location.lat, event.location.lng)
          bounds.extend(position)
          const pin = createPin(event, () => setSelectedId(event._id))
          pins.set(event._id, pin)
          return new kakao.maps.CustomOverlay({ position, content: pin, clickable: true, xAnchor: 0.5, yAnchor: 0.5 })
        })
        new kakao.maps.MarkerClusterer({ map, markers: overlays, averageCenter: true, minLevel: FOCUS_LEVEL + 1, styles: [CLUSTER_STYLE] })
        map.setBounds(bounds)

        const updateVisible = () => {
          const shown = map.getBounds()
          setVisibleIds(new Set(events.filter((e) => shown.contain(new kakao.maps.LatLng(e.location.lat, e.location.lng))).map((e) => e._id)))
        }
        kakao.maps.event.addListener(map, 'idle', updateVisible)
        updateVisible()
        mapRef.current = { kakao, map }
      })
      .catch((e) => !cancelled && setMapError(e.message))

    return () => {
      cancelled = true
      mapRef.current = null
      pins.clear()
      box.innerHTML = ''
    }
  }, [events])

  // 고른 행사 — 핀 강조하고 그쪽으로 이동
  const selected = events.find((e) => e._id === selectedId)
  useEffect(() => {
    if (!selected) return undefined
    const pin = pinsRef.current.get(selected._id)
    pin?.classList.add('is-selected')
    if (mapRef.current) {
      const { kakao, map } = mapRef.current
      if (map.getLevel() > FOCUS_LEVEL) map.setLevel(FOCUS_LEVEL)
      map.panTo(new kakao.maps.LatLng(selected.location.lat, selected.location.lng))
    }
    return () => pin?.classList.remove('is-selected')
  }, [selected])

  const locate = () => {
    setLocateError(null)
    if (!navigator.geolocation) return setLocateError('이 브라우저에서는 위치를 알 수 없어요')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mapRef.current) return
        const { kakao, map } = mapRef.current
        map.setLevel(6)
        map.panTo(new kakao.maps.LatLng(coords.latitude, coords.longitude))
      },
      () => setLocateError('위치를 가져오지 못했어요')
    )
  }

  const shown = visibleIds ? events.filter((e) => visibleIds.has(e._id)) : events

  return (
    <DataState loading={loading && !data} error={error} empty={data && events.length === 0} emptyText="이번 주에 지도로 볼 행사가 없어요">
      <section className="home-map" aria-label="지도로 보기">
        <div className="home-map__list">
          <div className="home-map__list-head">
            <span>지도에 보이는 행사</span>
            <span className="home-map__list-count">{shown.length}</span>
          </div>
          <div className="home-map__rows">
            {shown.map((event) => (
              <button
                key={event._id}
                type="button"
                className={`home-map__row${event._id === selectedId ? ' is-selected' : ''}`}
                aria-pressed={event._id === selectedId}
                onClick={() => setSelectedId(event._id)}
              >
                <Thumb event={event} width={36} height={48} />
                <span className="home-map__row-text">
                  <span className="home-map__row-title one-line">{event.title}</span>
                  <span className="home-map__row-meta one-line"><MetaLine items={[event.district, formatEventPeriod(event)]} /></span>
                </span>
                <span className={`home-map__row-meet${event.meetupCount > 0 ? ' has-meetup' : ''}`}>{event.meetupCount > 0 ? `모임 ${event.meetupCount}` : '모임 없음'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-map__canvas">
          <div ref={boxRef} className="home-map__box" role="application" aria-label="행사 지도" hidden={Boolean(mapError)} />
          {mapError ? (
            <div className="home-map__error">
              <PinIcon />
              <span>지도를 불러오지 못했어요</span>
            </div>
          ) : (
            <>
              {selected && (
                <div className="home-map__card">
                  <Thumb event={selected} width={48} height={64} />
                  <span className="home-map__card-text">
                    <span className="home-map__card-title one-line">{selected.title}</span>
                    <span className="home-map__row-meta one-line"><MetaLine items={[formatEventPeriod(selected), selected.district]} /></span>
                    {selected.meetupCount > 0 ? (
                      <Link to={`/meetup?event=${selected._id}&period=all`} className="home-map__card-link">
                        이 행사로 열린 모임 {selected.meetupCount}
                      </Link>
                    ) : (
                      <Link to={`/event/${selected._id}`} className="home-map__card-link">
                        행사 정보
                      </Link>
                    )}
                  </span>
                </div>
              )}
              <button type="button" className="home-map__locate" onClick={locate}>
                <PinIcon />
                현재 위치
              </button>
              {locateError && (
                <span className="home-map__locate-error" role="alert">
                  {locateError}
                </span>
              )}
            </>
          )}
        </div>
      </section>
    </DataState>
  )
}
