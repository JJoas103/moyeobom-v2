import { useState } from 'react'
import Avatar from '../../components/common/Avatar'
import DataState from '../../components/common/DataState'
import { ConfirmDialog } from '../../components/common/Dialog'
import { useAsync } from '../../utils/useAsync'
import { fetchBlocks, unblockUser } from '../../data/friends'
import { formatMonthDay } from '../../utils/format'

// 차단 목록 — 차단 풀기는 확인 팝업. 끊긴 친구 · 지나간 요청은 되살리지 않음
export default function BlocksTab() {
  const { data, loading, error } = useAsync(() => fetchBlocks(), [])
  const [removed, setRemoved] = useState([]) // 방금 푼 사람 _id
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const blocks = (data?.blocks || []).filter((b) => !removed.includes(b.user._id))

  const close = () => {
    setTarget(null)
    setActionError('')
  }

  const onConfirm = async () => {
    setBusy(true)
    try {
      await unblockUser(target._id)
      setRemoved((ids) => [...ids, target._id])
      close()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DataState loading={loading} error={error} empty={data && blocks.length === 0} emptyText={<strong>차단한 사람이 없어요</strong>}>
      <div className="mypage-panel">
        <div className="mypage-panel__head">
          <strong>
            차단한 사람 <span>{blocks.length}</span>
          </strong>
          <span className="mypage-tags">
            <span className="mypage-tag">친구 끊김</span>
            <span className="mypage-tag">모임 채팅 메시지 숨김</span>
          </span>
        </div>
        <ul className="mypage-list">
          {blocks.map(({ user, blockedAt }) => (
            <li key={user._id} className="mypage-row">
              <Avatar user={user} size={48} />
              <span className="mypage-row__main">
                <span className="mypage-row__title one-line">{user.nickname}</span>
                <span className="mypage-row__sub">{formatMonthDay(blockedAt)} 차단</span>
              </span>
              <button type="button" className="btn btn--line mypage-btn" onClick={() => setTarget(user)}>
                차단 풀기
              </button>
            </li>
          ))}
        </ul>
      </div>

      {target && (
        <ConfirmDialog
          title={`${target.nickname}님 차단을 풀까요?`}
          confirmLabel="차단 풀기"
          busy={busy}
          error={actionError}
          onConfirm={onConfirm}
          onClose={close}
        />
      )}
    </DataState>
  )
}
