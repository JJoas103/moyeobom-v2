// 병합분 전체를 손으로 테스트할 더미 데이터: npm run seed:test
//   정리:  npm run seed:test -- --clean
//
// 기능별로 필요한 상태가 달라서 모임을 8건 만든다. 코드를 읽어 확인한 제약 둘이 이 구조를 정했다.
//   · 참여자 관리와 평가는 한 모임에서 같이 못 본다 — ApplyBox 가 이야기 자리 뒤엔 ReviewBox 로 바뀐다
//     → 미래 모임(관리) · 과거 모임(평가) 를 따로 만든다
//   · '모임 신고하기'는 승인된 참여자 + 모임 채팅방이 보일 때만 뜬다 (chatService.canReportInMeetupRoom)
//     → 수민이 참여자인 과거 모임이 필요하다. 호스트는 자기를 신고할 수 없다
//   · ensureMeetupRoom 은 평가 마감이 지난 모임에 방을 안 만든다 → 채팅 쓸 모임은 이야기 자리가 어제
//
// 방침: **상태를 모델에 직접 꽂지 않고 실제 서비스 함수로 만든다.**
//   applyMeetup · approveMember · setMeetupStatus · makeFriends · ensureMeetupRoom · sendMessage …
//   그러면 알림 · 채팅방 · 매너 이력 · 불변식이 알아서 맞게 따라온다.
//   직접 꽂는 건 서비스가 못 하는 것만 — 과거 날짜 모임과 이미 들어온 평가다.
//
// ⚠ 팀 공유 Atlas 에 쓴다. 이번엔 A·B·G·H 가 **미래 모임이라 팀원의 /meetup 목록에 보인다**
//   (참여자 관리를 테스트하려면 미래여야 한다). 제목 [더미] 접두사로 가짜임을 알리고,
//   **테스트가 끝나면 바로 npm run seed:test -- --clean 으로 지운다.**
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
const Friendship = require('../models/Friendship');
const Report = require('../models/Report');
const Block = require('../models/Block');
const chatService = require('../services/chatService');
const friendService = require('../services/friendService');
const mannerService = require('../services/mannerService');
const meetupService = require('../services/meetupService');
const userService = require('../services/userService');

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const kst = (s) => new Date(s + '+09:00');
const DAY = 24 * 60 * 60 * 1000;
/**
 * 오늘 기준 n일 뒤(음수면 전) 19:00 KST — 날짜가 지나도 스크립트가 계속 맞게 동작한다.
 *
 * ⚠ 평가를 '열림' 상태로 만들려면 **-2** 여야 한다. 평가는 이야기 자리 **다음날 12:00** 에 열리므로
 *   -1 로 두면 오전에 돌릴 때 아직 opensAt 전(before)이라 평가 화면이 안 열린다.
 *   -2 면 opensAt 이 어제 12:00, closesAt 이 내일 12:00 이라 **하루 종일 open** 이고
 *   ensureMeetupRoom 도 방을 만든다(마감 전이라야 만든다).
 */
function dayAt(offset, hour = 19) {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const ymd = new Date(kstNow.getTime() + offset * DAY).toISOString().slice(0, 10);
  return kst(`${ymd}T${String(hour).padStart(2, '0')}:00:00`);
}

/** 지금부터 n시간 뒤 — dayAt 은 날짜 단위라 '이야기 자리까지 24시간 안' 을 만들 수 없다 */
const hoursAt = (n) => new Date(Date.now() + n * 60 * 60 * 1000);

const HOST = 'kor03187@naver.com'; // 로그인해 쓰는 계정이라야 화면이 보인다

// 이미 있는 더미 회원 — 비밀번호가 없어 로그인은 못 한다 (건드리지 않는다)
const DEMO_6 = [
  'demo.hayoon@example.com', // 김하윤
  'demo.dohyun@example.com', // 박도현
  'demo.seoyeon@example.com', // 이서연
  'demo.minjun@example.com', // 최민준
  'demo.yuna@example.com', // 정유나
  'demo.jiwoo@example.com', // 한지우
];

