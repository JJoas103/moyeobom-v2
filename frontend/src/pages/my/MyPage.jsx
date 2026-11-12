import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Avatar from '../../components/common/Avatar'
import DataState from '../../components/common/DataState'
import { useLikes } from '../../context/LikesContext'
import { useAsync } from '../../utils/useAsync'
import { fetchMyPage } from '../../data/member'
import { PROVIDER_LABEL } from '../../data/constants'
import { mannerTone } from '../../utils/manner'
import PraiseTab from './PraiseTab'
import LikesTab from './LikesTab'
import SettingsTab from './SettingsTab'
import BlocksTab from './BlocksTab'
import SanctionsTab from './SanctionsTab'
import '../../styles/my.css'

const TABS = [
  { key: 'praise', label: '매너 점수' },
  { key: 'likes', label: '찜 목록' },
  { key: 'settings', label: '계정 설정' },
  { key: 'blocks', label: '차단 목록' },
  { key: 'sanctions', label: '받은 제재' },
]

export default function MyPage() {
  const [params] = useSearchParams()
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'praise'
  const [version, setVersion] = useState(0) // 계정 설정 저장 뒤 다시 불러오기
  const { data, loading, error } = useAsync(() => fetchMyPage(), [version])
  const { count: likeCount } = useLikes()

  return (
    <div className="mypage">
      <DataState loading={loading && !data} error={error}>
        {data && <ProfileCard profile={data.profile} stats={data.stats} manner={data.manner} />}
      </DataState>

      <div className="my-tabs mypage__tabs" role="tablist" aria-label="마이 메뉴">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={`/my?tab=${t.key}`}
            replace
            role="tab"
            aria-selected={tab === t.key}
            className={`my-tabs__tab${tab === t.key ? ' is-active' : ''}`}
          >
            {t.label}
            {t.key === 'praise' && data && <span className="my-tabs__count">{data.stats.praiseCount}</span>}
            {t.key === 'likes' && <span className="my-tabs__count">{likeCount}</span>}
          </Link>
        ))}
      </div>

      <section role="tabpanel" aria-label={TABS.find((t) => t.key === tab).label}>
        {tab === 'praise' && data && <PraiseTab praise={data.praise} manner={data.manner} />}
        {tab === 'likes' && <LikesTab />}
        {tab === 'settings' && data && <SettingsTab profile={data.profile} upcoming={data.upcoming} onSaved={() => setVersion((v) => v + 1)} />}
        {tab === 'blocks' && <BlocksTab />}
        {tab === 'sanctions' && <SanctionsTab />}
      </section>
    </div>
  )
}

function ProfileCard({ profile, stats, manner }) {
  return (
    <section className="mypage-profile" aria-label="내 프로필">
      <Avatar user={profile} size={88} />
      <div className="mypage-profile__info">
        <h1>{profile.nickname}</h1>
        <div className="mypage-profile__meta">
          <span className="mypage-chip">{PROVIDER_LABEL[profile.provider]}</span>
        </div>
      </div>
      <div className="mypage-stats">
        <Link to="/my/meetups" className="mypage-stats__item">
          <b>{stats.meetupCount}</b>
          <span>참여한 모임</span>
        </Link>
        <Link to="/friends" className="mypage-stats__item">
          <b>{stats.friendCount}</b>
          <span>친구</span>
        </Link>
        <Link to="/my?tab=praise" replace className="mypage-stats__item">
          <b>{stats.praiseCount}</b>
          <span>좋은 평가</span>
        </Link>
        <Link to="/my?tab=praise" replace className="mypage-stats__item" title={`${mannerTone(manner.score).label} · 어떻게 움직이는지 보기`}>
          <b>{manner.score}</b>
          <span>매너 점수</span>
        </Link>
      </div>
      <Link to="/my?tab=settings" replace className="btn btn--line mypage-btn">
        프로필 수정
      </Link>
    </section>
  )
}
