import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocketEvent } from '../context/SocketContext'
import { ChatIcon } from './common/Icons'
import { fetchUnreadCount } from '../data/chat'
import { profileImageUrl } from '../utils/user'

const NAV = [
  { to: '/', label: '홈', end: true },
  { to: '/event', label: '행사' },
  { to: '/meetup', label: '모임' },
  { to: '/my/meetups', label: '내 모임' },
  { to: '/friends', label: '친구' },
  { to: '/my', label: '마이', end: true },
]

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

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
            {/* TODO(알림 단계): 새 알림이 있을 때만 점 표시 */}
            <button type="button" className="icon-btn" aria-label="알림">
              <BellIcon />
            </button>
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
