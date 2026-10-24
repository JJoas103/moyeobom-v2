import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../common/Avatar'
import MoreMenu from '../common/MoreMenu'
import { ConfirmDialog } from '../common/Dialog'
import { ChevronDownIcon, MegaphoneIcon, SendIcon } from '../common/Icons'
import ChatSide from './ChatSide'
import { useAuth } from '../../context/AuthContext'
import { useSocketEvent } from '../../context/SocketContext'
import {
  MESSAGE_MAX,
  fetchOlderMessages,
  fetchRoom,
  markRead,
  pinNotice,
  reportInRoom,
  sendMessage,
  unpinNotice,
} from '../../data/chat'
import { blockUser, unfriend } from '../../data/friends'
import { formatChatDate, formatChatTime, formatMeetupWhen } from '../../utils/format'

const NEAR_BOTTOM = 120 // 이만큼 안쪽이면 새 메시지 때 아래로 따라감

/**
 * 채팅방 하나 — 가운데(대화) + 오른쪽(모임 정보 · 참여자 / 친구) 두 칸
 * onRead: 읽음 처리 뒤 방 목록(안 읽은 수) 다시 불러오기
 */
export default function ChatRoom({ roomId, onRead }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null) // { room, messages, hasMore }
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const onReadRef = useRef(onRead)
  useEffect(() => {
    onReadRef.current = onRead
  })

  const read = () =>
    markRead(roomId)
      .then(() => onReadRef.current?.())
      .catch(() => {})

  useEffect(() => {
    let cancelled = false
    fetchRoom(roomId)
      .then((d) => {
        if (cancelled) return
        setData(d)
        markRead(roomId)
          .then(() => onReadRef.current?.())
          .catch(() => {})
      })
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [roomId, reloadKey])

  // ---------- 실시간 ----------
  useSocketEvent('chat:message', ({ roomId: rid, message }) => {
    if (rid !== roomId) return
    setData((d) => {
      if (!d || d.messages.some((m) => m._id === message._id)) return d
      if (d.room.members.some((m) => m.blocked && m.user._id === message.sender)) return d
      return { ...d, messages: [...d.messages, message] }
    })
    if (message.sender !== user._id) read()
  })

  useSocketEvent('chat:read', ({ roomId: rid, userId, at }) => {
    if (rid !== roomId) return
    setData((d) => {
      if (!d) return d
      const reads = d.room.reads.filter((r) => r.user !== userId).concat({ user: userId, at })
      return { ...d, room: { ...d.room, reads } }
    })
  })

  useSocketEvent('chat:notices', ({ roomId: rid, notices }) => {
    if (rid === roomId) setData((d) => d && { ...d, room: { ...d.room, notices } })
  })

  // 1:1 방이 닫힘(상대가 친구를 끊거나 차단) → 목록으로
  useSocketEvent('chat:rooms', ({ closedRoomId } = {}) => {
    if (closedRoomId === roomId) navigate('/chat', { replace: true })
  })

  if (error) {
    return (
      <div className="chat-empty chat-empty--wide">
        <strong>채팅방을 열 수 없어요</strong>
        <span>{error.message}</span>
      </div>
    )
  }
  if (!data) return <div className="chat-empty chat-empty--wide">불러오는 중...</div>

  return (
    <RoomView
      key={roomId}
      data={data}
      setData={setData}
      me={user._id}
      onReload={() => setReloadKey((k) => k + 1)}
      onLeft={() => navigate('/chat', { replace: true })}
    />
  )
}

