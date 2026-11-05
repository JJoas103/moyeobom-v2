import { useState } from 'react'
import ReportDialog from '../common/ReportDialog'
import { reportHost } from '../../data/meetups'
import { REPORT_REASONS, REPORT_REASONS_WITH_NOSHOW } from '../../data/constants'
import { EMPTY_REPORT } from '../../utils/report'

/** 모임 상세 맨 위 오른쪽 '모임 신고하기' — 확정 참여자만, 신고 대상은 호스트. '호스트 노쇼'는 이야기 자리 시작 뒤에만 */
export default function HostReportButton({ meetup }) {
  const [value, setValue] = useState(null) // 팝업 입력값 { reason, detail }. null 이면 닫힘
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const started = meetup.status !== 'cancelled' && new Date(meetup.talk.startAt) <= new Date()

  const close = () => {
    setValue(null)
    setError(null)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await reportHost(meetup._id, value)
      setValue(null)
      setDone(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <span className="host-report__done" role="status">
        신고했어요. 상대에게는 알리지 않아요.
      </span>
    )
  }

  return (
    <>
      <button type="button" className="host-report" onClick={() => setValue(EMPTY_REPORT)}>
        모임 신고하기
      </button>
      {value && (
        <ReportDialog
          title="이 모임을 신고할까요?"
          value={value}
          onChange={setValue}
          reasons={started ? REPORT_REASONS_WITH_NOSHOW : REPORT_REASONS}
          busy={busy}
          error={error}
          onConfirm={submit}
          onClose={close}
        >
          <p className="dialog__text">신고한 사실은 상대에게 알리지 않아요.</p>
        </ReportDialog>
      )}
    </>
  )
}