// 반대편에서 눌러 봐야 확인되는 게 있어서(상호 '또 만나고 싶어요' → 친구 성립 등)
// **로그인 가능한** 더미를 따로 만든다. --clean 이 이 4명만 지운다
const PASSWORD = 'moyeobom!23'; // validationMiddleware 의 규칙 통과 (영문+숫자+특수문자 8자 이상)
const NEW_USERS = [
  { email: 'demo.chaewon@example.com', nickname: '윤채원' },
  { email: 'demo.jinho@example.com', nickname: '서진호' },
  { email: 'demo.areum@example.com', nickname: '임아름' },
  { email: 'demo.taeyang@example.com', nickname: '강태양' },
];

// 끝난 행사 중 모임이 안 붙은 것들 — 팀원이 보는 '모집 중' 화면에서 가장 멀다
const EVENTS = {
  A: '6acddf55b7266c3af666620b',
  B: '6acddf55b7266c3af6666259',
  C: '6acddf55b7266c3af66661bb',
  D: '6acddf55b7266c3af66661cf',
  E: '6acddf55b7266c3af6666236',
  F: '6acddf56b7266c3af6666284',
  G: '6acddf55b7266c3af66661be',
  H: '6acddf55b7266c3af6666230',
  I: '6acddf55b7266c3af66661bf',
};

const ID = {
  A: 'de0000000000000000000a01',
  B: 'de0000000000000000000a02',
  C: 'de0000000000000000000a03',
  D: 'de0000000000000000000a04',
  E: 'de0000000000000000000a05',
  F: 'de0000000000000000000a06',
  G: 'de0000000000000000000a07',
  H: 'de0000000000000000000a08',
  I: 'de0000000000000000000a09',
};
const IDS = Object.values(ID);

// ---------- 공용 ----------

/** 이메일 → User. 하나라도 없으면 멈춘다 */
async function loadUsers(emails) {
  const docs = await User.find({ email: { $in: emails } }, { email: 1, nickname: 1 }).lean();
  const byEmail = new Map(docs.map((u) => [u.email, u]));
  const missing = emails.filter((e) => !byEmail.has(e));
  if (missing.length) throw new Error('회원을 찾을 수 없습니다: ' + missing.join(', '));
  return emails.map((e) => byEmail.get(e));
}

/** 로그인 가능한 더미를 없으면 만든다 (userService.createUser 재사용 — 해싱·필수 필드 처리됨) */
async function ensureNewUsers() {
  const made = [];
  for (const u of NEW_USERS) {
    if (await User.exists({ email: u.email })) continue;
    await userService.createUser({ ...u, password: PASSWORD, tastes: ['play', 'exhibition'], districts: ['종로구'] });
    made.push(u.nickname);
  }
  return made;
}

const member = (user, status, appliedAt) => ({
  user: user._id,
  joinType: 'talk',
  status,
  appliedAt,
  ...(status === 'approved' && { approvedAt: appliedAt }),
});

/** 모임 한 건 — 과거 날짜는 서비스가 거부하므로 모델에 직접 넣는다 */
function makeMeetup({ id, event, host, title, intro, startAt, place, area, startTitle, budget, capacity, members, status }) {
  return Meetup.create({
    _id: oid(id),
    event: oid(event),
    host: host._id,
    title,
    intro,
    talk: { startAt, place, area, startTitle },
    alcohol: false,
    budget,
    capacity,
    watch: { enabled: false },
    members: members || [],
    status: status || 'open',
  });
}

// ---------- 정리 ----------

/**
 * 넣은 것만 정확히 지우고 점수를 되돌린다.
 * 점수는 **남은 이력으로 다시 계산한다** — 50 으로 덮으면 다른 이력이 있을 때
 * 불변식(점수 = 50 + Σ scoreChange)이 깨진다 (scripts/checkMannerLedger.js 가 잡는다).
 */