function RoomView({ data, setData, me, onReload, onLeft }) {
  const { room, messages, hasMore } = data
  const listRef = useRef(null)
  const atBottomRef = useRef(true) // 보고 있던 위치가 맨 아래 근처인지
  const keepRef = useRef(null) // 이전 대화를 붙이기 전 scrollHeight — 보던 자리 유지용
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [flash, setFlash] = useState(null) // { text, error }
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState(null)

  const membersById = new Map(room.members.map((m) => [m.user._id, m]))
  const others = room.members.filter((m) => !m.isMe)
  const readAt = new Map(room.reads.map((r) => [r.user, new Date(r.at)]))
  const unreadBy = (message) => others.filter((m) => !(readAt.get(m.user._id) >= new Date(message.createdAt))).length

  // 처음 열 때 · 새 메시지(맨 아래 보던 중이거나 내가 보냄) → 맨 아래로 / 이전 대화를 붙였을 땐 보던 자리 유지
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (keepRef.current != null) {
      el.scrollTop += el.scrollHeight - keepRef.current
      keepRef.current = null
    } else if (atBottomRef.current || messages[messages.length - 1]?.sender === me) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, me])

  const onScroll = (e) => {
    const el = e.currentTarget
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
  }

  const showFlash = (value, isError = false) => {
    setFlash({ text: value, error: isError })
    setTimeout(() => setFlash(null), 3000)
  }

  const send = async (e) => {
    e.preventDefault()
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    try {
      const message = await sendMessage(room._id, value)
      setText('')
      setData((d) => (d.messages.some((m) => m._id === message._id) ? d : { ...d, messages: [...d.messages, message] }))
    } catch (err) {
      showFlash(err.message, true)
    } finally {
      setSending(false)
    }
  }

  const loadOlder = async () => {
    setLoadingOlder(true)
    try {
      const older = await fetchOlderMessages(room._id, messages[0]?._id)
      keepRef.current = listRef.current?.scrollHeight || 0
      setData((d) => ({ ...d, messages: [...older.messages, ...d.messages], hasMore: older.hasMore }))
    } catch (err) {
      showFlash(err.message, true)
    } finally {
      setLoadingOlder(false)
    }
  }

  const togglePin = async (message, pinned) => {
    try {
      const notices = pinned ? await unpinNotice(room._id, message._id) : await pinNotice(room._id, message._id)
      setData((d) => ({ ...d, room: { ...d.room, notices } }))
      showFlash(pinned ? '공지 고정을 풀었어요.' : '공지로 고정했어요.')
    } catch (err) {
      showFlash(err.message, true)
    }
  }

  // 팝업 확인 — 신고 · 차단 · 친구 끊기
  const closeDialog = () => {
    setDialog(null)
    setDialogError(null)
  }
  const runDialog = async () => {
    setBusy(true)
    setDialogError(null)
    try {
      const { kind, message, member, alsoReport } = dialog
      if (kind === 'reportMessage') await reportInRoom(room._id, { messageId: message._id })
      if (kind === 'reportUser') await reportInRoom(room._id, { userId: member.user._id })
      if (kind === 'block' || kind === 'blockDirect') {
        if (alsoReport) await reportInRoom(room._id, { userId: member.user._id }) // 방이 닫히기 전에 신고 먼저
        await blockUser(member.user._id)
      }
      if (kind === 'unfriend') await unfriend(room.friendshipId)
      closeDialog()
      if (kind === 'blockDirect' || kind === 'unfriend') return onLeft()
      if (kind === 'block') {
        showFlash('차단했어요. 이 사람의 메시지는 이제 보이지 않아요.')
        return onReload()
      }
      showFlash('신고했어요. 확인할 때까지 대화를 보관해요.')
    } catch (err) {
      setDialogError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // 메시지 ⋯ 메뉴 — 호스트: 공지 고정 / 남의 메시지: 신고
  const messageMenu = (message) => {
    const items = []
    const pinned = room.notices.some((n) => n._id === message._id)
    if (room.type === 'meetup' && room.isHost && !room.closed) {
      items.push({ label: pinned ? '공지 고정 풀기' : '공지로 고정', onSelect: () => togglePin(message, pinned) })
    }
    if (room.canReport && message.sender !== me) {
      items.push({ label: '신고하기', danger: true, onSelect: () => setDialog({ kind: 'reportMessage', message }) })
    }
    return items
  }

  // 날짜가 바뀌는 곳에 구분선
  const rows = []
  let lastDay = null
  for (const message of messages) {
    const day = new Date(message.createdAt).toDateString()
    if (day !== lastDay) rows.push({ divider: message.createdAt, key: `d-${day}` })
    lastDay = day
    rows.push({ message, key: message._id })
  }

  const isMeetup = room.type === 'meetup'
  const placeholder = room.closed ? (isMeetup ? '평가가 마감돼 읽기만 할 수 있어요' : '닫힌 채팅방이에요') : '메시지 보내기'

  return (
    <>
      <section className="thread">
        <div className="thread__head">
          {!isMeetup && <Avatar user={room.partner} size={32} />}
          <span className="thread__head-text">
            <span className="thread__title">
              {room.title} {isMeetup && <span className="thread__count">{room.memberCount}</span>}
            </span>
            {isMeetup && room.meetup ? (
              <Link to={`/meetup/${room.meetup._id}`} className="thread__sub thread__sub--link">
                {room.meetup.event?.title ? `${room.meetup.event.title} · ` : ''}
                {formatMeetupWhen(room.meetup.talk.startAt)} · 모임 상세 ›
              </Link>
            ) : (
              <span className="thread__sub">친구</span>
            )}
          </span>
          {room.closed && <span className="thread__closed">읽기 전용</span>}
        </div>

        {isMeetup && room.notices.length > 0 && <NoticeBar room={room} onUnpin={(n) => togglePin(n, true)} />}

        <div className="thread__messages" ref={listRef} onScroll={onScroll}>
          {hasMore && (
            <button type="button" className="thread__older" disabled={loadingOlder} onClick={loadOlder}>
              {loadingOlder ? '불러오는 중...' : '이전 대화 더 보기'}
            </button>
          )}
          {rows.map(({ key, divider, message }) => {
            if (divider) {
              return (
                <div key={key} className="chat-divider">
                  <span>{formatChatDate(divider)}</span>
                </div>
              )
            }
            if (!message.sender) {
              return (
                <div key={key} className="chat-system">
                  {message.text}
                </div>
              )
            }
            const mine = message.sender === me
            const menu = messageMenu(message)
            if (mine) {
              const unread = unreadBy(message)
              return (
                <div key={key} className="chat-msg chat-msg--mine">
                  {menu.length > 0 && <MoreMenu label="메시지 메뉴" items={menu} size={28} />}
                  <span className="chat-msg__meta">
                    {unread > 0 && <span className="chat-msg__unread">{unread}</span>}
                    <span>{formatChatTime(message.createdAt)}</span>
                  </span>
                  <span className="chat-bubble chat-bubble--mine">{message.text}</span>
                </div>
              )
            }
            const member = membersById.get(message.sender)
            return (
              <div key={key} className="chat-msg">
                <Avatar user={member?.user || { _id: message.sender }} size={32} />
                <div className="chat-msg__body">
                  <span className="chat-msg__name">
                    {member?.user.nickname || '알 수 없음'}
                    {member?.isHost && <span className="host-tag">호스트</span>}
                  </span>
                  <div className="chat-msg__line">
                    <span className="chat-bubble">{message.text}</span>
                    <span className="chat-msg__meta">{formatChatTime(message.createdAt)}</span>
                    {menu.length > 0 && <MoreMenu label="메시지 메뉴" items={menu} size={28} />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <form className="thread__input" onSubmit={send}>
          {flash && (
            <span className={`thread__flash${flash.error ? ' is-error' : ''}`} role={flash.error ? 'alert' : 'status'}>
              {flash.text}
            </span>
          )}
          <div className="thread__input-row">
            <label className="sr-only" htmlFor="chat-input">
              메시지
            </label>
            <input
              id="chat-input"
              value={text}
              maxLength={MESSAGE_MAX}
              placeholder={placeholder}
              disabled={room.closed}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className="thread__send" aria-label="보내기" disabled={room.closed || sending || !text.trim()}>
              <SendIcon />
            </button>
          </div>
          <span className="thread__note">대화는 신고 확인을 위해 서버에 보관돼요.</span>
        </form>
      </section>

      <ChatSide
        room={room}
        onReportUser={(member) => setDialog({ kind: 'reportUser', member })}
        onBlock={(member) => setDialog({ kind: 'block', member, alsoReport: false })}
        onUnfriend={() => setDialog({ kind: 'unfriend' })}
        onBlockDirect={() => setDialog({ kind: 'blockDirect', member: others[0], alsoReport: true })}
      />

      {dialog && (
        <RoomDialog
          dialog={dialog}
          room={room}
          busy={busy}
          error={dialogError}
          onChange={setDialog}
          onClose={closeDialog}
          onConfirm={runDialog}
        />
      )}
    </>
  )
}

// 고정 공지 바 — 누르면 다음 공지, ⌄ 로 전체 펼치기 (호스트는 여기서 고정 풀기)
function NoticeBar({ room, onUnpin }) {
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const { notices } = room
  const current = notices[index % notices.length]
  const canUnpin = room.isHost && !room.closed

  return (
    <div className="notice-wrap">
      <div className="notice-bar">
        <span className="notice-bar__icon">
          <MegaphoneIcon />
        </span>
        <button
          type="button"
          className="notice-bar__body"
          onClick={() => setIndex((i) => i + 1)}
          aria-label={notices.length > 1 ? '다음 공지 보기' : '공지'}
        >
          <span className="notice-bar__label">공지 · 호스트가 고정</span>
          <span className="notice-bar__text one-line">{current.text}</span>
        </button>
        <span className="notice-bar__count">
          {(index % notices.length) + 1} / {notices.length}
        </span>
        <button
          type="button"
          className={`notice-bar__toggle${open ? ' is-open' : ''}`}
          aria-label={open ? '공지 접기' : '공지 펼치기'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDownIcon size={16} />
        </button>
      </div>
      {open && (
        <ul className="notice-list">
          {notices.map((n) => (
            <li key={n._id}>
              <span>{n.text}</span>
              {canUnpin && (
                <button type="button" onClick={() => onUnpin(n)}>
                  고정 풀기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RoomDialog({ dialog, room, busy, error, onChange, onClose, onConfirm }) {
  const nickname = dialog.member?.user.nickname || room.partner?.nickname
  const common = { busy, error, onClose, onConfirm }

  switch (dialog.kind) {
    case 'reportMessage':
      return (
        <ConfirmDialog title="이 메시지를 신고할까요?" confirmLabel="신고하기" danger {...common}>
          <p className="dialog__quote">{dialog.message.text}</p>
          <p className="dialog__text">신고한 대화는 확인이 끝날 때까지 지우지 않고 보관해요.</p>
        </ConfirmDialog>
      )
    case 'reportUser':
      return (
        <ConfirmDialog title={`${nickname}님을 신고할까요?`} confirmLabel="신고하기" danger {...common}>
          <p className="dialog__text">이 방의 대화를 확인해 처리해요. 신고한 사실은 상대에게 알리지 않아요.</p>
        </ConfirmDialog>
      )
    case 'block':
      return (
        <ConfirmDialog title={`${nickname}님을 차단할까요?`} confirmLabel="차단하기" danger {...common}>
          <p className="dialog__text">이 사람의 메시지가 보이지 않고, 친구였다면 친구가 끊겨요.</p>
          {room.canReport && <AlsoReport dialog={dialog} onChange={onChange} />}
        </ConfirmDialog>
      )
    case 'blockDirect':
      return (
        <ConfirmDialog title={`${nickname}님을 차단할까요?`} confirmLabel="차단하기" danger {...common}>
          <p className="dialog__text">친구가 끊기고 이 채팅방이 목록에서 바로 사라져요.</p>
          <AlsoReport dialog={dialog} onChange={onChange} />
        </ConfirmDialog>
      )
    case 'unfriend':
      return (
        <ConfirmDialog title={`${nickname}님과 친구를 끊을까요?`} confirmLabel="친구 끊기" {...common}>
          <p className="dialog__text">이 채팅방이 목록에서 바로 사라져요. 상대에게 따로 알리지는 않아요.</p>
        </ConfirmDialog>
      )
    default:
      return null
  }
}

function AlsoReport({ dialog, onChange }) {
  return (
    <label className="dialog__check">
      <input type="checkbox" checked={dialog.alsoReport} onChange={(e) => onChange({ ...dialog, alsoReport: e.target.checked })} />
      대화도 함께 신고할게요
    </label>
  )
}
