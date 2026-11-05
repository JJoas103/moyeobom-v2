// 3단계 매너 평가를 눈으로 확인할 더미 모임 2개: npm run seed:review-dummy
//   정리:  node scripts/seedReviewDummy.js --clean
//
// 왜 필요한가 — 평가는 socialRules.reviewWindow 로 '이야기 자리 다음날 12:00 → +48시간' 이라
//   이야기 자리가 과거여야 화면이 열린다. DB 의 모임이 전부 미래라 열어 볼 방법이 없었다.
//
// ⚠ 팀 공유 Atlas(.env 의 MONGODB_URI)에 쓴다. 노출을 줄이려고 이렇게 넣는다.
//   · 이야기 자리가 과거 → meetupService.listMeetups 가 거르므로 /meetup 목록에 안 뜬다
//   · status: 'closed'  → eventService.meetupStats 는 날짜로 안 거르므로 행사 카드 모임 수가 오른다.
//                         closed 면 '모집 중' 수(openMeetupCount)는 안 오른다
//   · 이미 끝난 행사에 붙인다 · 제목에 [더미] 를 붙인다
//   · 회원은 새로 만들지 않는다 — 이미 있는 demo.*@example.com 을 쓰고 비밀번호도 안 건드린다
//
// 고정 _id 로 넣으므로 여러 번 돌려도 쌓이지 않는다 (넣기 전에 정리를 먼저 돈다).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const User = require('../models/User');
const MannerLog = require('../models/MannerLog');
const Notification = require('../models/Notification');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const chatService = require('../services/chatService');
const mannerService = require('../services/mannerService');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const kst = (s) => new Date(s + '+09:00'); // '2026-11-04T19:00:00' → KST 로 읽는다
const seoul = (d) => d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

const ID_OPEN = 'de0000000000000000000a01'; // ① 평가 열림
const ID_CLOSED = 'de0000000000000000000a02'; // ② 평가 마감
const ID_BIG = 'de0000000000000000000a03'; // ③ 10명 — 카드 많을 때
const IDS = [ID_OPEN, ID_CLOSED, ID_BIG];

const HOST = 'kor03187@naver.com'; // 지금 로그인해 쓰는 계정이라야 화면이 보인다
const DEMO_6 = [
  'demo.hayoon@example.com',
  'demo.dohyun@example.com',
  'demo.seoyeon@example.com',
  'demo.minjun@example.com',
  'demo.yuna@example.com',
  'demo.jiwoo@example.com',
];
const MEMBERS_OPEN = DEMO_6.slice(0, 3);
const MEMBERS_CLOSED = DEMO_6.slice(3, 6);

// ③ 은 10명이 필요한데 쓸 수 있는 회원이 6명뿐이라 4명을 더 만든다.
// **팀원 실제 계정은 쓰지 않는다** — 남의 '내 모임'에 더미가 떠 버린다.
// 비밀번호를 넣지 않아 로그인할 수 없는 껍데기다. --clean 이 **이 4명만** 지운다
// (원래 있던 DEMO_6 는 건드리지 않는다).
const NEW_USERS = [
  { email: 'demo.chaewon@example.com', nickname: '윤채원' },
  { email: 'demo.jinho@example.com', nickname: '서진호' },
  { email: 'demo.areum@example.com', nickname: '임아름' },
  { email: 'demo.taeyang@example.com', nickname: '강태양' },
];
const MEMBERS_BIG = [...DEMO_6, ...NEW_USERS.map((u) => u.email)]; // 10명 = capacity 상한

const EVENT_OPEN = '6acddf55b7266c3af66661bb'; // 심산영화관 [인생은 아름다워] — 11-03 종료
const EVENT_CLOSED = '6acddf55b7266c3af66661bd'; // 리비툼 오케스트라 — 11-01 종료
const EVENT_BIG = '6acddf55b7266c3af66661cf'; // 서울어텀페스타 [숨비소리] — 11-02 종료

/** 이메일 → User. 하나라도 없으면 멈춘다 (없는 회원을 새로 만들지 않는다) */
async function loadUsers(emails) {
  const docs = await User.find({ email: { $in: emails } }, { email: 1, nickname: 1 }).lean();
  const byEmail = new Map(docs.map((u) => [u.email, u]));
  const missing = emails.filter((e) => !byEmail.has(e));
  if (missing.length) throw new Error('회원을 찾을 수 없습니다: ' + missing.join(', '));
  return emails.map((e) => byEmail.get(e));
}

/** ③ 에 쓸 회원 4명을 없으면 만든다. 이미 있으면 그대로 쓴다 (여러 번 돌려도 안전) */
async function ensureNewUsers() {
  const made = [];
  for (const u of NEW_USERS) {
    const found = await User.findOne({ email: u.email }, { _id: 1 }).lean();
    if (found) continue;
    await User.create({ ...u, provider: 'local' }); // password 없음 — 로그인 불가
    made.push(u.nickname);
  }
  return made;
}

