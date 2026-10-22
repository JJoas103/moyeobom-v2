import { useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

export default function Layout({ children }) {
  // 채팅은 화면 높이에 꽉 차게 (푸터 없음)
  const isChat = useLocation().pathname.startsWith('/chat')

  return (
    <div className={`app${isChat ? ' app--fixed' : ''}`}>
      <Header />
      <main className={`page${isChat ? ' page--chat' : ''}`}>
        <div className="container">{children}</div>
      </main>
      {!isChat && <Footer />}
    </div>
  )
}
