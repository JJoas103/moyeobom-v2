import { useMemo, useState } from 'react'
import CategoryChips from '../../components/common/CategoryChips'
import FilterMenu from '../../components/common/FilterMenu'
import Switch from '../../components/common/Switch'
import SearchInput from '../../components/common/SearchInput'
import DataState from '../../components/common/DataState'
import EventCard from '../../components/event/EventCard'
import EmptyResult from '../../components/common/EmptyResult'
import { useAsync } from '../../utils/useAsync'
import { useDebounced } from '../../utils/useDebounced'
import { useQueryFilters } from '../../utils/useQueryFilters'
import { fetchEvents } from '../../data/events'
import { SEOUL_DISTRICTS } from '../../data/constants'
import { PERIODS, periodLabel } from '../../utils/period'
import '../../styles/list.css'

const PAGE_SIZE = 15
const DEFAULT_PERIOD = 'week'

const DISTRICT_OPTIONS = [{ value: '', label: '서울 전체' }, ...SEOUL_DISTRICTS.map((d) => ({ value: d, label: d }))]
const PERIOD_OPTIONS = PERIODS.map((p) => ({ value: p.key, label: p.label }))

// 시안 v2 · 행사 목록 (V2Explore)
export default function EventList() {
  // 필터는 주소(?category=play&district=종로구)에 저장 → 상세 갔다가 뒤로 와도 유지
  const filters = useQueryFilters()
  const category = filters.get('category')
  const district = filters.get('district')
  const genre = filters.get('genre')
  const periodParam = filters.has('period') ? filters.get('period') : null
  const period = periodParam === null ? DEFAULT_PERIOD : periodParam === 'all' ? '' : periodParam
  const hasMeetup = filters.get('hasMeetup') === '1'

  const [q, setQ] = useState(filters.get('q'))
  const keyword = useDebounced(q)

  const params = { category, district, genre, period, hasMeetup, q: keyword }
  const filterKey = JSON.stringify(params)
  const { data: events, loading, error } = useAsync(() => fetchEvents(params), [filterKey])

  // 분야 선택지용 — 분야를 고른 상태면 분야 조건만 빼고 다시 조회 (고른 분야만 남지 않게)
  const genreParams = { ...params, genre: '' }
  const genreKey = genre ? JSON.stringify(genreParams) : ''
  const { data: genreSource } = useAsync(() => (genre ? fetchEvents(genreParams) : Promise.resolve(null)), [genreKey])

  // '행사 더 보기' — 필터가 바뀌면 다시 15개부터
  const [shown, setShown] = useState({ key: filterKey, count: PAGE_SIZE })
  const visibleCount = shown.key === filterKey ? shown.count : PAGE_SIZE

  // 분야 선택지 = 분야 조건을 뺀 결과에 있는 세부 장르
  const genreOptions = useMemo(() => {
    const source = genre ? genreSource : events
    const set = new Set((source || []).map((e) => e.genre).filter(Boolean))
    if (genre) set.add(genre)
    return [{ value: '', label: '전체 분야' }, ...[...set].sort().map((g) => ({ value: g, label: g }))]
  }, [events, genreSource, genre])

  const resetAll = () => {
    setQ('')
    filters.reset()
  }

  const firstLoad = loading && !events

  return (
    <div className="list-page">
      <div className="page-head">
        <h1>
          행사<span className="count">{events ? events.length : ''}</span>
        </h1>
        <span className="spacer" />
        <SearchInput value={q} onChange={setQ} placeholder="행사 이름으로 찾기" label="행사 검색" />
      </div>

      <CategoryChips value={category} onChange={(v) => filters.set('category', v, { clear: ['genre'] })} />

      <div className="filter-bar">
        <FilterMenu label="지역" value={district} options={DISTRICT_OPTIONS} onChange={(v) => filters.set('district', v)} />
        <FilterMenu label="분야" value={genre} options={genreOptions} onChange={(v) => filters.set('genre', v)} />
        <FilterMenu label="기간" value={period} options={PERIOD_OPTIONS} onChange={(v) => filters.set('period', v || 'all')} />
        <FilterMenu label="비용" disabledNote="비용 필터 기준은 아직 정하는 중이에요." />
        <span className="spacer" />
        <Switch label="모임 있는 행사만" checked={hasMeetup} onChange={(v) => filters.set('hasMeetup', v ? '1' : '')} />
      </div>

      <p className="list-summary">
        {district || '서울 전체'} · {periodLabel(period)} · 모임이 많은 순
        {loading && events && <span className="list-summary__loading"> · 불러오는 중</span>}
      </p>

      <DataState loading={firstLoad} error={error} empty={events?.length === 0} emptyText={<EmptyResult title="조건에 맞는 행사가 없어요" onReset={resetAll} />}>
        <div className={`card-grid${loading ? ' is-refreshing' : ''}`}>
          {events?.slice(0, visibleCount).map((e) => (
            <EventCard key={e._id} event={e} />
          ))}
        </div>

        {events && events.length > visibleCount && (
          <button
            type="button"
            className="btn btn--line list-more"
            onClick={() => setShown({ key: filterKey, count: visibleCount + PAGE_SIZE })}
          >
            행사 더 보기
          </button>
        )}
      </DataState>
    </div>
  )
}