async function clean() {
  const ids = IDS.map(oid);
  const newEmails = NEW_USERS.map((u) => u.email);
  const newIds = (await User.find({ email: { $in: newEmails } }, { _id: 1 }).lean()).map((u) => u._id);
  const [host] = await loadUsers([HOST]).catch(() => [null]);

  // 점수를 되돌릴 대상을 먼저 모은다 (이력을 지우고 나면 알 수 없다)
  const touched = (await MannerLog.distinct('user', { meetup: { $in: ids } })).map(String);

  // 1:1 방은 모임 참조가 없을 수 있어 친구 문서에서 거슬러 찾는다
  const friendRooms = (await Friendship.find({ meetup: { $in: ids } }, { room: 1 }).lean()).map((f) => f.room).filter(Boolean);
  const rooms = [...(await ChatRoom.distinct('_id', { meetup: { $in: ids } })), ...friendRooms];

  const del = {
    // 더미에서 만든 신고 — **방 기준**으로만 지운다. reporter/target 기준으로 지우면
    // 수민이 끼어 있는 실제 신고까지 날아간다 (옛 신고는 room 이 비어 있다)
    신고: (await Report.deleteMany({ room: { $in: rooms } })).deletedCount,
    메시지: (await ChatMessage.deleteMany({ room: { $in: rooms } })).deletedCount,
    채팅방: (await ChatRoom.deleteMany({ _id: { $in: rooms } })).deletedCount,
    평가: (await Review.deleteMany({ meetup: { $in: ids } })).deletedCount,
    알림: (await Notification.deleteMany({ meetup: { $in: ids } })).deletedCount,
    친구: (await Friendship.deleteMany({ meetup: { $in: ids } })).deletedCount,
    매너이력: (await MannerLog.deleteMany({ meetup: { $in: ids } })).deletedCount,
    모임: (await Meetup.deleteMany({ _id: { $in: ids } })).deletedCount,
  };
  // 차단 — 이 스크립트가 만든 것만 (수민 → 더미)
  if (host) {
    del['차단'] = (await Block.deleteMany({ blocker: host._id, blocked: { $in: await demoUserIds() } })).deletedCount;
  }

  for (const userId of touched) {
    const [row] = await MannerLog.aggregate([
      { $match: { user: oid(userId) } },
      { $group: { _id: null, sum: { $sum: '$scoreChange' } } },
    ]);
    const sum = row?.sum || 0;
    const score = Math.min(mannerService.MAX, Math.max(mannerService.MIN, mannerService.BASE + sum));
    await User.updateOne({ _id: oid(userId) }, { $set: { 'manner.score': score } });
    const u = await User.findById(userId, { nickname: 1 }).lean();
    console.log(`  점수 되돌림: ${u?.nickname || userId} → ${score} (50 + 남은 이력 ${sum})`);
  }

  // 만든 회원이 남긴 것도 치운다 (다른 더미 모임 밖에서 생긴 알림 · 이력)
  if (newIds.length) {
    await Notification.deleteMany({ user: { $in: newIds } });
    await MannerLog.deleteMany({ user: { $in: newIds } });
    await Friendship.deleteMany({ $or: [{ userA: { $in: newIds } }, { userB: { $in: newIds } }] });
    await Block.deleteMany({ $or: [{ blocker: { $in: newIds } }, { blocked: { $in: newIds } }] });
  }
  del['만든 회원'] = (await User.deleteMany({ email: { $in: newEmails } })).deletedCount;

  console.log('  지움: ' + Object.entries(del).map(([k, v]) => `${k} ${v}`).join(' · '));
  return del;
}

const demoUserIds = async () =>
  (await User.find({ email: { $in: [...DEMO_6, ...NEW_USERS.map((u) => u.email)] } }, { _id: 1 }).lean()).map((u) => u._id);

