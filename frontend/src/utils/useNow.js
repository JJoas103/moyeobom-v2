import { useEffect, useState } from 'react'

/** 지금 시각 — interval(ms)마다 다시 그림. 남은 시간 표시용 */
export function useNow(interval = 60 * 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), interval)
    return () => clearInterval(timer)
  }, [interval])
  return now
}
