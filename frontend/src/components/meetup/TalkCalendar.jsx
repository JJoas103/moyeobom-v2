import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import koLocale from '@fullcalendar/core/locales/ko'
import { bandsOn, parseSessions } from '../../utils/sessions'
import { fromLocalInput } from '../../utils/datetime'

const DAY = 24 * 60 * 60 * 1000

const STATUS_NOTE = {
  full: null,
  partial: '회차 일부만 표시 · 위 원문 확인 필요',
  none: '회차 표시 불가 · 위 원문 확인 필요',
}

const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString()

/**
 * 모임 만들기 › 이야기 자리 날짜 — 월 달력 (FullCalendar dayGrid)
 *   날짜 칸마다 그날 행사 시간을 형광펜 칩으로 보여 준다 (utils/sessions.js). 보여 주기만 하고 막지 않는다
 *   칸을 누르면 그 날짜 → onPickDate(Date). 시각은 MeetupForm 입력칸에서 고른다
 * value 는 폼 값 그대로('YYYY-MM-DDTHH:mm') — Date 로 받으면 렌더마다 새 객체라 칩을 매번 다시 계산한다
 */
export default function TalkCalendar({ event, value: valueInput, onPickDate }) {
  const ref = useRef(null)
  const value = useMemo(() => fromLocalInput(valueInput), [valueInput])
  const parsed = useMemo(() => parseSessions(event.sessionsText), [event.sessionsText])
  const [range, setRange] = useState(null) // 지금 보이는 달(앞뒤 주 포함) { start, end }

  // 직접 입력으로 다른 달을 고르면 그 달로 넘긴다
  useEffect(() => {
    const api = ref.current?.getApi()
    if (!api || !value) return
    const { activeStart, activeEnd } = api.view
    if (value < activeStart || value >= activeEnd) api.gotoDate(value)
  }, [value])

  const events = useMemo(() => {
    const out = []
    if (range) {
      for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY) {
        for (const b of bandsOn(parsed, event, new Date(t))) {
          out.push({
            start: b.start,
            end: b.end,
            title: b.kind === 'open' ? b.label : b.label.replace(' 회차', ''),
            allDay: false,
            classNames: ['talk-cal__band', `talk-cal__band--${b.kind}`],
          })
        }
      }
    }
    return out
  }, [range, parsed, event])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isPeriod = event.runType === 'period'
  const note = event.sessionsText ? STATUS_NOTE[parsed.status] : null

  return (
    <div className="talk-cal">
      <div className="talk-cal__legend">
        {parsed.status !== 'none' && (
          <span className="talk-cal__key">
            <span className={`talk-cal__swatch talk-cal__swatch--${isPeriod ? 'open' : 'session'}`} aria-hidden="true" />
            {isPeriod ? '운영 시간' : '행사 회차'}
          </span>
        )}
        <span className="talk-cal__key">
          <span className="talk-cal__swatch talk-cal__swatch--pick" aria-hidden="true" />
          고른 날
        </span>
        <span className="talk-cal__tip">날짜를 눌러 선택</span>
      </div>
      {note && <p className="talk-cal__note">{note}</p>}

      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        initialDate={value || today}
        locale={koLocale}
        headerToolbar={{ left: 'title', center: '', right: 'today prev,next' }}
        validRange={{ start: today }}
        fixedWeekCount={false}
        height="auto"
        dayMaxEvents={3}
        displayEventTime={false}
        eventDisplay="block"
        events={events}
        datesSet={(info) => setRange({ start: info.start, end: info.end })}
        dayCellClassNames={(arg) => (sameDay(arg.date, value) ? ['is-picked'] : [])}
        dateClick={(info) => onPickDate(info.date)}
      />
    </div>
  )
}
