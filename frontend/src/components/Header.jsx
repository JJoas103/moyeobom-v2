import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocketEvent } from '../context/SocketContext'
import { BellIcon, ChatIcon } from './common/Icons'
import { fetchUnreadCount } from '../data/chat'
import { fetchNotifications, fetchUnreadCount as fetchNotifyCount, markRead } from '../data/notifications'
import { formatMeetupWhen } from '../utils/format'
import { profileImageUrl } from '../utils/user'

const NAV = [
  { to: '/', label: '홈', end: true },
  { to: '/event', label: '행사' },
  { to: '/meetup', label: '모임' },
  { to: '/my/meetups', label: '내 모임' },
  { to: '/friends', label: '친구' },
  { to: '/my', label: '마이', end: true },
]

export default function Header() {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__logo">
          모여봄
        </Link>

        <nav className="site-nav" aria-label="주 메뉴">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <span className="spacer" />

        {user ? (
          <>
            <ChatButton />
            <BellButton />
            <UserMenu user={user} />
          </>
        ) : (
          <Link to="/member/login" state={{ from: location.pathname + location.search }} className="btn btn--line btn--sm">
            로그인
          </Link>
        )}
      </div>
    </header>
  )
}

// 채팅 아이콘 — 안 읽은 메시지가 있으면 점. 화면 이동 · 새 메시지 · 읽음마다 다시 셈
function ChatButton() {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  useSocketEvent('chat:message', bump)
  useSocketEvent('chat:read', bump)
  useSocketEvent('chat:rooms', bump)

  useEffect(() => {
    let cancelled = false
    fetchUnreadCount()
      .then((n) => !cancelled && setUnread(n))
      .catch(() => {}) // 점 하나 — 실패해도 조용히
    return () => {
      cancelled = true
    }
  }, [pathname, version])

  const active = pathname.startsWith('/chat')
  return (
    <Link to="/chat" className={`icon-btn${active ? ' is-active' : ''}`} aria-label={unread > 0 ? '채팅, 안 읽은 메시지 있음' : '채팅'}>
      <ChatIcon size={22} />
      {unread > 0 && <span className="icon-btn__dot icon-btn__dot--chat" />}
    </Link>
  )
}

// 알림 종 — 안 읽은 게 있으면 점. 새 알림(소켓) · 화면 이동마다 다시 셈
// 누르면 목록을 열고 그 자리에서 전부 읽음 처리한다 (항목을 눌러 이동해도 점이 남지 않게)
function BellButton() {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(null) // null = 불러오는 중
  const boxRef = useRef(null)
  const bump = () => setVersion((v) => v + 1)

  useSocketEvent('notify:changed', bump)

  useEffect(() => {
    let cancelled = false
    fetchNotifyCount()
      .then((n) => !cancelled && setUnread(n))
      .catch(() => {}) // 점 하나 — 실패해도 조용히
    return () => {
      cancelled = true
    }
  }, [pathname, version])

  // 메뉴 밖 클릭 · Esc 로 닫기 (아래 UserMenu 와 같은 방식)
  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = async () => {
    if (open) return setOpen(false)
    setOpen(true)
    setList(null)
    try {
      setList(await fetchNotifications())
      if (unread > 0) {
        await markRead()
        setUnread(0)
      }
    } catch {
      setList([]) // 열었는데 못 불러오면 빈 상태로 안내
    }
  }

  return (
    <div className="notify" ref={boxRef}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : '알림'}
        onClick={toggle}
      >
        <BellIcon size={22} />
        {unread > 0 && <span className="icon-btn__dot icon-btn__dot--notify" />}
      </button>

      {open && (
        <div className="notify__panel" role="menu">
          <div className="notify__head">알림</div>
          {list === null ? (
            <p className="notify__empty">불러오는 중...</p>
          ) : list.length === 0 ? (
            <p className="notify__empty">아직 알림이 없어요.</p>
          ) : (
            <ul className="notify__list">
              {list.map((n) => (
                <li key={n._id}>
                  <Link to={n.link || '/'} role="menuitem" className={`notify__item${n.readAt ? '' : ' is-new'}`} onClick={() => setOpen(false)}>
                    <span className="notify__text">{n.message}</span>
                    <span className="notify__when">{formatMeetupWhen(n.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu({ user }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const image = profileImageUrl(user)

  // 메뉴 밖 클릭 · Esc 로 닫기
  useEffect(() => {
    if (!open) return undefined
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onLogout = async () => {
    setOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <div className="user-menu" ref={boxRef}>
      <button
        type="button"
        className="user-menu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.nickname} 메뉴`}
        onClick={() => setOpen((v) => !v)}
      >
        {image ? <img className="avatar" src={image} alt="" /> : <span className="avatar" aria-hidden="true" />}
      </button>
      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__who">
            <strong>{user.nickname}</strong>
            <span>{user.email}</span>
          </div>
          <button type="button" role="menuitem" className="user-menu__item" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