// ---------- 넣기 ----------

async function seed() {
  const [host] = await loadUsers([HOST]);
  console.log(`호스트/로그인 계정: ${host.nickname} (${host.email})`);
  console.log('기존 더미 정리');
  await clean();

  const made = await ensureNewUsers();
  console.log(`  로그인 가능한 회원 ${made.length}명 만듦${made.length ? ': ' + made.join(' · ') : ''}`);

  const [hayoon, dohyun, seoyeon, minjun, yuna, jiwoo] = await loadUsers(DEMO_6);
  const [chaewon, jinho, areum, taeyang] = await loadUsers(NEW_USERS.map((u) => u.email));
  const all10 = [hayoon, dohyun, seoyeon, minjun, yuna, jiwoo, chaewon, jinho, areum, taeyang];
  const out = [];

  // ── A 참여자 관리 (미래) — 승인 2 + 대기 3.
  //    멤버십은 서비스로 만든다 → meetup_apply 알림과 채팅방이 함께 생긴다
  const a = await makeMeetup({
    id: ID.A, event: EVENTS.A, host,
    title: '[더미] 신청자 대기 중 — 참여자 관리',
    intro: '승인 · 거절 · 내보내기 · 참여자 신고를 눌러 보는 더미예요.',
    startAt: dayAt(3), place: '종로 세로카페 2층', area: '안국역 근처',
    startTitle: '전시 본 얘기부터', budget: '1to2', capacity: 6,
  });
  await chatService.ensureMeetupRoom(a.toObject());
  for (const u of [hayoon, dohyun]) {
    await meetupService.applyMeetup(a._id, u._id, 'talk');
    await meetupService.approveMember(a._id, host._id, u._id);
  }
  for (const u of [seoyeon, minjun, yuna]) await meetupService.applyMeetup(a._id, u._id, 'talk');
  out.push(['A', a, '참여자 관리 — 승인 2 · 대기 3', `/meetup/${a._id}`]);

  // ── B 정원 꽉 찬 모임 (미래)
  const b = await makeMeetup({
    id: ID.B, event: EVENTS.B, host,
    title: '[더미] 정원 꽉 찬 모임',
    intro: '마감 배지 · 모집 마감/다시 열기를 보는 더미예요.',
    startAt: dayAt(5), place: '동대문 소리홀 로비', area: '제기동역 근처',
    startTitle: '연주 감상 나누기', budget: '2to3', capacity: 2,
  });
  await chatService.ensureMeetupRoom(b.toObject());
  for (const u of [jiwoo, chaewon]) {
    await meetupService.applyMeetup(b._id, u._id, 'talk');
    await meetupService.approveMember(b._id, host._id, u._id);
  }
  out.push(['B', b, '정원 꽉 참 (2/2)', `/meetup/${b._id}`]);

  // ── C 평가 열림 3명 (어제) — 과거라 멤버를 직접 넣는다
  const c = await makeMeetup({
    id: ID.C, event: EVENTS.C, host,
    title: '[더미] 평가 열림 — 3단계 눌러 보기',
    intro: '매너 3단계 평가와 상호 선택 친구 성립을 보는 더미예요.',
    startAt: dayAt(-2), place: '반포동 들숨카페', area: '고속터미널역 근처',
    startTitle: '영화 보고 나온 얘기부터', budget: '1to2', capacity: 4,
    members: [hayoon, dohyun, seoyeon].map((u) => member(u, 'approved', dayAt(-3))),
    status: 'closed',
  });
  await chatService.ensureMeetupRoom(c.toObject());
  // 김하윤이 이미 수민을 '또 만나고 싶어요'로 골라 뒀다 →
  // 수민이 김하윤을 고르는 순간 friendService.makeFriends 가 돌아 친구 + 1:1 방이 생긴다
  await Review.create({ meetup: c._id, reviewer: hayoon._id, praised: [host._id], disappointed: [], again: [host._id] });
  await mannerService.reviewSubmitted(hayoon._id, c.toObject());
  out.push(['C', c, '평가 열림 3명 · 김하윤이 이미 제출(상호 선택 대기)', `/meetup/${c._id}/review`]);

  // ── D 평가 열림 10명 (어제) — 카드가 많을 때
  const d = await makeMeetup({
    id: ID.D, event: EVENTS.D, host,
    title: '[더미] 평가 열림 — 카드 10장',
    intro: '평가 카드가 10장일 때 어떻게 보이는지 확인하는 더미예요.',
    startAt: dayAt(-2), place: '서초동 숨비소리홀 옆', area: '방배역 근처',
    startTitle: '다 같이 한마디', budget: '2to3', capacity: 10,
    members: all10.map((u) => member(u, 'approved', dayAt(-4))),
    status: 'closed',
  });
  await chatService.ensureMeetupRoom(d.toObject());
  out.push(['D', d, '평가 열림 10명', `/meetup/${d._id}/review`]);

  // ── E 평가 마감 + 과반 감점 (-5일) — cron 이 반영할 상태로 둔다
  const e = await makeMeetup({
    id: ID.E, event: EVENTS.E, host,
    title: '[더미] 평가 마감 — 과반 감점 확인',
    intro: 'review:daily 가 점수를 반영하는 더미예요.',
    startAt: dayAt(-5), place: '월계동 숲속책방', area: '월계역 근처',
    startTitle: '전시 소감 한 바퀴', budget: 'under1', capacity: 4,
    members: [minjun, yuna, jiwoo].map((u) => member(u, 'approved', dayAt(-7))),
    status: 'closed',
  });
  // 수민을 3명이 '아쉬웠어요' → raters 3 · count 3 → 과반 통과
  const eReviews = [
    { reviewer: host._id, praised: [minjun._id], disappointed: [] },
    { reviewer: minjun._id, praised: [], disappointed: [host._id] },
    { reviewer: yuna._id, praised: [], disappointed: [host._id] },
    { reviewer: jiwoo._id, praised: [], disappointed: [host._id] },
  ];
  for (const r of eReviews) {
    await Review.create({ meetup: e._id, again: [], ...r });
    await mannerService.reviewSubmitted(r.reviewer, e.toObject()); // 실제 제출 흐름이 하는 일
  }
  out.push(['E', e, '평가 마감 · 수민을 3명이 아쉬웠어요 → review:daily 로 -3', `/meetup/${e._id}`]);

  // ── F 수민이 참여자 (어제) — '모임 신고하기 + 호스트 노쇼'는 참여자만 볼 수 있다
  const f = await makeMeetup({
    id: ID.F, event: EVENTS.F, host: jinho,
    title: '[더미] 내가 참여자 — 모임 신고',
    intro: '모임 신고하기와 호스트 노쇼 항목을 보는 더미예요.',
    startAt: dayAt(-2), place: '서울광장 옆 북카페', area: '시청역 근처',
    startTitle: '야외도서관 다녀와서', budget: 'under1', capacity: 4,
    members: [host, areum, taeyang].map((u) => member(u, 'approved', dayAt(-3))),
    status: 'closed',
  });
  await chatService.ensureMeetupRoom(f.toObject());
  out.push(['F', f, '수민이 참여자 · 호스트는 서진호', `/meetup/${f._id}`]);

  // ── G 수민이 신청 중 (미래) — 서비스로 신청하면 호스트에게 알림도 간다
  const g = await makeMeetup({
    id: ID.G, event: EVENTS.G, host: areum,
    title: '[더미] 내가 신청 중',
    intro: '신청 상태 표시와 신청 취소를 보는 더미예요.',
    startAt: dayAt(4), place: '노원 어울림마당 앞', area: '노원역 근처',
    startTitle: '축제 구경하고', budget: 'under1', capacity: 5,
  });
  await chatService.ensureMeetupRoom(g.toObject());
  await meetupService.applyMeetup(g._id, host._id, 'talk');
  out.push(['G', g, '수민이 신청 중(pending)', `/meetup/${g._id}`]);

  // ── H 취소된 모임 (미래) — setMeetupStatus 로 실제 취소해 알림까지 만든다
  const h = await makeMeetup({
    id: ID.H, event: EVENTS.H, host: taeyang,
    title: '[더미] 취소된 모임',
    intro: '취소 화면과 취소 알림을 보는 더미예요.',
    startAt: dayAt(6), place: '종로 가족극장 앞', area: '종각역 근처',
    startTitle: '공연 보고 수다', budget: '1to2', capacity: 4,
  });
  await chatService.ensureMeetupRoom(h.toObject());
  await meetupService.applyMeetup(h._id, host._id, 'talk');
  await meetupService.approveMember(h._id, taeyang._id, host._id);
  await meetupService.setMeetupStatus(h._id, taeyang._id, 'cancelled'); // → meetup_cancelled 알림
  out.push(['H', h, '취소된 모임 (수민은 승인됐던 참여자)', `/meetup/${h._id}`]);

  // ── I 이야기 자리가 3시간 뒤 · 수민이 승인된 참여자 — '늦은 취소' 경고와 -1 을 보는 더미
  //    확정 참여자가 24시간 안에 취소하면 매너 -1 이라, 취소 팝업이 먼저 알려 주는지 여기서 본다.
  //    G(나흘 뒤 · 신청 중)와 짝이다 — 그쪽은 경고가 안 떠야 한다
  const i = await makeMeetup({
    id: ID.I, event: EVENTS.I, host: jinho,
    title: '[더미] 오늘 밤 — 늦은 취소 경고',
    intro: '이야기 자리가 곧이라 참여를 취소하면 매너 점수가 깎이는 더미예요.',
    startAt: hoursAt(3), place: '시청역 7번 출구', area: '시청역 근처',
    startTitle: '시 읽고 나와서', budget: 'under1', capacity: 4,
  });
  await chatService.ensureMeetupRoom(i.toObject());
  await meetupService.applyMeetup(i._id, host._id, 'talk');
  await meetupService.approveMember(i._id, jinho._id, host._id);
  out.push(['I', i, '수민이 승인된 참여자 · 이야기 자리 3시간 뒤', `/meetup/${i._id}`]);

  // ── 친구 2건 — makeFriends 로 (1:1 방 · 양쪽 매너 +1 이 같이 생긴다)
  await friendService.makeFriends(c._id, host._id, minjun._id);
  await friendService.makeFriends(c._id, host._id, yuna._id);
  const friendships = await Friendship.find({ meetup: c._id }).lean();
  const withMinjun = friendships.find((x) => [String(x.userA), String(x.userB)].includes(String(minjun._id)));
  if (withMinjun) await friendService.setMemo(withMinjun._id, host._id, '전시 얘기 잘 통함');

  // ── 메시지 — 모임 방 · 1:1 방
  const roomA = await chatService.roomIdForMeetup(a._id, host._id);
  const roomF = await chatService.roomIdForMeetup(f._id, host._id);
  let pinned = null;
  if (roomA) {
    await chatService.sendMessage(roomA, host._id, '다들 토요일 7시에 안국역 2번 출구에서 만나요');
    pinned = await chatService.sendMessage(roomA, host._id, '[공지] 전시 티켓은 각자 예매해 주세요');
    await chatService.sendMessage(roomA, hayoon._id, '넵 예매했어요');
    await chatService.sendMessage(roomA, dohyun._id, '저도 완료했습니다'); // 차단 뒤엔 숨어야 한다
    await chatService.sendMessage(roomA, hayoon._id, '그날 봬요');
    if (pinned?._id) await chatService.pinNotice(roomA, host._id, pinned._id);
  }
  if (roomF) {
    await chatService.sendMessage(roomF, jinho._id, '어제 다들 수고하셨어요');
    await chatService.sendMessage(roomF, host._id, '재미있었습니다');
    await chatService.sendMessage(roomF, areum._id, '다음에 또 가요');
    await chatService.sendMessage(roomF, taeyang._id, '좋아요');
  }
  for (const fs of friendships) {
    if (!fs.room) continue;
    const other = String(fs.userA) === String(host._id) ? fs.userB : fs.userA;
    await chatService.sendMessage(fs.room, other, '안녕하세요! 친구 됐네요');
    await chatService.sendMessage(fs.room, host._id, '반가워요');
    await chatService.sendMessage(fs.room, other, '다음 모임도 같이 가요');
  }

  // ── 차단 1건 — 박도현(A 모임 승인 참여자)을 차단.
  //    /my?tab=blocks 목록과 'A 모임 채팅에서 상대 메시지 숨김'을 한 번에 확인할 수 있다
  if (!(await Block.exists({ blocker: host._id, blocked: dohyun._id }))) {
    await Block.create({ blocker: host._id, blocked: dohyun._id });
  }

  // ── 매너 이력에 합성 1건 — 이 스크립트의 **유일한 합성 데이터**다.
  //    scoreChange 0 · requested 1 이라 점수 합에 영향이 없어 불변식은 그대로이고,
  //    PraiseTab 의 '최고점이라 더 오르지 않았어요' 분기를 눌러 볼 수 있다
  await MannerLog.create({
    user: host._id,
    type: 'review_praise',
    message: `'${c.title}'에서 매너가 좋았다는 평가를 1번 받았어요`,
    scoreChange: 0,
    requested: 1,
    meetup: c._id,
  });

  return { out, host, made, pinned };
}

