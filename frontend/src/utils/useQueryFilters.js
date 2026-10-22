import { useSearchParams } from 'react-router-dom'

/**
 * 목록 필터를 주소 쿼리(?category=play&district=종로구)에 담는 훅.
 * 상세에 갔다가 뒤로 와도 · 주소를 공유해도 필터 유지
 *   const { get, set, reset } = useQueryFilters()
 *   get('category')            → '' (없으면 빈 문자열)
 *   set('category', 'play', { clear: ['genre'] })  → 같이 지울 키 지정
 */
export function useQueryFilters() {
  const [sp, setSp] = useSearchParams()

  const get = (key) => sp.get(key) ?? ''
  const has = (key) => sp.has(key)

  const set = (key, value, { clear = [] } = {}) => {
    const next = new URLSearchParams(sp)
    if (value === '' || value === null || value === undefined || value === false) next.delete(key)
    else next.set(key, value)
    clear.forEach((k) => next.delete(k))
    setSp(next, { replace: true })
  }

  const reset = () => setSp(new URLSearchParams(), { replace: true })

  return { get, has, set, reset }
}
