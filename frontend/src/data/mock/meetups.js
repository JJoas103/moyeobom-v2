// models/Meetup.js 스키마 그대로의 원본 문서 모양 (event·host 는 ObjectId 문자열).
// populate·계산 필드는 data/meetups.js 에서 API 응답 모양으로 변환
// 모임 제목·장소·닉네임은 모두 가상 예시.
import { at, mockId } from './time'

const EV = (n) => mockId(n) // mock/events.js 의 _id
const USER = (n) => mockId(1000 + n)

export const mockUsers = [
  { _id: USER(1), nickname: '새벽산책' },
  { _id: USER(2), nickname: '필름로그' },
  { _id: USER(3), nickname: '오후네시' },
  { _id: USER(4), nickname: '무대뒤' },
  { _id: USER(5), nickname: '여운수집' },
]

// 승인 a명 + 대기 p명짜리 members 배열
function members(approved, pending = 0) {
  const list = []
  for (let i = 0; i < approved + pending; i++) {
    list.push({
      user: mockId(2000 + i),
      joinType: i % 2 === 0 ? 'watch' : 'talk',
      status: i < approved ? 'approved' : 'pending',
      appliedAt: at(-1),
    })
  }
  return list
}

const NO_WATCH = { enabled: false }

const mockMeetups = [
  {
    _id: mockId(101), event: EV(2), host: USER(1),
    title: '커튼콜 끝나고 넘버 얘기해요',
    intro: '각자 보고, 끝나면 근처에서 넘버 얘기만 해요. 2막 넘버 위주로 이야기 나눠요. 처음 오셔도 괜찮아요.',
    imageUrl: '',
    talk: { startAt: at(2, '22:10'), area: '혜화역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 6,
    watch: { enabled: true, sessionAt: at(2, '19:30'), meetAt: at(2, '19:10'), meetPlace: '공연장 1층 로비' },
    members: members(3, 1), status: 'open',
  },
  {
    _id: mockId(102), event: EV(1), host: USER(2),
    title: '엔딩 크레딧 다 보고 나와서 한 잔',
    intro: '쿠키 영상까지 보고 나온 사람들끼리 결말 해석 나눠요.',
    imageUrl: '',
    talk: { startAt: at(2, '21:50'), area: '용산역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: true, budget: '2to3', capacity: 4,
    watch: NO_WATCH, members: members(3), status: 'open',
  },
  {
    _id: mockId(103), event: EV(4), host: USER(3),
    title: '마지막 방 이야기, 커피 한 잔 하며',
    intro: '천천히 보고 나와서 마지막 방에서 느낀 걸 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(3, '17:30'), area: '삼각지역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: 'under1', capacity: 6,
    watch: { enabled: true, sessionAt: at(3, '15:30'), meetAt: at(3, '15:20'), meetPlace: '전시관 입구' },
    members: members(2), status: 'open',
  },
  {
    _id: mockId(104), event: EV(2), host: USER(5),
    title: '2막 결말, 저만 울었나요',
    intro: '이미 본 분도, 오늘 본 분도 환영해요.',
    imageUrl: '',
    talk: { startAt: at(4, '22:10'), area: '대학로 근처', startTitle: '모여서 이야기 시작' },
    alcohol: true, budget: '2to3', capacity: 5,
    watch: NO_WATCH, members: members(4), status: 'open',
  },
  {
    _id: mockId(105), event: EV(8), host: USER(3),
    title: '앙코르곡 제목 같이 찾아봐요',
    intro: '앙코르곡이 뭐였는지 같이 찾아보고 좋았던 악장 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(4, '21:40'), area: '예술의전당 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 4,
    watch: { enabled: true, sessionAt: at(4, '19:30'), meetAt: at(4, '19:10'), meetPlace: '콘서트홀 로비' },
    members: members(2), status: 'open',
  },
  {
    _id: mockId(106), event: EV(5), host: USER(4),
    title: '편지 마지막 줄 해석 나눠요',
    intro: '낮 공연 보고 이른 저녁에 짧게 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(5, '18:00'), area: '혜화역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 4,
    watch: { enabled: true, sessionAt: at(5, '15:00'), meetAt: at(5, '14:40'), meetPlace: '소극장 매표소 앞' },
    members: members(1, 2), status: 'open',
  },
  {
    _id: mockId(107), event: EV(3), host: USER(5),
    title: '불꽃 끝나고 돗자리 그대로 수다',
    intro: '돗자리는 제가 챙겨요. 불꽃 끝나고 그 자리에서 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(5, '21:00'), area: '여의나루역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: true, budget: 'under1', capacity: 8,
    watch: { enabled: true, sessionAt: at(5, '18:30'), meetAt: at(5, '18:30'), meetPlace: '여의나루역 2번 출구' },
    members: members(3), status: 'open',
  },
  {
    _id: mockId(108), event: EV(9), host: USER(2),
    title: '세트리스트 복기하는 모임',
    intro: '오늘 세트리스트 순서대로 복기해요.',
    imageUrl: '',
    talk: { startAt: at(5, '22:00'), area: '한강진역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: true, budget: '2to3', capacity: 6,
    watch: NO_WATCH, members: members(4), status: 'open',
  },
  {
    _id: mockId(109), event: EV(6), host: USER(1),
    title: '조용히 보고 조용히 이야기해요',
    intro: '큰 소리 없이 차분하게 이야기 나눠요.',
    imageUrl: '',
    talk: { startAt: at(6, '16:30'), area: '합정역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 4,
    watch: { enabled: true, sessionAt: at(6, '14:20'), meetAt: at(6, '14:10'), meetPlace: '상영관 매표소 앞' },
    members: members(1), status: 'open',
  },
  {
    _id: mockId(110), event: EV(7), host: USER(4),
    title: '마지막 공연 보고 식탁 장면 이야기',
    intro: '마지막 공연이에요. 식탁 장면 이야기 실컷 해요.',
    imageUrl: '',
    talk: { startAt: at(4, '21:10'), area: '대학로 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 4,
    watch: NO_WATCH, members: members(4), status: 'closed',
  },
  {
    _id: mockId(111), event: EV(12), host: USER(3),
    title: '무용 처음 본 사람끼리',
    intro: '무용 처음 보는 분들끼리 어떻게 봤는지 편하게 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(6, '21:00'), area: '강남구청역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 6,
    watch: { enabled: true, sessionAt: at(6, '19:30'), meetAt: at(6, '19:10'), meetPlace: '아트센터 로비' },
    members: members(2), status: 'open',
  },
  {
    _id: mockId(112), event: EV(4), host: USER(5),
    title: '사진 찍은 작품 서로 보여주기',
    intro: '각자 찍은 사진 보여주면서 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(7, '15:00'), area: '삼각지역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: 'under1', capacity: 6,
    watch: NO_WATCH, members: members(3), status: 'open',
  },
  {
    _id: mockId(113), event: EV(10), host: USER(1),
    title: '거리극 보고 광장에서 이야기',
    intro: '거리극 몇 편 같이 보고 광장 벤치에서 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(12, '20:30'), area: '시청역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: 'under1', capacity: 8,
    watch: { enabled: true, sessionAt: at(12, '17:30'), meetAt: at(12, '17:30'), meetPlace: '서울광장 분수 앞' },
    members: members(2), status: 'open',
  },
  {
    _id: mockId(114), event: EV(11), host: USER(2),
    title: '좋았던 곡 하나씩 말하기',
    intro: '각자 제일 좋았던 곡 하나씩 말하고 플레이리스트 만들어요.',
    imageUrl: '',
    talk: { startAt: at(13, '21:30'), area: '망원역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: true, budget: '1to2', capacity: 5,
    watch: NO_WATCH, members: members(4), status: 'open',
  },
  {
    _id: mockId(115), event: EV(1), host: USER(4),
    title: '두 번째 본 사람도 환영',
    intro: '두 번 본 사람만 보이는 장면 이야기해요.',
    imageUrl: '',
    talk: { startAt: at(14, '18:20'), area: '왕십리역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 4,
    watch: NO_WATCH, members: members(1), status: 'open',
  },
  {
    _id: mockId(116), event: EV(16), host: USER(5),
    title: '끝난 지 사흘, 아직 여운 남은 분',
    intro: '이미 끝난 공연이지만 아직 생각나는 분들 모여요.',
    imageUrl: '',
    talk: { startAt: at(1, '19:30'), area: '혜화역 근처', startTitle: '모여서 이야기 시작' },
    alcohol: false, budget: '1to2', capacity: 5,
    watch: NO_WATCH, members: members(2), status: 'open',
  },
]

export default mockMeetups