// ---------- 체크리스트 ----------

function printChecklist({ out, host }) {
  const F = 'http://localhost:5173';
  const line = (s = '') => console.log(s);

  line('');
  line('━━ 만든 모임 ━━');
  for (const [tag, m, note, path] of out) line(`  ${tag}  ${m.title}\n      ${note}\n      ${F}${path}`);

  line('');
  line('━━ 먼저 할 일 ━━');
  line('  1) npm run review:daily    → E 모임 점수 반영 (수민 개설 +5 없음 · review_low 1건당 -1 · manner_down 알림)');
  line('  2) npm run manner:check    → 불변식 확인');
  line(`  3) ${F} 에서 ${host.email} 로 로그인`);
  line('');
  line(`  로그인 가능한 더미: ${NEW_USERS.map((u) => u.nickname).join(' · ')}  비밀번호 ${PASSWORD}`);
  line('  (반대편에서 눌러 봐야 하는 것 — 상호 평가 · 신청 · 채팅)');

  line('');
  line('━━ 내가 만든 기능 ━━');
  line('  [ ] C 평가 화면 — 아무것도 안 고르고 제출되는지 (기본값 보통이에요)');
  line('  [ ] C 한 사람에게 하나만 골라지는지');
  line("  [ ] C '아쉬웠어요' 고르면 그 사람이 2단계에서 사라지고 신고 안내 줄이 뜨는지");
  line("  [ ] C 김하윤을 '또 만나고 싶어요'로 고르고 제출 → 친구 + 1:1 방이 바로 생기는지 (/friends)");
  line('  [ ] D 카드 10장이 4·4·2 로 쌓이고 라벨이 안 깨지는지');
  line('  [ ] /my?tab=praise — 점수가 한 줄인지 · 규칙이 짧은지 · 0점 목록이 접혀 있는지');
  line("  [ ] /my?tab=praise — 이력에 '매너가 아쉬웠다는 평가를 받았어요' 가 있고 '모임을 열었어요 +5' 는 없는지");
  line("  [ ] /my?tab=praise — 깎일 때 맨 윗줄이 '만나기 하루 전에 참여를 취소했어요' 인지 (읽어서 바로 이해되는지)");
  line("  [ ] /my?tab=praise — 0점 목록 첫 줄이 '만나기 하루 전보다 일찍 취소했을 때' 인지");
  line("  [ ] /my?tab=praise — '최고점이라 더 오르지 않았어요' 문구가 한 줄 보이는지 (합성 데이터)");
  line('  [ ] 헤더 종 아이콘 — manner_down · review_open · meetup_apply · meetup_cancelled 알림');
  line('  [ ] 모임 상세 · 참여자 목록 · 친구 목록에 매너 배지가 붙는지 (평가 화면엔 없어야 한다)');

  line('');
  line('━━ 팀원이 만든 기능 ━━');
  line('  [ ] A 참여자 관리 팝업 — 대기 3명 승인 / 거절');
  line('  [ ] A 참여자 관리 — 확정 참여자 내보내기 (매너 점수가 깎이지 않아야 한다)');
  line('  [ ] A 참여자 관리 — 참여자 신고 (이유 고르기 · 기타는 내용 필수)');
  line('  [ ] A 참여자 관리 팝업에 매너 점수 배지가 보이는지');
  line('  [ ] F 모임 상세 오른쪽 위 "모임 신고하기" → 항목에 \'호스트가 노쇼했어요\' 가 있는지');
  line('  [ ] F 같은 사람을 두 번 신고해도 저장되는지 (신고 1:n — 인덱스 떼냈다)');
  line('  [ ] A 모임 채팅 — 공지 고정이 보이고, 차단한 박도현 메시지가 숨는지');
  line('  [ ] B 마감 배지 · 모집 마감 / 다시 열기');
  line('  [ ] G 신청 중 상태 · 신청 취소');
  line("  [ ] G 신청 취소 팝업에는 경고가 없어야 한다 (나흘 뒤 + 신청 중이라 0점)");
  line('  [ ] H 취소된 모임 화면');
  line('  [ ] 모임 상세 오른쪽 카드 버튼 배치');

  line('');
  line('━━ 섞이는 자리 (병합이 깨졌으면 여기서 드러난다) ━━');
  line('  [ ] A 를 직접 취소 → 참여자가 있으니 매너 -5 + 취소 알림이 같이 가는지');
  line('  [ ] A 에서 참여자가 직접 참여 취소 → 이야기 자리가 3일 뒤라 감점 0 이어야 한다');
  line("  [ ] I 참여 취소 팝업에 '매너 점수가 1점 깎여요' 가 뜨는지 (이야기 자리 3시간 뒤)");
  line("  [ ] I 그대로 취소 → 이력·알림이 '만나기 하루 전에 ... 참여를 취소했어요 -1' 인지");
  line('  [ ] /my?tab=blocks 차단 목록에 박도현이 있고 해제되는지');
  line('  [ ] /friends 친구 2명 · 메모 팝업 · 친구 끊기');
  line('  [ ] /chat 목록 — 모임 방 2개 + 1:1 방 2개 · 안 읽은 수');

  line('');
  line('━━ 끝나면 ━━');
  line('  npm run seed:test -- --clean      ← 올리기 전에 반드시 (팀원 /meetup 목록에 더미가 보인다)');
  line('');
}

// ---------- main ----------

async function main() {
  const isClean = process.argv.includes('--clean');
  await connectDB();
  try {
    if (isClean) {
      console.log('더미 정리');
      await clean();
      console.log('정리 끝 — npm run manner:check 로 불변식을 확인하세요');
    } else {
      printChecklist(await seed());
    }
  } catch (err) {
    console.error('실패:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
  await mongoose.disconnect();
  process.exit(0);
}

// `require` 만 해도 돌아 버리면 사고가 난다 — 문법 확인하려고 require 했다가 공유 DB 가
// 정리된 적이 있다 (2026-11-07). 직접 실행할 때만 돈다.
if (require.main === module) main();
