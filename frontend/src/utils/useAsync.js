import { useEffect, useState } from 'react'

/**
 * 데이터 불러오기 공통 훅 — 로딩·에러·데이터 세 상태를 한 번에.
 *   const { data, loading, error } = useAsync(() => fetchEvents({ category }), [category])
 * deps 변경 시 다시 호출 · 먼저 보낸 요청의 늦은 응답은 무시
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    loader()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error })
      })
    return () => {
      cancelled = true
    }
    // loader 는 매 렌더 새로 생성 → deps 기준으로만 다시 호출
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
