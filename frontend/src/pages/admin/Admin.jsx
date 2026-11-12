import { Link, useSearchParams } from 'react-router-dom'
import Reports from './Reports'
import Members from './Members'
import '../../styles/admin.css'

// 관리자 — 상단 탭 둘 (신고 처리 · 회원). 탭 틀은 마이페이지(pages/my/MyPage.jsx)와 같은 모양
//
// 신고 상태 개수 배지는 **아래 신고 탭 안**에 둔다 — 여기에도 달면 같은 숫자를 두 번 받아야 한다.
// 기본 탭이 신고라 들어오는 순간 대기 건수가 보인다.
const TABS = [
  { key: 'reports', label: '신고 처리' },
  { key: 'members', label: '회원' },
]

export default function Admin() {
  const [params] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'reports'

  return (
    <div className="admin">
      <header className="admin__head">
        <h1>관리자</h1>
      </header>

      <div className="my-tabs admin__tabs" role="tablist" aria-label="관리자 메뉴">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={`/admin?tab=${t.key}`}
            replace
            role="tab"
            aria-selected={tab === t.key}
            className={`my-tabs__tab${tab === t.key ? ' is-active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <section role="tabpanel" aria-label={TABS.find((t) => t.key === tab).label}>
        {tab === 'reports' ? <Reports /> : <Members />}
      </section>
    </div>
  )
}
