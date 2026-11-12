import { useEffect, useId, useRef, useState } from 'react'
import { loadKakaoMaps } from '../../utils/loadKakaoMaps'
import { PinIcon } from '../common/Icons'

const RESULT_MAX = 6
const SEARCH_DELAY = 300

/**
 * 이야기 자리 장소 — 카카오맵 장소 검색 (kakao.maps.services.Places.keywordSearch)
 *   value: { place, address, location } · onChange(같은 모양)
 *   near: 행사장 좌표 — 결과를 그 근처부터 보여 준다 (없으면 정확도 순)
 * SDK 를 못 쓰면(키 없음 · 도메인 미등록 · 네트워크) 이름만 직접 입력하는 칸으로 바뀐다.
 * 검색 결과에 없는 곳도 '직접 입력'으로 넣을 수 있다 — 그때는 주소 · 좌표가 비고 동네는 이름에서 어림한다
 */
export default function PlaceSearch({ value, onChange, near, invalid }) {
  const listId = useId()
  const [sdk, setSdk] = useState('loading') // 'loading' | 'ready' | 'failed'
  const [manual, setManual] = useState(() => Boolean(value.place) && !value.location)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null) // null = 아직 안 찾음
  const placesRef = useRef(null)

  useEffect(() => {
    let alive = true
    loadKakaoMaps()
      .then((kakao) => {
        if (!alive) return
        if (!kakao.maps.services) throw new Error('services 없음')
        placesRef.current = new kakao.maps.services.Places()
        setSdk('ready')
      })
      .catch(() => alive && setSdk('failed'))
    return () => {
      alive = false
    }
  }, [])

  // 입력을 멈추면 찾는다
  useEffect(() => {
    const q = query.trim()
    if (sdk !== 'ready' || q.length < 2) return undefined
    const timer = setTimeout(() => {
      const { kakao } = window
      const options = { size: RESULT_MAX }
      if (near?.lat && near?.lng) options.location = new kakao.maps.LatLng(near.lat, near.lng)
      placesRef.current.keywordSearch(
        q,
        (data, status) => {
          if (status === kakao.maps.services.Status.OK) setResults(data.slice(0, RESULT_MAX))
          else setResults([])
        },
        options,
      )
    }, SEARCH_DELAY)
    return () => clearTimeout(timer)
  }, [query, sdk, near?.lat, near?.lng])

  const pick = (r) => {
    onChange({
      place: r.place_name,
      address: r.road_address_name || r.address_name,
      location: { lat: Number(r.y), lng: Number(r.x) },
      lotAddress: r.address_name, // 동 이름 어림용 — 저장하지 않음
    })
    setQuery('')
    setResults(null)
  }

  const reset = () => {
    onChange({ place: '', address: '', location: null })
    setManual(false)
  }

  // 직접 입력 — SDK 를 못 쓰거나, 검색 결과에 없는 곳
  if (sdk === 'failed' || manual) {
    return (
      <div className="place-search">
        <input
          className="input"
          value={value.place}
          placeholder="예: 혜화역 2번 출구 근처 OO카페"
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange({ place: e.target.value, address: '', location: null })}
        />
        <span className="place-search__note">
          {sdk === 'failed' ? '장소 검색을 쓸 수 없어 직접 입력' : '직접 입력 · 주소 없이 이름만 저장'}
          {sdk === 'ready' && (
            <>
              {' · '}
              <button type="button" className="link-btn" onClick={reset}>
                검색으로 찾기
              </button>
            </>
          )}
        </span>
      </div>
    )
  }

  // 고른 장소
  if (value.place && value.location) {
    return (
      <div className="place-search">
        <div className="place-pick">
          <PinIcon />
          <span className="place-pick__text">
            <strong>{value.place}</strong>
            {value.address && <span>{value.address}</span>}
          </span>
          <button type="button" className="btn btn--line place-pick__change" onClick={reset}>
            다시 찾기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="place-search">
      <input
        className="input"
        type="search"
        role="combobox"
        aria-expanded={Boolean(results?.length)}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        value={query}
        placeholder={sdk === 'loading' ? '장소 검색 준비 중…' : '카페 · 식당 이름이나 주소로 찾기'}
        disabled={sdk === 'loading'}
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value.trim().length < 2) setResults(null)
        }}
      />
      {results && (
        <ul id={listId} className="place-results" role="listbox" aria-label="장소 검색 결과">
          {results.length === 0 ? (
            <li className="place-results__empty">검색 결과 없음</li>
          ) : (
            results.map((r) => (
              <li key={r.id} role="option" aria-selected="false">
                <button type="button" className="place-results__item" onClick={() => pick(r)}>
                  <strong>{r.place_name}</strong>
                  <span>
                    {r.road_address_name || r.address_name}
                    {r.category_group_name && ` · ${r.category_group_name}`}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <span className="place-search__note">
        찾는 곳이 없으면{' '}
        <button type="button" className="link-btn" onClick={() => setManual(true)}>
          직접 입력
        </button>
      </span>
    </div>
  )
}
