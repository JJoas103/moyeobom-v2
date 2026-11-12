import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocketEvent } from '../context/SocketContext'
import {
  ArrowDownIcon,
  BellIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  HeartIcon,
  PencilIcon,
  PersonIcon,
  ThumbUpIcon,
  UsersIcon,
} from './common/Icons'
import { fetchUnreadCount } from '../data/chat'
import { clearNotifications, fetchNotifications, fetchUnreadCount as fetchNotifyCount, markRead, removeNotification } from '../data/notifications'
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

// 관리자에게만 붙는 줄 — 일반 회원의 메뉴를 늘리지 않는다 (판단은 서버 단독, 여기는 표시만)
const ADMIN_NAV = { to: '/admin', label: '관리자' }

// 알림 종류 → 아이콘 · 색. 문구에서 뺀 말(모임 · 매너 점수 등)을 아이콘이 대신한다
// 색: good 그린 · info 파랑 · warn 주황(마이페이지 점수 깎임과 같은 색) · bad 빨강
const NOTIFY_KINDS = {
  meetup_apply: { Icon: UsersIcon, tone: 'info' },
  meetup_approved: { Icon: CheckIcon, tone: 'good' },
  meetup_left: { Icon: PersonIcon, tone: 'warn' },
  meetup_cancelled: { Icon: CloseIcon, tone: 'bad' },
  meetup_updated: { Icon: PencilIcon, tone: 'info' },
  review_open: { Icon: ThumbUpIcon, tone: 'good' },
  review_closing: { Icon: ClockIcon, tone: 'warn' },
  friend_matched: { Icon: HeartIcon, tone: 'good' },
  manner_down: { Icon: ArrowDownIcon, tone: 'warn' },
}
const NOTIFY_FALLBACK = { Icon: BellIcon, tone: 'info' }

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
          {(user?.role === 'admin' ? [...NAV, ADMIN_NAV] : NAV).map((item) => (
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
// 열면 전부 읽음 처리. 항목은 두 줄까지, 누르면 펼친다 (화면 이동 없음)
function BellButton() {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  const [version, setVersion] = useState(0)
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(null) // null = 불러오는 중
  const [asking, setAsking] = useState(false) // 모두 지우기 확인 단계
  const [expanded, setExpanded] = useState(() => new Set()) // 펼친 알림 _id
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

  // 되돌릴 수 없으니 한 번 묻는다. 모달이 아니라 패널 안에서 — 패널은 바깥 클릭으로 닫히므로
  // 밖에 뜨는 모달을 쓰면 패널이 먼저 닫혀 버린다
  const clear = async () => {
    try {
      await clearNotifications()
      setList([])
      setUnread(0)
    } catch {
      /* 실패하면 목록을 그대로 둔다 — 다시 누르면 된다 */
    }
    setAsking(false)
  }

  // 한 건 지우기 — 되돌릴 일이 적어 묻지 않는다
  const remove = async (id) => {
    try {
      await removeNotification(id)
      setList((prev) => prev.filter((n) => n._id !== id))
    } catch {
      /* 실패하면 그대로 둔다 */
    }
  }

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const toggle = async () => {
    setAsking(false)
    if (open) return setOpen(false)
    setOpen(true)
    setList(null)
    setExpanded(new Set())
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
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : '알림'}
        onClick={toggle}
      >
        <BellIcon size={22} />
        {unread > 0 && <span className="icon-btn__dot icon-btn__dot--notify" />}
      </button>

      {open && (
        <div className="notify__panel" role="dialog" aria-label="알림">
          <div className="notify__head">알림</div>
          {list === null ? (
            <p className="notify__empty">불러오는 중...</p>
          ) : list.length === 0 ? (
            <p className="notify__empty">아직 알림이 없어요.</p>
          ) : (
            <>
              <ul className="notify__list">
                {list.map((n) => {
                  const { Icon, tone } = NOTIFY_KINDS[n.type] || NOTIFY_FALLBACK
                  const isOpen = expanded.has(n._id)
                  return (
                    <li key={n._id} className="notify__item">
                      <button type="button" className="notify__main" aria-expanded={isOpen} onClick={() => toggleExpand(n._id)}>
                        <span className={`notify__icon notify__icon--${tone}`}>
                          <Icon size={16} />
                        </span>
                        <span className="notify__body">
                          <span className={`notify__text${isOpen ? ' is-open' : ''}`}>{n.message}</span>
                          <span className="notify__when">{formatMeetupWhen(n.createdAt)}</span>
                        </span>
                      </button>
                      <button type="button" className="notify__remove" aria-label="이 알림 지우기" onClick={() => remove(n._id)}>
                        <CloseIcon size={14} />
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="notify__foot">
                {asking ? (
                  <span className="notify__ask">
                    모두 지울까요?
                    <button type="button" className="notify__ask-yes" onClick={clear}>
                      지우기
                    </button>
                    <button type="button" className="notify__ask-no" onClick={() => setAsking(false)}>
                      취소
                    </button>
                  </span>
                ) : (
                  <button type="button" className="notify__clear" onClick={() => setAsking(true)}>
                    모두 지우기
                  </button>
                )}
              </div>
            </>
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
