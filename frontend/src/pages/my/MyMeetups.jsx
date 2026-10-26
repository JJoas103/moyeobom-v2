import { Link, NavLink, useSearchParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import MeetupCard from '../../components/meetup/MeetupCard'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../utils/useAsync'
import { fetchMyMeetups } from '../../data/meetups'
import { JOIN_LABEL } from '../../data/constants'
import '../../styles/list.css'
import '../../styles/my.css'

// 내 모임 — 내가 연 모임 / 참여한 모임 탭, 각 탭은 다가오는 모임 · 지난 모임 카드
//   매너 온도는 산정 방식 미결정이라 표시하지 않음
const TABS = [
  { key: 'hosted', label: '내가 연 모임' },
  { key: 'joined', label: '참여한 모임' },
]

export default function MyMeetups() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'hosted'
  const { data, loading, error } = useAsync(() => fetchMyMeetups(), [])

  const total = data ? data.hosted.length + data.joined.length : null
  const list = data?.[tab] || []
  const now = new Date()
  const upcoming = list.filter((m) => new Date(m.talk.startAt) > now)
  const past = list.filter((m) => new Date(m.talk.startAt) <= now)

  return (
    <div className="my-page">
      <div className="page-head">
        <h1>{user.nickname}님의 모임</h1>
        <span className="spacer" />
        {data && (
          <span className="my-page__stats">
            모임 {total} · <Link to="/friends">친구 {data.friendCount}</Link>
          </span>
        )}
      </div>

      <div className="my-tabs" role="tablist">
        {TABS.map((t) => (
          <NavLink
            key={t.key}
            to={`/my/meetups?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={() => `my-tabs__tab${tab === t.key ? ' is-active' : ''}`}
          >
            {t.label}
            {data && <span className="my-tabs__count">{data[t.key].length}</span>}
          </NavLink>
        ))}
      </div>

      <DataState loading={loading} error={error}>
        {data &&
          (list.length === 0 ? (
            <EmptyTab tab={tab} />
          ) : (
            <>
              <MeetupSection title="다가오는 모임" meetups={upcoming} tab={tab} />
              <MeetupSection title="지난 모임" meetups={past} tab={tab} />
            </>
          ))}
      </DataState>
    </div>
  )
}

function MeetupSection({ title, meetups, tab }) {
  if (meetups.length === 0) return null
  return (
    <section className="my-section">
      <h2 className="my-section__title">
        {title} <span>{meetups.length}</span>
      </h2>
      <div className="card-grid my-grid">
        {meetups.map((m) => (
          <MeetupCard key={m._id} meetup={m} note={tab === 'joined' ? <MembershipNote meetup={m} /> : null} />
        ))}
      </div>
    </section>
  )
}

// 참여한 모임 카드 — 내 신청 상태 · 참여 방식
function MembershipNote({ meetup }) {
  const mine = meetup.myMembership
  if (!mine) return null
  const pending = mine.status === 'pending'
  return (
    <span className={`card__kind one-line${pending ? ' my-note--pending' : ''}`}>
      {pending ? '승인 기다리는 중' : '참여 확정'} · {JOIN_LABEL[mine.joinType]}
    </span>
  )
}

function EmptyTab({ tab }) {
  return tab === 'hosted' ? (
    <div className="state-box">
      <strong>아직 연 모임이 없어요</strong>
      보고 싶은 행사로 끝나고 이야기할 모임을 열어 보세요.
      <div className="my-empty__action">
        <Link to="/meetup/new" className="btn btn--primary">
          모임 만들기
        </Link>
      </div>
    </div>
  ) : (
    <div className="state-box">
      <strong>아직 참여한 모임이 없어요</strong>
      마음에 드는 모임에 참여 신청해 보세요.
      <div className="my-empty__action">
        <Link to="/meetup" className="btn btn--line">
          모임 둘러보기
        </Link>
      </div>
    </div>
  )
}