const member = (user, appliedAt) => ({
  user: user._id,
  joinType: 'talk',
  status: 'approved',
  appliedAt,
  approvedAt: appliedAt,
});

/**
 * 넣은 것만 정확히 지우고 점수를 되돌린다.
 * 점수는 **남은 이력으로 다시 계산한다** — 그냥 50 으로 덮으면 다른 이력이 있을 때
 * 불변식(점수 = 50 + Σ scoreChange)이 깨진다 (scripts/checkMannerLedger.js 가 잡는다).
 */
async function clean() {
  const ids = IDS.map(oid);

  // 점수를 되돌릴 대상을 먼저 모은다 (이력을 지우고 나면 알 수 없다)
  const touched = (await MannerLog.distinct('user', { meetup: { $in: ids } })).map(String);

  const rooms = await ChatRoom.distinct('_id', { meetup: { $in: ids } });
  const del = {
    메시지: (await ChatMessage.deleteMany({ room: { $in: rooms } })).deletedCount,
    채팅방: (await ChatRoom.deleteMany({ meetup: { $in: ids } })).deletedCount,
    평가: (await Review.deleteMany({ meetup: { $in: ids } })).deletedCount,
    알림: (await Notification.deleteMany({ meetup: { $in: ids } })).deletedCount,
    매너이력: (await MannerLog.deleteMany({ meetup: { $in: ids } })).deletedCount,
    모임: (await Meetup.deleteMany({ _id: { $in: ids } })).deletedCount,
  };

  for (const userId of touched) {
    const [row] = await MannerLog.aggregate([
      { $match: { user: oid(userId) } },
      { $group: { _id: null, sum: { $sum: '$scoreChange' } } },
    ]);
    const sum = row?.sum || 0;
    const score = Math.min(mannerService.MAX, Math.max(mannerService.MIN, mannerService.BASE + sum));
    await User.updateOne({ _id: oid(userId) }, { $set: { 'manner.score': score } });
    const u = await User.findById(userId, { nickname: 1 }).lean();
    console.log('  점수 되돌림: ' + (u?.nickname || userId) + ' → ' + score + ' (50 + 남은 이력 ' + sum + ')');
  }

  // 이 스크립트가 만든 회원만 지운다 (DEMO_6 · 실제 회원은 건드리지 않는다).
  // 점수 되돌림 뒤에 지운다 — 위 루프가 닉네임을 찍으려면 아직 있어야 한다
  const removed = await User.deleteMany({ email: { $in: NEW_USERS.map((u) => u.email) } });
  del['만든 회원'] = removed.deletedCount;

  console.log('  지움: ' + Object.entries(del).map(([k, v]) => k + ' ' + v).join(' · '));
  return del;
}

