import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import koLocale from '@fullcalendar/core/locales/ko'
import { bandsOn, parseSessions, talkAvailableFrom } from '../../utils/sessions'
import { fromLocalInput } from '../../utils/datetime'

const DAY = 24 * 60 * 60 * 1000
const PICK_MINUTES = 30 // 고른 시각 표시 블록 길이 (이야기 자리는 끝나는 시각이 없다 — 보이게만)

const STATUS_NOTE = {
  full: null,
  partial: '회차 일부만 표시 · 위 원문 확인 필요',
  none: '회차 표시 불가 · 위 원문 확인 필요',
}

/**
 * 모임 만들기 › 이야기 자리 시각 — 주간 시간표 (FullCalendar timeGrid)
 *   형광펜 띠 = 행사 회차 · 운영 시간 (utils/sessions.js 가 sessionsText 를 읽어서). **보여 주기만** 한다
 *   칸을 누르면 그 시각(10분 단위)이 이야기 자리 시각이 된다 → onChange(Date)
 *   회색 = 고를 수 없는 시각 — 그날 행사 시간이 끝나기 전(sessions.talkAvailableFrom) · 오늘의 지난 시각
 * 저장하는 값은 시작 시각 하나라 범위를 끌어 고르는 기능은 없다. 키보드로는 아래 입력칸(라벨 '이야기 자리 시각', 화면에선 숨김)을 쓴다
 * value 는 폼 값 그대로('YYYY-MM-DDTHH:mm') — Date 로 받으면 렌더마다 새 객체라 띠를 매번 다시 계산한다
 */
export default function TalkCalendar({ event, value: valueInput, onChange }) {
  const ref = useRef(null)
  const value = useMemo(() => fromLocalInput(valueInput), [valueInput])
  const parsed = useMemo(() => parseSessions(event.sessionsText), [event.sessionsText])
  const [range, setRange] = useState(null) // 지금 보이는 주 { start, end }

  // 직접 입력으로 다른 주를 고르면 그 주로 넘긴다
  useEffect(() => {
    const api = ref.current?.getApi()
    if (!api || !value) return
    const { activeStart, activeEnd } = api.view
    if (value < activeStart || value >= activeEnd) api.gotoDate(value)
  }, [value])

  // 그날 이 시각 전은 못 고른다 — null 이면 제한 없음
  const blockedUntil = (date) => {
    const now = new Date()
    const from = talkAvailableFrom(event, date, parsed)
    const today = new Date(date).toDateString() === now.toDateString() ? now : null
    if (!from && !today) return null
    return new Date(Math.max(from?.getTime() || 0, today?.getTime() || 0))
  }

  const events = useMemo(() => {
    const out = []
    if (range) {
      for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY) {
        const until = blockedUntil(new Date(t))
        if (until) {
          out.push({ start: new Date(t), end: until, display: 'background', classNames: ['talk-cal__blocked'] })
        }
        for (const b of bandsOn(parsed, event, new Date(t))) {
          out.push({
            start: b.start,
            end: b.end,
            display: 'background',
            title: b.guessed ? `${b.label} · 끝 어림` : b.label,
            classNames: [`talk-cal__band`, `talk-cal__band--${b.kind}`, b.guessed ? 'is-guessed' : ''],
          })
        }
      }
    }
    if (value) {
      out.push({
        start: value,
        end: new Date(value.getTime() + PICK_MINUTES * 60 * 1000),
        title: '이야기 자리',
        classNames: ['talk-cal__pick'],
      })
    }
    return out
    // blockedUntil 은 parsed · event 로만 정해진다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, parsed, event, value])

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
          <span className="talk-cal__swatch talk-cal__swatch--blocked" aria-hidden="true" />
          선택 불가
        </span>
        <span className="talk-cal__key">
          <span className="talk-cal__swatch talk-cal__swatch--pick" aria-hidden="true" />
          고른 시각
        </span>
        <span className="talk-cal__tip">칸을 눌러 선택</span>
      </div>
      {note && <p className="talk-cal__note">{note}</p>}

      <FullCalendar
        ref={ref}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={value || today}
        locale={koLocale}
        firstDay={1}
        headerToolbar={{ left: 'title', center: '', right: 'today prev,next' }}
        validRange={{ start: today }}
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        snapDuration="00:10:00"
        slotLabelInterval="01:00"
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        dayHeaderFormat={{ month: 'numeric', day: 'numeric', weekday: 'short' }}
        scrollTime={value ? `${String(Math.max(value.getHours() - 3, 8)).padStart(2, '0')}:00:00` : '14:00:00'}
        height={520}
        nowIndicator
        expandRows
        events={events}
        datesSet={(info) => setRange({ start: info.start, end: info.end })}
        dateClick={(info) => {
          const until = blockedUntil(info.date)
          if (!until || info.date >= until) onChange(info.date)
        }}
      />
    </div>
  )
}
