import { useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../common/Avatar'
import MiniPoster from '../common/MiniPoster'
import { SearchIcon } from '../common/Icons'
import { formatRoomTime } from '../../utils/format'

const TABS = [
  { key: 'all', label: '전체' },
  { key: 'meetup', label: '모임' },
  { key: 'direct', label: '친구 1:1' },
]

/** 채팅 왼쪽 — 탭 · 방 찾기 · 방 목록 (닫힌 모임 방은 흐리게) */
export default function RoomList({ rooms, error, currentId }) {
  // 처음 탭은 지금 연 방 종류 따라 (친구 1:1 방에서 들어오면 친구 탭)
  const current = rooms?.find((r) => r._id === currentId)
  const [tab, setTab] = useState(null)
  const [query, setQuery] = useState('')
  const activeTab = tab || (current?.type === 'direct' ? 'direct' : 'all')

  const keyword = query.trim()
  const shown = (rooms || [])
    .filter((r) => activeTab === 'all' || r.type === activeTab)
    .filter((r) => !keyword || r.title.includes(keyword) || r.meetup?.event?.title?.includes(keyword))

  return (
    <aside className="room-list">
      <div className="room-list__head">
        <span className="room-list__title">채팅</span>
        <div className="seg-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={`seg-tabs__tab${activeTab === t.key ? ' is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="room-list__search">
          <span className="room-list__search-icon">
            <SearchIcon />
          </span>
          <span className="sr-only">채팅방 찾기</span>
          <input placeholder="채팅방 찾기" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="room-list__items">
        {error && <p className="room-list__empty">{error.message}</p>}
        {!error && !rooms && <p className="room-list__empty">불러오는 중...</p>}
        {rooms && shown.length === 0 && (
          <p className="room-list__empty">
            {keyword ? '찾는 채팅방이 없어요.' : activeTab === 'direct' ? '아직 친구와 나눈 대화가 없어요.' : '아직 들어간 채팅방이 없어요.'}
          </p>
        )}
        {shown.map((room) => (
          <Link
            key={room._id}
            to={`/chat/${room._id}`}
            className={`room-item${room._id === currentId ? ' is-current' : ''}${room.closed ? ' is-closed' : ''}`}
            aria-current={room._id === currentId ? 'page' : undefined}
          >
            {room.type === 'meetup' ? <MiniPoster meetup={room.meetup} /> : <Avatar user={room.partner} size={44} />}
            <span className="room-item__text">
              <span className="room-item__row">
                <span className="room-item__title one-line">{room.title}</span>
                {room.lastMessage && <span className="room-item__time">{formatRoomTime(room.lastMessage.at)}</span>}
              </span>
              <span className="room-item__row">
                <span className="room-item__last one-line">
                  {room.closed && room.type === 'meetup' ? '읽기 전용 · ' : ''}
                  {room.lastMessage?.text || '아직 대화가 없어요'}
                </span>
                {room.unread > 0 && room._id !== currentId && <span className="count-badge">{room.unread}</span>}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </aside>
  )
}