async function seed() {
  const [host] = await loadUsers([HOST]);
  const openMembers = await loadUsers(MEMBERS_OPEN);
  const closedMembers = await loadUsers(MEMBERS_CLOSED);

  console.log('호스트: ' + host.nickname + ' (' + host.email + ')');
  console.log('기존 더미 정리');
  await clean();

  // 정리가 만든 회원을 지우므로 그 **뒤에** 다시 만든다
  const made = await ensureNewUsers();
  console.log('  회원 ' + made.length + '명 만듦' + (made.length ? ': ' + made.join(' · ') : ''));
  const bigMembers = await loadUsers(MEMBERS_BIG);

  // ── ① 평가가 열려 있는 모임 — 화면에서 3단계를 직접 눌러 본다
  const openTalk = kst('2026-11-04T19:00:00');
  const a = await Meetup.create({
    _id: oid(ID_OPEN),
    event: oid(EVENT_OPEN),
    host: host._id,
    title: '[더미] 평가 열림 — 3단계 눌러 보기',
    intro: '매너 평가 화면을 확인하려고 넣은 더미 모임이에요.',
    talk: {
      startAt: openTalk,
      place: '반포동 들숨카페 2층 안쪽 테이블',
      area: '고속터미널역 근처',
      startTitle: '영화 보고 나온 얘기부터',
    },
    alcohol: false,
    budget: '1to2',
    capacity: 4,
    watch: { enabled: false },
    members: openMembers.map((u) => member(u, kst('2026-11-02T10:00:00'))),
    status: 'closed',
  });

  // ── ② 평가가 마감된 모임 — 과반 감점을 cron 이 반영하는지 본다
  const closedTalk = kst('2026-11-01T19:00:00');
  const b = await Meetup.create({
    _id: oid(ID_CLOSED),
    event: oid(EVENT_CLOSED),
    host: host._id,
    title: '[더미] 평가 마감 — 과반 감점 확인',
    intro: '평가가 이미 마감된 더미 모임이에요. review:daily 가 점수를 반영합니다.',
    talk: {
      startAt: closedTalk,
      place: '월계동 숲속책방 모임실',
      area: '월계역 근처',
      startTitle: '연주 어땠는지 한 바퀴',
    },
    alcohol: false,
    budget: 'under1',
    capacity: 4,
    watch: { enabled: false },
    members: closedMembers.map((u) => member(u, kst('2026-10-30T10:00:00'))),
    status: 'closed',
  });

  // 채팅방 — 이미 멱등한 chatService 를 재사용한다.
  // ② 는 방이 닫힐 시각(평가 마감)이 지나서 null 이 돌아온다 — 실제 동작이고 정상이다
  const roomA = await chatService.ensureMeetupRoom(a.toObject());
  const roomB = await chatService.ensureMeetupRoom(b.toObject());

  // ── ② 의 평가 4건. 호스트를 3명이 아쉽다고 한다 (count 3 · raters 3 → 과반 통과)
  const [minjun, yuna, jiwoo] = closedMembers;
  const reviews = [
    { reviewer: host._id, praised: [minjun._id], disappointed: [] },
    { reviewer: minjun._id, praised: [], disappointed: [host._id] },
    { reviewer: yuna._id, praised: [], disappointed: [host._id] },
    { reviewer: jiwoo._id, praised: [], disappointed: [host._id] },
  ];
  for (const r of reviews) {
    await Review.create({ meetup: b._id, again: [], ...r });
    // 실제 제출 흐름(reviewService.submitReview)이 하는 일 — 빠뜨리면 불변식 검산이 실제와 달라진다
    await mannerService.reviewSubmitted(r.reviewer, b.toObject());
  }

  // ── ③ 10명 모임 — 카드가 많을 때 어떻게 보이는지 눈으로 확인하는 용도. 평가는 안 넣는다
  const big = await Meetup.create({
    _id: oid(ID_BIG),
    event: oid(EVENT_BIG),
    host: host._id,
    title: '[더미] 10명 — 카드 많을 때',
    intro: '평가 화면에 카드가 10장일 때 어떻게 보이는지 확인하려고 넣은 더미 모임이에요.',
    talk: {
      startAt: openTalk, // ① 과 같은 날 — 평가가 열려 있어야 화면을 볼 수 있다
      place: '서초동 숨비소리홀 옆 카페',
      area: '방배역 근처',
      startTitle: '다 같이 돌아가며 한마디',
    },
    alcohol: false,
    budget: '2to3',
    capacity: 10, // 스키마 상한 — 승인 10명과 같다
    watch: { enabled: false },
    members: bigMembers.map((u) => member(u, kst('2026-10-29T10:00:00'))),
    status: 'closed',
  });
  const roomC = await chatService.ensureMeetupRoom(big.toObject());

  console.log('');
  console.log('① ' + a.title);
  console.log('   이야기 자리 ' + seoul(openTalk) + ' · 참여 ' + openMembers.map((u) => u.nickname).join(' · '));
  console.log('   채팅방 ' + (roomA ? '만듦' : '없음') + ' · 평가 0건');
  console.log('   http://localhost:5173/meetup/' + a._id + '/review');
  console.log('');
  console.log('② ' + b.title);
  console.log('   이야기 자리 ' + seoul(closedTalk) + ' · 참여 ' + closedMembers.map((u) => u.nickname).join(' · '));
  console.log('   채팅방 ' + (roomB ? '만듦' : '없음 (평가 마감이 지나 안 만든다 — 정상)') + ' · 평가 ' + reviews.length + '건');
  console.log('   ' + host.nickname + ' 을(를) 3명이 아쉬웠어요 → 과반 통과');
  console.log('');
  console.log('③ ' + big.title);
  console.log('   이야기 자리 ' + seoul(openTalk) + ' · 참여 ' + bigMembers.length + '명 ' + bigMembers.map((u) => u.nickname).join(' · '));
  console.log('   채팅방 ' + (roomC ? '만듦' : '없음') + ' · 평가 0건');
  console.log('   http://localhost:5173/meetup/' + big._id + '/review');
  console.log('');
  console.log('다음: npm run review:daily  → 점수 반영 (' + host.nickname + ' 개설 +5 없음 · review_low -3)');
  console.log('      npm run manner:check  → 불변식 확인');
  console.log('      /my?tab=praise        → 이력 · 알림 확인');
}

async function main() {
  const isClean = process.argv.includes('--clean');
  await connectDB();
  try {
    if (isClean) {
      console.log('더미 정리');
      await clean();
      console.log('정리 끝 — npm run manner:check 로 불변식을 확인하세요');
    } else {
      await seed();
    }
  } catch (err) {
    console.error('실패:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
  await mongoose.disconnect();
  process.exit(0);
}

main();
