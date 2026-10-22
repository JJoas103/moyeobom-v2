import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import Avatar from '../../components/common/Avatar'
import MoreMenu from '../../components/common/MoreMenu'
import { ConfirmDialog } from '../../components/common/Dialog'
import { ChatIcon, PencilIcon } from '../../components/common/Icons'
import MemoDialog from '../../components/friends/MemoDialog'
import { useAsync } from '../../utils/useAsync'
import { useSocketEvent } from '../../context/SocketContext'
import { blockUser, fetchFriends, unfriend } from '../../data/friends'
import '../../styles/friends.css'

// 시안 · 친구 — 친구 탭 (friends.html · friends-memo.html)
export default function Friends() {
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const { data, loading, error } = useAsync(() => fetchFriends(), [version])
  useSocketEvent('friends:changed', reload)

  return (
    <div className="friends">
      <FriendsTabs friendCount={data?.friends.length} receivedCount={data?.receivedCount} />
      <div className="friends__grid">
        <DataState loading={loading && !data} error={error}>
          {data && <FriendList friends={data.friends} onChange={reload} />}
        </DataState>
        <HowFriendsWork />
      </div>
    </div>
  )
}

/** 친구 · 요청 탭 — 두 화면이 같이 씀 */
export function FriendsTabs({ friendCount, receivedCount }) {
  return (
    <div className="tab-head">
      <h1>친구</h1>
      <div className="tab-head__tabs" role="tablist">
        <NavLink to="/friends" end role="tab" className="tab-head__tab">
          친구 {friendCount != null && <span className="tab-head__count">{friendCount}</span>}
        </NavLink>
        <NavLink to="/friends/requests" role="tab" className="tab-head__tab">
          요청 {receivedCount > 0 && <span className="count-badge">{receivedCount}</span>}
        </NavLink>
      </div>
    </div>
  )
}

export function HowFriendsWork() {
  return (
    <aside className="friends-how">
      <span className="friends-how__title">친구는 이렇게 생겨요</span>
      <ol>
        <li>모임이 끝나면 평가에서 '또 만나고 싶어요'를 골라요</li>
        <li>서로 골랐다면 평가 마감 뒤 '요청' 탭에서 친구 요청을 보내요</li>
        <li>상대가 수락하면 친구가 되고 1:1 채팅이 열려요</li>
      </ol>
      <span className="friends-how__note">요청은 평가 마감부터 7일 동안 보낼 수 있어요.</span>
    </aside>
  )
}

function FriendList({ friends, onChange }) {
  const [dialog, setDialog] = useState(null) // { kind: 'memo'|'unfriend'|'block', friend }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const close = () => {
    setDialog(null)
    setError(null)
  }

  const run = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      close()
      onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (friends.length === 0) {
    return (
      <div className="friends-empty">
        <strong>아직 친구가 없어요</strong>
        모임이 끝나고 평가에서 '또 만나고 싶어요'를 골라 보세요.
        <Link to="/meetup" className="btn btn--line">
          모임 둘러보기
        </Link>
      </div>
    )
  }

  const nickname = dialog?.friend.user.nickname
  return (
    <section className="friend-list">
      {friends.map((friend) => (
        <div key={friend._id} className="friend-row">
          <Avatar user={friend.user} size={52} />
          <span className="friend-row__text">
            <span className="friend-row__name">{friend.user.nickname}</span>
            {friend.memo && (
              <span className="friend-row__memo">
                <PencilIcon />
                <span className="one-line">{friend.memo}</span>
              </span>
            )}
          </span>
          {friend.roomId && (
            <Link to={`/chat/${friend.roomId}`} className="friend-row__chat">
              <ChatIcon />
              1:1 채팅
            </Link>
          )}
          <MoreMenu
            label={`${friend.user.nickname} 메뉴`}
            items={[
              { label: '친구 끊기', onSelect: () => setDialog({ kind: 'unfriend', friend }) },
              { label: '메모 설정하기', onSelect: () => setDialog({ kind: 'memo', friend }) },
              { label: '차단하기', danger: true, onSelect: () => setDialog({ kind: 'block', friend }) },
            ]}
          />
        </div>
      ))}

      {dialog?.kind === 'memo' && <MemoDialog friend={dialog.friend} onClose={close} onSaved={onChange} />}
      {dialog?.kind === 'unfriend' && (
        <ConfirmDialog
          title={`${nickname}님과 친구를 끊을까요?`}
          confirmLabel="친구 끊기"
          busy={busy}
          error={error}
          onClose={close}
          onConfirm={() => run(() => unfriend(dialog.friend._id))}
        >
          <p className="dialog__text">1:1 채팅방이 목록에서 바로 사라져요. 상대에게 따로 알리지는 않아요.</p>
        </ConfirmDialog>
      )}
      {dialog?.kind === 'block' && (
        <ConfirmDialog
          title={`${nickname}님을 차단할까요?`}
          confirmLabel="차단하기"
          danger
          busy={busy}
          error={error}
          onClose={close}
          onConfirm={() => run(() => blockUser(dialog.friend.user._id))}
        >
          <p className="dialog__text">친구가 끊기고 1:1 채팅방이 사라져요. 모임 채팅에서도 이 사람의 메시지가 보이지 않아요.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
