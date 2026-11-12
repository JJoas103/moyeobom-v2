import { useState } from 'react'
import { ConfirmDialog } from '../../components/common/Dialog'
import DataState from '../../components/common/DataState'
import { useAsync } from '../../utils/useAsync'
import { formatMonthDay } from '../../utils/format'
import { APPEAL_MAX, APPEAL_STATUS_LABEL, fetchMySanctions, submitAppeal } from '../../data/appeal'

// 받은 제재 · 이의제기 — 제재 1건당 한 번, 낸 뒤엔 글 · 상태 · 관리자 답이 남는다 (취소된 제재는 안 옴)
export default function SanctionsTab() {
  const [version, setVersion] = useState(0)
  const { data, loading, error } = useAsync(() => fetchMySanctions(), [version])
  const sanctions = data?.sanctions || []

  return (
    <DataState
      loading={loading}
      error={error}
      empty={Boolean(data) && sanctions.length === 0}
      emptyText={<strong>받은 제재가 없어요</strong>}
    >
      <div className="mypage-panel">
        <div className="mypage-panel__head">
          <strong>
            받은 제재 <span>{sanctions.length}</span>
          </strong>
          <span className="mypage-tags">
            <span className="mypage-tag">제재 1건당 이의제기 한 번</span>
          </span>
        </div>
        <ul className="appeal-list">
          {sanctions.map((s) => (
            <SanctionRow key={s._id} sanction={s} onSent={() => setVersion((v) => v + 1)} />
          ))}
        </ul>
      </div>
    </DataState>
  )
}

function SanctionRow({ sanction, onSent }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState('')

  const send = async () => {
    setBusy(true)
    setFailed('')
    try {
      await submitAppeal(sanction._id, text)
      setOpen(false)
      setText('')
      onSent()
    } catch (err) {
      setFailed(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="appeal-item">
      <div className="appeal-item__head">
        <strong>{sanction.meetupTitle || '신고로 제재를 받았어요'}</strong>
        <span className="appeal-item__date">{formatMonthDay(sanction.sanctionedAt)}</span>
      </div>
      <p className="appeal-item__what">
        매너 점수가 깎였어요
      </p>

      {sanction.appeal ? (
        <div className="appeal-item__sent">
          <span className={`appeal-status appeal-status--${sanction.appeal.status}`}>
            {APPEAL_STATUS_LABEL[sanction.appeal.status]}
          </span>
          <blockquote>{sanction.appeal.text}</blockquote>
          {/* 관리자 답은 결과만큼 중요하다 — 왜 그렇게 됐는지가 여기 있다 */}
          {sanction.appeal.reply && (
            <p className="appeal-item__reply">
              <b>관리자 답</b> {sanction.appeal.reply}
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="btn btn--line btn--sm" onClick={() => setOpen(true)}>
          이의제기
        </button>
      )}

      {open && (
        <ConfirmDialog
          title="이의제기를 보낼까요?"
          confirmLabel="보내기"
          width={420}
          busy={busy}
          disabled={!text.trim()}
          error={failed}
          onConfirm={send}
          onClose={() => setOpen(false)}
        >
          <p className="dialog__text">
            관리자가 다시 보고 제재를 취소할 수 있어요. <b>한 번만 보낼 수 있으니</b> 사정을 한 번에 적어 주세요.
          </p>
          <label className="dialog-field">
            무슨 일이 있었나요?
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={APPEAL_MAX}
              placeholder="그때 상황을 적어 주세요."
            />
            <span className="dialog-field__count">
              {text.length}/{APPEAL_MAX}
            </span>
          </label>
        </ConfirmDialog>
      )}
    </li>
  )
}
