import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../api'
import { useAuth } from './AuthContext'

// Socket.IO 연결 — 로그인한 동안 하나만. 서버가 세션으로 사용자를 확인하고 내 user 방으로만 보냄
const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)
  const userId = user?._id

  useEffect(() => {
    if (!userId) return undefined
    const s = io(API_BASE_URL, { withCredentials: true })
    setSocket(s)
    return () => {
      s.disconnect() // 정리 필수 — 안 하면 연결이 쌓인다
      setSocket(null)
    }
  }, [userId])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

/**
 * 서버 이벤트 구독 — handler 는 매 렌더 바뀌어도 됨 (마지막 것을 부름)
 *   useSocketEvent('chat:message', ({ roomId, message }) => ...)
 */
// eslint-disable-next-line react-refresh/only-export-components -- 컨텍스트 · 훅 한 파일
export function useSocketEvent(event, handler) {
  const socket = useContext(SocketContext)
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!socket) return undefined
    const listener = (payload) => handlerRef.current(payload)
    socket.on(event, listener)
    return () => socket.off(event, listener)
  }, [socket, event])
}
