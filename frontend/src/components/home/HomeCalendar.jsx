import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataState from '../common/DataState'
import { ChevronLeftIcon, ChevronRightIcon } from '../common/Icons'
import MetaLine from '../common/MetaLine'
import EventCard from '../event/EventCard'
import { useAsync } from '../../utils/useAsync'
import { fetchEvents } from '../../data/events'
import { fetchMeetups } from '../../data/meetups'
import { dayKey, periodRange } from '../../utils/period'
import { formatTodayTitle } from '../../utils/format'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const PAGE_SIZE = 4

const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1)

// 달력 칸 — 1일 앞 빈칸(null) + 그 달의 날짜
function monthCells(month) {
  const blanks = Array.from({ length: month.getDay() }, () => null)
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return [...blanks, ...Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
}

// 빠른 선택은 기존 기간 필터와 같은 규칙 → 행사 목록으로 이어짐
function presetRange(key) {
  const [from, to] = periodRange(key)
  return { preset: key, from: dayKey(from), to: dayKey(to) }
}

const PRESETS = [
  { key: 'today', label: '오늘' },
  { key: 'weekend', label: '이번 주말' },
]

// 달력으로 보기 — 날짜(또는 오늘 · 이번 주말)를 고르면 그때 열리는 행사와 모임 수. 지난날은 고를 수 없음
export default function HomeCalendar() {
  const today = useMemo(() => new Date(), [])
  const todayKey = dayKey(today)
  const thisMonth = firstOfMonth(today)
  const [month, setMonth] = useState(thisMonth)
  const [selection, setSelection] = useState(() => presetRange('today'))
  const [page, setPage] = useState({ key: '', index: 0 })

  const { from, to, preset } = selection
  const rangeKey = `${from}~${to}`

  // 고른 날짜 범위라 건수가 적다. 아래에서 화면 쪽으로 다시 나누므로 서버 상한만큼 한 번에 받는다
  const events = useAsync(() => fetchEvents({ from, to, limit: 50 }), [rangeKey])
  const meetups = useAsync(() => fetchMeetups({ from, to }), [rangeKey])

  // 달력의 점 — 그 달에 모임이 있는 날 (시작 전 모임만)
  const monthKey = dayKey(month)
  const monthMeetups = useAsync(
    () => fetchMeetups({ from: monthKey, to: dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)) }),
    [monthKey]
  )
  const meetupDays = useMemo(() => new Set((monthMeetups.data || []).map((m) => dayKey(new Date(m.talk.startAt)))), [monthMeetups.data])

  const pickPreset = (key) => {
    const next = presetRange(key)
    setSelection(next)
    setMonth(firstOfMonth(new Date(`${next.from}T00:00:00`)))
  }

  const list = events.data?.events || []
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  // 고른 날짜가 바뀌면 첫 쪽부터
  const pageIndex = page.key === rangeKey ? Math.min(page.index, pageCount - 1) : 0
  const goPage = (index) => setPage({ key: rangeKey, index })

  const title = from === to ? formatTodayTitle(new Date(`${from}T00:00:00`)) : `${formatTodayTitle(new Date(`${from}T00:00:00`))} – ${formatTodayTitle(new Date(`${to}T00:00:00`))}`

  return (
    <section className="home-cal" aria-label="달력으로 보기">
      <div className="home-cal__panel">
        <div className="home-cal__presets" role="radiogroup" aria-label="기간">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" role="radio" aria-checked={preset === p.key} className={`home-cal__preset${preset === p.key ? ' is-on' : ''}`} onClick={() => pickPreset(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="home-cal__month">
          <button type="button" className="home-cal__arrow" aria-label="이전 달" disabled={month <= thisMonth} onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeftIcon />
          </button>
          <span className="home-cal__month-label">
            {month.getFullYear()}.{String(month.getMonth() + 1).padStart(2, '0')}
          </span>
          <button type="button" className="home-cal__arrow" aria-label="다음 달" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRightIcon />
          </button>
        </div>

        <div className="home-cal__week" aria-hidden="true">
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="home-cal__days">
          {monthCells(month).map((date, i) => {
            if (!date) return <span key={`blank-${i}`} />
            const key = dayKey(date)
            const selected = key >= from && key <= to
            const hasMeetup = meetupDays.has(key)
            return (
              <button
                key={key}
                type="button"
                className={`home-cal__day${selected ? ' is-selected' : ''}`}
                disabled={key < todayKey}
                aria-pressed={selected}
                aria-label={`${date.getMonth() + 1}월 ${date.getDate()}일${hasMeetup ? ', 모임 있음' : ''}`}
                onClick={() => setSelection({ preset: key === todayKey ? 'today' : null, from: key, to: key })}
              >
                <span className="home-cal__num">{date.getDate()}</span>
                <span className={`home-cal__dot${hasMeetup ? ' is-on' : ''}`} />
              </button>
            )
          })}
        </div>
        <span className="home-cal__legend">
          <span className="home-cal__dot is-on" />
          모임
        </span>
      </div>

      <div className="home-cal__result">
        <div className="home-cal__head">
          <span className="home-cal__title">{title}</span>
          <span className="home-cal__counts">
            <MetaLine items={[`행사 ${events.data?.total ?? '-'}`, `모임 ${meetups.data?.length ?? '-'}`]} />
          </span>
          <span className="spacer" />
          {preset && (
            <Link to={`/event?period=${preset}`} className="section-head__more">
              {preset === 'today' ? '오늘' : '이번 주말'} 행사 전체
            </Link>
          )}
        </div>

        <DataState loading={events.loading && !events.data} error={events.error} empty={events.data?.total === 0} emptyText="이 날 열리는 행사가 없어요">
          <div className={`home-cal__grid${events.loading ? ' is-refreshing' : ''}`}>
            {list.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE).map((e) => (
              <EventCard key={e._id} event={e} />
            ))}
          </div>
          {pageCount > 1 && (
            <div className="home-cal__pager">
              <span className="home-cal__progress" aria-hidden="true">
                <span style={{ width: `${((pageIndex + 1) / pageCount) * 100}%` }} />
              </span>
              <span className="home-cal__page">
                {pageIndex + 1} / {pageCount}
              </span>
              <button type="button" className="home-cal__nav" aria-label="이전" disabled={pageIndex === 0} onClick={() => goPage(pageIndex - 1)}>
                <ChevronLeftIcon />
              </button>
              <button type="button" className="home-cal__nav" aria-label="다음" disabled={pageIndex === pageCount - 1} onClick={() => goPage(pageIndex + 1)}>
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </DataState>
      </div>
    </section>
  )
}
