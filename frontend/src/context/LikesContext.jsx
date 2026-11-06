import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { addLike, fetchLikeIds, removeLike } from '../data/likes'

// 내 찜 — 어느 화면의 하트든 같은 값을 보도록 한 곳에. 로그인하면 _id 목록을 한 번 불러옴
const LikesContext = createContext(null)

const EMPTY = { userId: null, ids: new Set() }
const keyOf = (type, id) => `${type}:${id}`

export function LikesProvider({ children }) {
  const { user } = useAuth()
  const userId = user?._id ?? null
  const [loaded, setLoaded] = useState(EMPTY)
  const busy = useRef(new Set()) // 요청 중인 하트 — 연달아 눌러도 순서가 꼬이지 않게

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    fetchLikeIds()
      .then(({ events, meetups }) => {
        if (cancelled) return
        setLoaded({ userId, ids: new Set([...events.map((id) => keyOf('event', id)), ...meetups.map((id) => keyOf('meetup', id))]) })
      })
      .catch(() => {}) // 하트가 비어 보일 뿐 — 실패해도 조용히
    return () => {
      cancelled = true
    }
  }, [userId])

  // 다른 사람으로 로그인하면 앞사람 찜을 보이지 않음
  const ids = loaded.userId === userId ? loaded.ids : EMPTY.ids

  const change = useCallback((key, on) => {
    setLoaded((prev) => {
      const next = new Set(prev.ids)
      if (on) next.add(key)
      else next.delete(key)
      return { ...prev, ids: next }
    })
  }, [])

  // 누르면 바로 바꾸고, 실패하면 되돌림
  const toggle = useCallback(
    async (type, id, on) => {
      const key = keyOf(type, id)
      if (busy.current.has(key)) return
      busy.current.add(key)
      change(key, on)
      try {
        await (on ? addLike(type, id) : removeLike(type, id))
      } catch {
        change(key, !on)
      } finally {
        busy.current.delete(key)
      }
    },
    [change],
  )

  const value = useMemo(() => ({ isLiked: (type, id) => ids.has(keyOf(type, id)), count: ids.size, toggle }), [ids, toggle])

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- 컨텍스트 · 훅 한 파일
export function useLikes() {
  const context = useContext(LikesContext)
  if (!context) throw new Error('useLikes는 LikesProvider 안에서만 쓸 수 있어요')
  return context
}
