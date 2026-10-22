import { useState } from 'react'
import Dialog from '../common/Dialog'
import Avatar from '../common/Avatar'
import { CloseIcon } from '../common/Icons'
import { MEMO_MAX, saveFriendMemo } from '../../data/friends'

/** 친구 메모 팝업 — 한 줄 · 글자 수 표시 · 본인만 보임 (시안 friends-memo) */
export default function MemoDialog({ friend, onClose, onSaved }) {
  const [memo, setMemo] = useState(friend.memo || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await saveFriendMemo(friend._id, memo)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.fieldErrors?.memo || err.message)
      setSaving(false)
    }
  }

  return (
    <Dialog label={`${friend.user.nickname} 메모 설정`} onClose={onClose} width={400}>
      <form className="memo-form" onSubmit={save}>
        <div className="memo-form__head">
          <Avatar user={friend.user} size={40} />
          <span className="memo-form__title">{friend.user.nickname} 메모</span>
          <button type="button" className="memo-form__close" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <label className="memo-form__field">
          <span className="sr-only">메모 (나만 보여요)</span>
          <input
            value={memo}
            maxLength={MEMO_MAX}
            placeholder="어떤 사람인지 한 줄로 적어 두세요"
            onChange={(e) => setMemo(e.target.value)}
          />
          <span className="memo-form__count">
            {memo.length} / {MEMO_MAX}
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog__actions">
          <button type="button" className="btn btn--line dialog__btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn btn--primary dialog__btn" disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
