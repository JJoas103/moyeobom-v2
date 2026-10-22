import { useState } from 'react'
import DataState from '../../components/common/DataState'
import Avatar from '../../components/common/Avatar'
import MeetupChip from '../../components/common/MeetupChip'
import { ConfirmDialog } from '../../components/common/Dialog'
import { FriendsTabs, HowFriendsWork } from './Friends'
import { useAsync } from '../../utils/useAsync'
import { useNow } from '../../utils/useNow'
import { useSocketEvent } from '../../context/SocketContext'
import { fetchFriendRequests, sendFriendRequest, sendFriendRequests } from '../../data/friends'
import { formatDaysLeft } from '../../utils/format'
import '../../styles/friends.css'

// 시안 · 친구 — 요청 탭 (friends-requests.html · friends-bulk-confirm.html)
//   받은 요청(수락만 · 거절 없음) · 요청 가능 · 보낸 요청(대기 / 만료)
//   기한은 평가 마감 + 7일, '요청 가능'과 '보낸 요청'이 같은 때 만료
const SOON_DAYS = 2 // 이 안으로 남으면 주황 글씨

export default function Requests() {
  const [version, setVersion] = useState(0)
  const reload = () => setVersion((v) => v + 1)
  const { data, loading, error } = useAsync(() => fetchFriendRequests(), [version])
  useSocketEvent('friends:changed', reload)

  return (
    <div className="friends">
      <FriendsTabs friendCount={data?.friendCount} receivedCount={data?.received.length} />
      <div className="friends__grid">
        <DataState loading={loading && !data} error={error}>
          {data && <RequestSections data={data} onChange={reload} />}
        </DataState>
        <HowFriendsWork />
      </div>
    </div>
  )
}

function RequestSections({ data, onChange }) {
  const now = useNow()
  const [busyId, setBusyId] = useState(null)
  const [bulk, setBulk] = useState(null) // { kind: 'accept'|'send', items }
  const [bulkBusy, setBulkBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null) // 결과 안내 한 줄

  const sendOne = async (item, verb) => {
    setBusyId(item._id)
    setError(null)
    try {
      const status = await sendFriendRequest(item._id)
      setDone(status === 'friends' ? `${item.user.nickname}님과 친구가 됐어요. 1:1 채팅이 열렸어요.` : `${item.user.nickname}님에게 친구 요청을 ${verb}.`)
      onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const sendBulk = async () => {
    setBulkBusy(true)
    setError(null)
    try {
      const result = await sendFriendRequests(bulk.items.map((i) => i._id))
      const parts = [result.friends > 0 && `친구 ${result.friends}명`, result.requested > 0 && `요청 ${result.requested}건`].filter(Boolean)
      setDone(`${parts.join(' · ') || '처리한 요청이 없어요'}${result.failed ? ` · 기한이 지난 ${result.failed}건은 보내지 못했어요` : ''}`)
      setBulk(null)
      onChange()
    } catch (e) {
      setError(e.message)
    } finally {
      setBulkBusy(false)
    }
  }

  const left = (item) => {
    const soon = new Date(item.expiresAt) - now < SOON_DAYS * 24 * 60 * 60 * 1000
    return <span className={`request-card__left${soon ? ' is-soon' : ''}`}>{formatDaysLeft(item.expiresAt, now)}</span>
  }

  return (
    <div className="request-sections">
      {done && (
        <div className="friends-done" role="status">
          {done}
        </div>
      )}
      {error && !bulk && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <RequestSection
        title="받은 요청"
        items={data.received}
        empty="받은 요청이 없어요."
        bulkLabel="모두 수락"
        onBulk={() => setBulk({ kind: 'accept', items: data.received })}
        render={(item) => (
          <>
            {left(item)}
            <button type="button" className="btn btn--primary request-card__btn" disabled={busyId === item._id} onClick={() => sendOne(item, '수락했어요')}>
              수락
            </button>
          </>
        )}
      />

      <RequestSection
        title="요청 가능"
        items={data.available}
        empty="서로 '또 만나고 싶어요'를 고른 사람이 평가 마감 뒤 여기에 나타나요."
        bulkLabel="모두 요청 보내기"
        onBulk={() => setBulk({ kind: 'send', items: data.available })}
        render={(item) => (
          <>
            {left(item)}
            <button type="button" className="btn request-card__btn request-card__btn--outline" disabled={busyId === item._id} onClick={() => sendOne(item, '보냈어요')}>
              친구 요청 보내기
            </button>
          </>
        )}
      />

      <RequestSection
        title="보낸 요청"
        items={data.sent}
        empty="보낸 요청이 없어요."
        render={(item) =>
          item.expired ? (
            <span className="request-card__left is-expired">만료됨</span>
          ) : (
            <span className="request-card__left">대기 중 · {formatDaysLeft(item.expiresAt, now)}</span>
          )
        }
      />

      {bulk && (
        <ConfirmDialog
          title={bulk.kind === 'accept' ? `${bulk.items.length}명의 요청을 수락할까요?` : `${bulk.items.length}명에게 친구 요청을 보낼까요?`}
          confirmLabel={bulk.kind === 'accept' ? '모두 수락' : '모두 보내기'}
          busy={bulkBusy}
          error={error}
          onClose={() => {
            setBulk(null)
            setError(null)
          }}
          onConfirm={sendBulk}
        >
          <ul className="dialog__people">
            {bulk.items.map((item) => (
              <li key={item._id}>
                <Avatar user={item.user} size={32} />
                {item.user.nickname}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
    </div>
  )
}

// 일괄 버튼은 카드가 1개여도 보임 (확인 팝업 필수)
function RequestSection({ title, items, empty, bulkLabel, onBulk, render }) {
  return (
    <section className="request-section">
      <div className="request-section__head">
        <h2>{title}</h2>
        <span className="request-section__count">{items.length}</span>
        <span className="spacer" />
        {bulkLabel && items.length > 0 && (
          <button type="button" className="request-section__bulk" onClick={onBulk}>
            {bulkLabel}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="request-section__empty">{empty}</p>
      ) : (
        items.map((item) => (
          <div key={item._id} className={`request-card${item.expired ? ' is-expired' : ''}`}>
            <Avatar user={item.user} size={48} />
            <span className="request-card__text">
              <span className="request-card__name">{item.user.nickname}</span>
              <MeetupChip meetup={item.meetup} />
            </span>
            {render(item)}
          </div>
        ))
      )}
    </section>
  )
}
