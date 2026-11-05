import { ConfirmDialog } from './Dialog'
import { REPORT_DETAIL_MAX, REPORT_REASONS } from '../../data/constants'
import { isReportReady } from '../../utils/report'

export const REPORT_DIALOG_WIDTH = 420

/**
 * 신고 이유 고르기 — 하나만, 기타는 입력칸 필수
 *   value: { reason, detail } · onChange(value)
 */
export function ReportFields({ value, onChange }) {
  return (
    <div className="report-fields">
      <fieldset className="report-fields__options">
        <legend className="sr-only">신고 이유</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r.value} className={`report-option${value.reason === r.value ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name="report-reason"
              value={r.value}
              checked={value.reason === r.value}
              onChange={() => onChange({ ...value, reason: r.value })}
            />
            {r.label}
          </label>
        ))}
      </fieldset>
      {value.reason === 'other' && (
        <label className="report-fields__detail">
          어떤 일이 있었나요?
          <textarea
            rows={3}
            maxLength={REPORT_DETAIL_MAX}
            placeholder="상황을 적어 주세요."
            value={value.detail}
            onChange={(e) => onChange({ ...value, detail: e.target.value })}
          />
          <span className="report-fields__count">
            {value.detail.length}/{REPORT_DETAIL_MAX}
          </span>
        </label>
      )}
    </div>
  )
}

/** 신고 팝업 — children: 제목 아래 안내 */
export default function ReportDialog({ title, value, onChange, children, busy, error, onConfirm, onClose }) {
  return (
    <ConfirmDialog
      title={title}
      confirmLabel="신고하기"
      danger
      width={REPORT_DIALOG_WIDTH}
      disabled={!isReportReady(value)}
      busy={busy}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      {children}
      <ReportFields value={value} onChange={onChange} />
    </ConfirmDialog>
  )
}
