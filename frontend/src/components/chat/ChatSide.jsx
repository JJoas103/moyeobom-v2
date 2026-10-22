import { Link } from 'react-router-dom'
import Avatar from '../common/Avatar'
import MiniPoster from '../common/MiniPoster'
import MoreMenu from '../common/MoreMenu'
import { JOIN_LABEL } from '../../data/constants'
import { formatMonthDay } from '../../utils/format'

/** 채팅 오른쪽 — 모임 방: 모임 정보 · 참여자(⋯ 신고 · 차단) / 1:1: 상대 · 처음 만난 모임 · 친구 끊기 · 차단 · 신고 */
export default function ChatSide({ room, onReportUser, onBlock, onUnfriend, onBlockDirect }) {
  if (room.type === 'direct') {
    return (
      <aside className="chat-side">
        <div className="chat-side__person">
          <Avatar user={room.partner} size={64} />
          <span className="chat-side__name">{room.partner?.nickname}</span>
        </div>
        {room.meetup && (
          <>
            <span className="chat-side__label">처음 만난 모임</span>
            <Link to={`/meetup/${room.meetup._id}`} className="chat-side__meetup">
              <MiniPoster meetup={room.meetup} width={44} height={58} />
              <span className="chat-side__meetup-text">
                <strong>{room.meetup.title}</strong>
                <span>
                  {room.meetup.event?.title ? `${room.meetup.event.title} · ` : ''}
                  {formatMonthDay(room.meetup.talk.startAt)}
                </span>
              </span>
            </Link>
          </>
        )}
        <div className="chat-side__bottom">
          {room.friendshipId && (
            <button type="button" className="chat-side__btn" onClick={onUnfriend}>
              친구 끊기
            </button>
          )}
          <button type="button" className="chat-side__btn is-danger" onClick={onBlockDirect}>
            차단 · 신고
          </button>
        </div>
      </aside>
    )
  }

  const { meetup } = room
  return (
    <aside className="chat-side">
      {meetup && (
        <div className="chat-side__section">
          <span className="chat-side__label">모임 정보</span>
          <div className="chat-side__event">
            <MiniPoster meetup={meetup} width={48} height={64} radius={8} />
            <span className="chat-side__meetup-text">
              <strong>{meetup.event?.title || meetup.title}</strong>
              <span>{[meetup.event?.venue, meetup.talk.area].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
          <Link to={`/meetup/${meetup._id}`} className="chat-side__link">
            모임 상세 보기 ›
          </Link>
        </div>
      )}
      <div className="chat-side__line" />
      <div className="chat-side__members">
        <span className="chat-side__label">참여자 {room.members.length}명</span>
        {room.members.map((m) => (
          <div key={m.user._id} className={`chat-member${m.blocked ? ' is-blocked' : ''}`}>
            <Avatar user={m.user} size={32} />
            <span className="chat-member__text">
              <span className="chat-member__name">
                {m.user.nickname}
                {m.isHost && <span className="chat-member__tag">호스트</span>}
                {m.isMe && <span className="chat-member__me">나</span>}
              </span>
              <span className="chat-member__sub">{m.blocked ? '차단한 사람' : JOIN_LABEL[m.joinType] || ''}</span>
            </span>
            {!m.isMe && (room.canReport || !m.blocked) && (
              <MoreMenu
                label={`${m.user.nickname} 메뉴`}
                size={32}
                items={[
                  room.canReport && { label: '신고하기', onSelect: () => onReportUser(m) },
                  !m.blocked && { label: '차단하기', danger: true, onSelect: () => onBlock(m) },
                ].filter(Boolean)}
              />
            )}
          </div>
        ))}
      </div>
      <p className="chat-side__note">
        {room.closed
          ? room.canReport
            ? '닫힌 방은 30일 동안 목록에 남고, 그동안 신고할 수 있어요.'
            : ''
          : '참여자 ⋯ 메뉴에서 신고 · 차단할 수 있어요.'}
      </p>
    </aside>
  )
}
