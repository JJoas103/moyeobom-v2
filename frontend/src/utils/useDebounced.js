import { useEffect, useState } from 'react'

/** 입력이 delay 동안 멈췄을 때만 반영 (검색어 칠 때마다 요청 방지) */
export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
