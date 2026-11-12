import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Avatar from '../../components/common/Avatar'
import DataState from '../../components/common/DataState'
import MannerBadge from '../../components/common/MannerBadge'
import SearchInput from '../../components/common/SearchInput'
import { ChevronRightIcon } from '../../components/common/Icons'
import { useAsync } from '../../utils/useAsync'
import { useDebounced } from '../../utils/useDebounced'
import { formatMonthDay } from '../../utils/format'
import { fetchMembers } from '../../data/admin'

// 회원 목록 — **보기만 한다.** 제재는 신고 상세에서만 내린다
// (근거가 될 신고 없이 임의로 제재하지 않는다 — 이의제기가 가리킬 대상도 그 신고다)
//
// '매너 점수 낮은 순'이 있는 이유: 신고를 한 건씩 보기 전에 문제가 쌓이는 계정을 먼저 찾는 자리다.
// 그래서 받은 신고 수도 목록에 함께 보여 준다 (대기 중인 건수는 따로 표시).
const PAGE = 20
const SORTS = [
  { value: 'recent', label: '가입 최근' },
  { value: 'manner', label: '매너 점수 낮은 순' },
]

export default function Members() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const query = useDebounced(q.trim(), 250)

  const { data, loading, error } = useAsync(() => fetchMembers({ q: query, sort, page, limit: PAGE }), [query, sort, page])

  // 검색어 · 정렬이 바뀌면 1페이지로 (행사 목록과 같은 방식)
  useEffect(() => {
    setRows([])
    setPage(1)
  }, [query, sort])

  useEffect(() => {
    if (!data) return
    setRows((prev) => (data.page === 1 ? data.members : [...prev, ...data.members]))
  }, [data])

  const hasMore = data ? rows.length < data.total : false

  return (
    <div className="admin-panel">
      <div className="admin-filters">
        <SearchInput value={q} onChange={setQ} placeholder="닉네임이나 이메일로 찾기" label="회원 찾기" width={320} />
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={sort === s.value}
            className={`admin-chip${sort === s.value ? ' is-active' : ''}`}
            onClick={() => setSort(s.value)}
          >
            {s.label}
          </button>
        ))}
        {data && <span className="admin-filters__total">{data.total}명</span>}
      </div>

      <DataState
        loading={loading && !rows.length}
        error={error}
        empty={!loading && !rows.length}
        emptyText={query ? '찾는 회원이 없어요.' : '회원이 없어요.'}
      >
        <>
          <table className="admin-table">
            <caption className="sr-only">회원 목록</caption>
            <thead>
              <tr>
                <th scope="col">회원</th>
                <th scope="col">이메일</th>
                <th scope="col">매너 점수</th>
                <th scope="col">받은 신고</th>
                <th scope="col">가입</th>
                <th scope="col" className="admin-table__go" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m._id}>
                  <td>
                    <Link to={`/admin/members/${m._id}`} className="admin-table__who">
                      <Avatar user={m} size={28} />
                      <span className="one-line">{m.nickname}</span>
                      {m.role === 'admin' && <span className="admin-tag">관리자</span>}
                    </Link>
                  </td>
                  <td className="admin-table__mail">
                    <span className="one-line">{m.email}</span>
                  </td>
                  <td>
                    <MannerBadge manner={m.manner} />
                  </td>
                  <td>
                    {m.reports.total === 0 ? (
                      <span className="admin-dim">없음</span>
                    ) : (
                      <>
                        {m.reports.total}건
                        {m.reports.pending > 0 && <span className="admin-tag admin-tag--warn">대기 {m.reports.pending}</span>}
                      </>
                    )}
                  </td>
                  <td className="admin-table__date">{m.createdAt ? formatMonthDay(m.createdAt) : '—'}</td>
                  <td className="admin-table__go">
                    <Link to={`/admin/members/${m._id}`} aria-label={`${m.nickname} 자세히 보기`}>
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
