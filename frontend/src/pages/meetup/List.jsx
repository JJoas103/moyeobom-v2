import { useState } from 'react'
import { Link } from 'react-router-dom'
import CategoryChips from '../../components/common/CategoryChips'
import FilterMenu from '../../components/common/FilterMenu'
import Switch from '../../components/common/Switch'
import SearchInput from '../../components/common/SearchInput'
import DataState from '../../components/common/DataState'
import EmptyResult from '../../components/common/EmptyResult'
import MeetupCard from '../../components/meetup/MeetupCard'
import { useAsync } from '../../utils/useAsync'
import { useDebounced } from '../../utils/useDebounced'
import { useQueryFilters } from '../../utils/useQueryFilters'
import { fetchMeetups } from '../../data/meetups'
import { BUDGETS, JOIN_KIND, SEOUL_DISTRICTS } from '../../data/constants'
import { PERIODS, periodLabel } from '../../utils/period'
import '../../styles/list.css'

const PAGE_SIZE = 15
const DEFAULT_PERIOD = 'week'

const DISTRICT_OPTIONS = [{ value: '', label: '서울 전체' }, ...SEOUL_DISTRICTS.map((d) => ({ value: d, label: d }))]
const PERIOD_OPTIONS = PERIODS.map((p) => ({ value: p.key, label: p.label }))
const JOIN_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'watch', label: JOIN_KIND.watch },
  { value: 'talk', label: JOIN_KIND.talk },
]
const ALCOHOL_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'no', label: '술 없음' },
  { value: 'yes', label: '술 있음' },
]
const BUDGET_OPTIONS = [{ value: '', label: '전체' }, ...BUDGETS.map((b) => ({ value: b.key, label: b.label }))]

// 시안 v2 · 모임 목록 (V2MeetupList)
export default function MeetupList() {
  const filters = useQueryFilters()
  const category = filters.get('category')
  const district = filters.get('district')
  const period = !filters.has('period') ? DEFAULT_PERIOD : filters.get('period') === 'all' ? '' : filters.get('period')
  const joinType = filters.get('joinType')
  const alcohol = filters.get('alcohol')
  const budget = filters.get('budget')
  const openOnly = filters.get('openOnly') === '1'
  const eventId = filters.get('event') // 행사 상세의 '모임 모두 보기'에서 넘어올 때

  const [q, setQ] = useState(filters.get('q'))
  const keyword = useDebounced(q)

  const params = { eventId, category, district, period, joinType, alcohol, budget, openOnly, q: keyword }
  const filterKey = JSON.stringify(params)
  const { data: meetups, loading, error } = useAsync(() => fetchMeetups(params), [filterKey])

  const [shown, setShown] = useState({ key: filterKey, count: PAGE_SIZE })
  const visibleCount = shown.key === filterKey ? shown.count : PAGE_SIZE

  const resetAll = () => {
    setQ('')
    filters.reset()
  }

  return (
    <div className="list-page">
      <div className="page-head">
        <h1>
          모임<span className="count">{meetups ? meetups.length : ''}</span>
        </h1>
        <span className="spacer" />
        <SearchInput value={q} onChange={setQ} placeholder="모임이나 행사 이름으로 찾기" label="모임 검색" width={340} />
        <Link to="/meetup/new" className="btn btn--primary">
          모임 만들기
        </Link>
      </div>

      <CategoryChips value={category} onChange={(v) => filters.set('category', v)} />

      <div className="filter-bar">
        <FilterMenu label="지역" value={district} options={DISTRICT_OPTIONS} onChange={(v) => filters.set('district', v)} />
        <FilterMenu label="기간" value={period} options={PERIOD_OPTIONS} onChange={(v) => filters.set('period', v || 'all')} />
        <FilterMenu label="참여 방식" value={joinType} options={JOIN_OPTIONS} onChange={(v) => filters.set('joinType', v)} />
        <FilterMenu label="술" value={alcohol} options={ALCOHOL_OPTIONS} onChange={(v) => filters.set('alcohol', v)} />
        <FilterMenu label="예산" value={budget} options={BUDGET_OPTIONS} onChange={(v) => filters.set('budget', v)} />
        <span className="spacer" />
        <Switch label="모집 중만 보기" checked={openOnly} onChange={(v) => filters.set('openOnly', v ? '1' : '')} />
      </div>

      {eventId && (
        <div className="event-filter">
          <span>
            <strong>{meetups?.[0]?.event?.title || '선택한 행사'}</strong> 모임만 보는 중
          </span>
          <button type="button" className="chip chip--outline" onClick={() => filters.set('event', '')}>
            행사 필터 해제 ✕
          </button>
        </div>
      )}

      <p className="list-summary">
        {district || '서울 전체'} · {periodLabel(period)} · 가까운 날짜순
        {loading && meetups && <span className="list-summary__loading"> · 불러오는 중</span>}
      </p>

      <DataState
        loading={loading && !meetups}
        error={error}
        empty={meetups?.length === 0}
        emptyText={
          <EmptyResult
            title="조건에 맞는 모임이 없어요"
            hint="필터를 줄이거나, 보고 싶은 행사로 직접 모임을 열어 보세요."
            onReset={resetAll}
            action={
              <Link to="/meetup/new" className="btn btn--primary">
                모임 만들기
              </Link>
            }
          />
        }
      >
        <div className={`card-grid${loading ? ' is-refreshing' : ''}`}>
          {meetups?.slice(0, visibleCount).map((m) => (
            <MeetupCard key={m._id} meetup={m} />
          ))}
        </div>

        {meetups && meetups.length > visibleCount && (
          <button
            type="button"
            className="btn btn--line list-more"
            onClick={() => setShown({ key: filterKey, count: visibleCount + PAGE_SIZE })}
          >
            모임 더 보기
          </button>
        )}
      </DataState>
    </div>
  )
}
