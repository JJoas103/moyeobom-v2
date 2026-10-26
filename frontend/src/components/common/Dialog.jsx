import { useEffect, useRef } from 'react'

/**
 * 작은 확인 팝업 — 바깥 클릭 · Esc 로 닫힘. 열리면 첫 입력칸(없으면 팝업)에 초점
 *   <Dialog label="이지은님과 친구를 끊을까요?" onClose={...}>...</Dialog>
 */
export default function Dialog({ label, onClose, width = 360, children }) {
  const boxRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ;(boxRef.current?.querySelector('input, textarea') || boxRef.current)?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="dialog" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={{ width }}>
        {children}
      </div>
    </div>
  )
}

/** 확인 · 취소 두 버튼 팝업 — 끊기 · 차단 · 일괄 요청에 사용 */
export function ConfirmDialog({ title, children, confirmLabel, danger = false, busy = false, error, onConfirm, onClose }) {
  return (
    <Dialog label={title} onClose={onClose}>
      <span className="dialog__title">{title}</span>
      {children}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn btn--line dialog__btn" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className={`btn dialog__btn ${danger ? 'btn--danger' : 'btn--primary'}`}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? '처리 중...' : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
