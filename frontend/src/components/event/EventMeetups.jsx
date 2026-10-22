import { useState } from 'react'
import SectionHead from '../common/SectionHead'
import Switch from '../common/Switch'
import MeetupCard from '../meetup/MeetupCard'
import { JOIN_KIND } from '../../data/constants'
import { meetupStatus } from '../../utils/status'

const MEETUP_PREVIEW = 6

const KIND_FILTERS = [
  { key: '', label: '전체' },
  { key: 'watch', label: JOIN_KIND.watch },
  { key: 'talk', label: JOIN_KIND.talk },
]

// 행사 상세 '이 행사로 열린 모임' — 참여 방식 · 모집 중만 필터, 최대 6개
export default function EventMeetups({ event, meetups, loading }) {
  const [kind, setKind] = useState('')
  const [openOnly, setOpenOnly] = useState(false)

  const filtered = (meetups || [])
    .filter((m) => !kind || (kind === 'watch') === Boolean(m.watch?.enabled))
    .filter((m) => !openOnly || meetupStatus(m).tone !== 'closed')

  const total = meetups?.length ?? event.meetupCount

  return (
    <section className="detail-section">
      <SectionHead
        title="이 행사로 열린 모임"
        count={total}
        moreTo={total > MEETUP_PREVIEW ? `/meetup?event=${event._id}&period=all` : null}
        moreLabel={`모임 ${total}개 모두 보기`}
      />

      {total > 0 && (
        <div className="section-tools">
          <div className="chip-row" role="group" aria-label="참여 방식">
            {KIND_FILTERS.map((k) => (
              <button
                key={k.key || 'all'}
                type="button"
                className={`chip${kind === k.key ? ' is-active' : ''}`}
                aria-pressed={kind === k.key}
                onClick={() => setKind(k.key)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <span className="spacer" />
          <Switch label="모집 중만 보기" checked={openOnly} onChange={setOpenOnly} />
        </div>
      )}

      {loading && !meetups ? (
        <div className="state-box">불러오는 중...</div>
      ) : total === 0 ? (
        <div className="empty-inline">
          <strong>아직 이 행사로 열린 모임이 없어요</strong>
          <span>첫 모임을 열면 이 행사를 본 사람들이 찾아올 수 있어요.</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-inline">조건에 맞는 모임이 없어요</div>
      ) : (
        <div className="card-grid card-grid--3">
          {filtered.slice(0, MEETUP_PREVIEW).map((m) => (
            <MeetupCard key={m._id} meetup={m} variant="inEvent" />
          ))}
        </div>
      )}
    </section>
  )
}
