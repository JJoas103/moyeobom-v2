import { useEffect, useMemo, useState } from 'react'
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
import MetaLine from '../../components/common/MetaLine'
import { PERIODS, periodLabel } from '../../utils/period'
import '../../styles/list.css'

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

  // 서버에서 한 페이지씩 받아 쌓는다. 필터가 바뀌면 key 가 달라져 바로 1페이지로 돌아간다
  // (state 를 비우는 effect 를 쓰면 한 박자 늦어 같은 조건을 두 번 부른다)
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  const page = paging.key === filterKey ? paging.page : 1

  const { data, loading, error } = useAsync(() => fetchEvents({ ...params, page }), [filterKey, page])

  // 받은 페이지를 누적 — useAsync 는 data 를 통째로 갈아 끼우므로 쌓는 건 여기서 한다
  const [acc, setAcc] = useState({ key: filterKey, events: [], total: null, genres: [] })
  useEffect(() => {
    if (!data) return
    setAcc((prev) => ({
      key: filterKey,
      events: page === 1 || prev.key !== filterKey ? data.events : [...prev.events, ...data.events],
      total: data.total,
      genres: data.genres,
    }))
    // filterKey · page 는 이 응답이 어느 조건 · 몇 페이지의 것인지 가리킨다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const fresh = acc.key === filterKey
  const events = fresh ? acc.events : []
  const total = fresh ? acc.total : null
  const hasMore = total !== null && events.length < total

  // 분야 선택지 — 서버가 분야 조건 전 기준으로 내려준다 (고른 분야만 남지 않게)
  const genreOptions = useMemo(() => {
    const set = new Set(fresh ? acc.genres : [])
    if (genre) set.add(genre)
    return [{ value: '', label: '전체 분야' }, ...[...set].sort().map((g) => ({ value: g, label: g }))]
  }, [acc.genres, fresh, genre])

  const resetAll = () => {
    setQ('')
    filters.reset()
  }

  const firstLoad = loading && events.length === 0

  return (
    <div className="list-page">
      <div className="page-head">
        <h1>
          행사<span className="count">{total ?? ''}</span>
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
        <MetaLine items={[district || '서울 전체', periodLabel(period), '곧 끝나는 순']} />
        {loading && events.length > 0 && <span className="list-summary__loading meta-item"> 불러오는 중</span>}
      </p>

      <DataState
        loading={firstLoad}
        error={error}
        empty={!loading && events.length === 0}
        emptyText={<EmptyResult title="조건에 맞는 행사가 없어요" onReset={resetAll} />}
      >
        <div className={`card-grid${loading ? ' is-refreshing' : ''}`}>
          {events.map((e) => (
            <EventCard key={e._id} event={e} />
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            className="btn btn--line list-more"
            disabled={loading}
            onClick={() => setPaging({ key: filterKey, page: page + 1 })}
          >
            {loading ? '불러오는 중...' : `행사 더 보기 (${events.length}/${total})`}
          </button>
        )}
      </DataState>
    </div>
  )
}
