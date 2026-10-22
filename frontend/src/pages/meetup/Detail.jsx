import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import DataState from '../../components/common/DataState'
import SectionHead from '../../components/common/SectionHead'
import { ChatIcon, LockIcon } from '../../components/common/Icons'
import ErrorMessage from '../../components/ErrorMessage'
import MeetupHero from '../../components/meetup/MeetupHero'
import MeetupTimeline from '../../components/meetup/MeetupTimeline'
import MeetupMembers from '../../components/meetup/MeetupMembers'
import EventMiniCard from '../../components/meetup/EventMiniCard'
import NearbyInfo from '../../components/meetup/NearbyInfo'
import ApplyBox from '../../components/meetup/ApplyBox'
import { useAsync } from '../../utils/useAsync'
import { fetchMeetup } from '../../data/meetups'
import { categoryOf } from '../../data/constants'
import { meetupStatus } from '../../utils/status'
import { posterTone } from '../../utils/poster'
import '../../styles/detail.css'
import '../../styles/meetup-detail.css'

// 시안 v2 · 모임 상세 (V2MeetupDetail — B안 타임라인 + A안 상단)
export default function MeetupDetail() {
  const { id } = useParams()
  const [version, setVersion] = useState(0) // 신청 · 승인 뒤 다시 불러오기
  const { data: meetup, loading, error } = useAsync(() => fetchMeetup(id), [id, version])
  const reload = () => setVersion((v) => v + 1)

  if (error?.status === 404) {
    return <ErrorMessage title="모임을 찾을 수 없어요" message="호스트가 모임을 닫았거나 주소가 바뀌었을 수 있어요." />
  }

  return (
    <DataState loading={loading && !meetup} error={error}>
      {meetup && <MeetupDetailView key={meetup._id} meetup={meetup} onChange={reload} />}
    </DataState>
  )
}

// 만들기 · 수정 · 상태 변경 뒤 넘어왔을 때 안내 [굵게, 이어지는 문장]
const NAV_NOTICE = {
  created: ['모임을 만들었어요.', '신청이 오면 알림으로 알려드릴게요. 모임 채팅방도 열렸어요.'],
  updated: ['수정 내용을 저장했어요.', ''],
  closed: ['모집을 마감했어요.', '새 신청을 받지 않아요. 수정 화면에서 다시 열 수 있어요.'],
  open: ['다시 모집을 시작했어요.', ''],
}

function MeetupDetailView({ meetup, onChange }) {
  const { event } = meetup
  const cat = categoryOf(event?.category)
  const status = meetupStatus(meetup)
  const navState = useLocation().state || {}
  const notice = NAV_NOTICE[navState.created ? 'created' : navState.updated ? 'updated' : navState.statusChanged]
  const canChat = meetup.status !== 'cancelled' && (meetup.isHost || meetup.myMembership?.status === 'approved')

  return (
    <div className="detail">
      {meetup.status === 'cancelled' ? (
        <div className="notice notice--muted" role="status">
          <strong>취소된 모임이에요.</strong> 호스트가 모임을 취소해서 더 이상 신청할 수 없어요.
        </div>
      ) : (
        notice && (
          <div className="notice" role="status">
            <strong>{notice[0]}</strong> {notice[1]}
          </div>
        )
      )}
      <nav className="breadcrumb" aria-label="위치">
        <Link to="/meetup">모임</Link> › <Link to={`/meetup?category=${event?.category}`}>{cat.label}</Link> ›{' '}
        <Link to={`/event/${event?._id}`}>{event?.title}</Link>
      </nav>

      <div className="detail__grid">
        <div className="detail__main detail__main--meetup">
          <MeetupHero meetup={meetup} status={status} />
          <MeetupTimeline meetup={meetup} />

          {/* ---------- 호스트의 한마디 ---------- */}
          <section className="detail-section">
            <SectionHead title="호스트의 한마디" />
            <div className="host-row">
              <span className="avatar avatar--lg" style={{ background: posterTone(meetup.host?._id).bg }} aria-hidden="true" />
              <span className="host-row__text">
                <span className="host-row__name">
                  {meetup.host?.nickname || '호스트'} <span>호스트</span>
                </span>
                {meetup.host?.hostedCount > 0 && <span className="host-row__sub">모임을 {meetup.host.hostedCount}번 열었어요</span>}
              </span>
            </div>
            {meetup.intro && <p className="host-quote">{meetup.intro}</p>}
          </section>

          <MeetupMembers meetup={meetup} status={status} onChange={onChange} />

          {/* ---------- 모임 채팅 (확정 참여자는 열기, 그 밖은 잠금) ---------- */}
          <section className="detail-section">
            <SectionHead title="모임 채팅" />
            <div className="chat-lock">
              <div className="chat-lock__preview" aria-hidden="true">
                <span>어디쯤 계세요? 입구 쪽에 있을게요</span>
                <span>오늘 제일 좋았던 장면 다들 생각해 오세요</span>
                <span className="is-mine">저 조금 늦을 것 같아요</span>
              </div>
              {canChat ? (
                <Link to={`/chat/meetup/${meetup._id}`} className="chat-lock__badge chat-lock__badge--open">
                  <ChatIcon />
                  모임 채팅 열기
                </Link>
              ) : (
                <div className="chat-lock__badge">
                  <LockIcon />
                  {meetup.status === 'cancelled' ? '취소된 모임이에요' : '승인되면 모임 채팅에 들어갈 수 있어요'}
                </div>
              )}
            </div>
          </section>

          <section className="detail-section">
            <SectionHead title="이 모임의 행사" />
            <EventMiniCard event={event} />
          </section>

          <NearbyInfo event={event} />
        </div>

        <ApplyBox meetup={meetup} status={status} onChange={onChange} />
      </div>
    </div>
  )
}
