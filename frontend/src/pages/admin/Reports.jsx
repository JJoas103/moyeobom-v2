import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import MannerBadge from '../../components/common/MannerBadge'
import { ChevronRightIcon } from '../../components/common/Icons'
import { useAsync } from '../../utils/useAsync'
import { formatMonthDay } from '../../utils/format'
import { fetchReports, REPORT_REASON_LABEL, REPORT_STATUS, REPORT_STATUS_LABEL } from '../../data/admin'

// 신고 목록 — 기본은 대기 중, **오래 기다린 것 먼저** (서버 정렬)
//
// 목록에서는 판정하지 않는다 — 버튼을 여기 달면 증거를 안 보고 누를 수 있다.
// 이유 · 대상 · 언제까지만 보여 주고 판단은 상세에서 한다.
const PAGE = 20

export default function Reports() {
  const [params, setParams] = useSearchParams()
  const status = REPORT_STATUS.some((s) => s.value === params.get('status')) ? params.get('status') : 'pending'

  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const { data, loading, error } = useAsync(() => fetchReports({ status, page, limit: PAGE }), [status, page])

  // 상태를 바꾸면 1페이지로 돌아간다 (행사 목록과 같은 방식 — useAsync 는 data 를 갈아 끼우므로 누적은 여기서)
  useEffect(() => {
    setRows([])
    setPage(1)
  }, [status])

  useEffect(() => {
    if (!data) return
    setRows((prev) => (data.page === 1 ? data.reports : [...prev, ...data.reports]))
  }, [data])

  const counts = data?.counts
  const hasMore = data ? rows.length < data.total : false

  return (
    <div className="admin-panel">
      <div className="admin-filters" role="tablist" aria-label="신고 상태">
        {REPORT_STATUS.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={status === s.value}
            className={`admin-chip${status === s.value ? ' is-active' : ''}`}
            onClick={() => setParams({ tab: 'reports', status: s.value }, { replace: true })}
          >
            {s.label}
            {counts && s.value !== 'all' && <span className="admin-chip__count">{counts[s.value]}</span>}
          </button>
        ))}
      </div>

      <DataState loading={loading && !rows.length} error={error} empty={!loading && !rows.length} emptyText={emptyText(status)}>
        <>
          <table className="admin-table">
            <caption className="sr-only">신고 목록</caption>
            <thead>
              <tr>
                <th scope="col">신고 대상</th>
                <th scope="col">이유</th>
                <th scope="col">어디서</th>
                <th scope="col">신고한 사람</th>
                <th scope="col">받은 날</th>
                <th scope="col">상태</th>
                <th scope="col" className="admin-table__go" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>
                    <Link to={`/admin/reports/${r._id}`} className="admin-table__who">
                      <span className="one-line">{r.target.nickname}</span>
                      <MannerBadge manner={r.target.manner} />
                    </Link>
                  </td>
                  <td>
                    <span className="one-line">{REPORT_REASON_LABEL[r.reason] || '이유 없음'}</span>
                  </td>
                  <td className="admin-table__where">{whereText(r)}</td>
                  <td>
                    <span className="one-line">{r.reporter.nickname}</span>
                  </td>
                  <td className="admin-table__date">{formatMonthDay(r.createdAt)}</td>
                  <td>
                    <span className={`admin-status admin-status--${r.status}`}>{REPORT_STATUS_LABEL[r.status]}</span>
                    {r.appealOpen && <span className="admin-tag admin-tag--warn">이의</span>}
                  </td>
                  <td className="admin-table__go">
                    <Link to={`/admin/reports/${r._id}`} aria-label={`${r.target.nickname} 신고 자세히 보기`}>
                      <ChevronRightIcon />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <button type="button" className="btn btn--line admin-more" onClick={() => setPage((p) => p + 1)} disabled={loading}>
              {loading ? '불러오는 중…' : `더 보기 (${rows.length} / ${data.total})`}
            </button>
          )}
        </>
      </DataState>
    </div>
  )
}

const emptyText = (status) => (status === 'pending' ? '처리할 신고가 없어요' : '해당하는 신고가 없어요')

/** 어느 대화에서 온 신고인지 — 방이 지워졌으면 그렇다고 말한다 (90일 정리) */
function whereText(r) {
  if (!r.roomType) return '삭제된 대화'
  const kind = r.isMessage ? '메시지' : '참여자'
  if (r.roomType === 'direct') return `1:1 ${kind}`
  return r.meetupTitle ? `${r.meetupTitle} · ${kind}` : `모임 ${kind}`
}
