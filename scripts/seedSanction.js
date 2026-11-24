// 제재 · 이의제기 · 대기 중 신고를 눈으로 확인할 더미 계정: npm run seed:sanction
//   정리:  npm run seed:sanction -- --clean
//   문구:  npm run seed:sanction -- --report   ← 결과보고서 부록 캡처용. 닉네임을 역할 이름
//                                               ('제재받은회원') 대신 사람 이름으로 바꾼다
//
// seedTestData 와 역할이 다르다 — 저쪽은 모임 · 평가 · 친구를 만들고, 여기는 **제재 상태만** 만든다.
// 제재 · 이의제기는 관리자가 눌러야 생기는 상태라, 직접 로그인해 볼 계정이 없으면
// /admin 의 '이의제기' 칩도 마이 › 받은 제재 탭도 빈 화면으로만 보인다.
//
// 방침은 seedTestData 와 같다: **상태를 모델에 직접 꽂지 않고 실제 서비스 함수로 만든다.**
//   chatService.report → adminService.resolveReport → appealService.submit
//   그러면 매너 점수 · 이력 · 알림 · 불변식이 알아서 따라온다.
//   직접 꽂으면 `점수 = 50 + Σ 이력` 이 깨져 npm run manner:check 가 바로 실패한다.
//
// ⚠ 팀 공유 Atlas 에 쓴다. 만드는 건 **로그인 계정 여섯뿐**이라 팀원의 모임 · 행사 목록에는
//   아무것도 안 보이지만(모임을 만들지 않는다), 관리자 회원 목록과 신고 목록에는 뜬다.
//   확인이 끝나면 npm run seed:sanction -- --clean 으로 지운다.
//
// 고정 _id 로 넣으므로 여러 번 돌려도 쌓이지 않는다 (넣기 전에 정리를 먼저 돈다).
// seedTestData 는 'de…' 를 쓰므로 여기는 '5a…' 를 써서 겹치지 않게 한다.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Report = require('../models/Report');
const MannerLog = require('../models/MannerLog');
const Notification = require('../models/Notification');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const userService = require('../services/userService');
const chatService = require('../services/chatService');
const adminService = require('../services/adminService');
const appealService = require('../services/appealService');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const PASSWORD = 'moyeobom!23'; // 기존 더미와 같은 비밀번호 (validationMiddleware 규칙 통과)

// `--report` — 결과보고서 부록(졸업작품 사진)에 들어갈 캡처를 찍을 때 쓰는 닉네임 모드.
// 기본값은 역할이 그대로 드러나는 이름이다. 관리자 회원 목록에서 **한눈에 더미로 알아봐야**
// 하고, 그게 기본이어야 지우는 걸 잊었을 때도 사고가 안 된다.
// 보고서 그림에는 이 닉네임이 세 자리에 찍힌다 — 받은 제재 화면의 헤더 · 프로필 카드,
// 신고 목록의 대상 열, 판정 모달의 `○○님을 제재할까요?`. 그때만 사람 이름으로 바꾼다.
const REPORT = process.argv.includes('--report');
const name = (role, person) => (REPORT ? person : role);

const SANCTIONED = { email: 'demo.sanctioned@example.com', nickname: name('제재받은회원', '남우진') };
const APPEALED = { email: 'demo.appeal@example.com', nickname: name('이의낸회원', '조은비') };
const REPORTER = { email: 'demo.reporter@example.com', nickname: name('신고한회원', '홍세라') };

// 신고에는 방이 필요하다 (Report.room 이 required) — 1:1 방을 계정마다 하나씩
const ROOM = { sanctioned: '5a0000000000000000000001', appealed: '5a0000000000000000000002' };
const MSG = { sanctioned: '5a0000000000000000000011', appealed: '5a0000000000000000000012' };

// ---------- 대기 중 신고 ----------
//
// 어느 시드도 `pending` 신고를 만들지 않았다 — 위 sanction() 은 접수하고 **곧바로** 판정해
// 버린다. 그래서 `/admin` 의 기본 화면(대기 중)과 신고 상세의 `[기각] [제재하기]` 는
// 손으로 신고를 눌러 만들지 않으면 영원히 빈 화면이었다. 여기서 셋을 만들어 둔다.
//
// **대상의 점수는 50 그대로 둔다** (제재를 걸지 않는다). 판정 모달이 서버가 계산한
// `50점 → 43점` 을 보여 주는 자리라, 이미 43점인 계정을 대상으로 쓰면 숫자가 달라진다.
//
// 이유를 셋 다 다르게 주고 기다린 시간도 벌린다 — 목록 기본 정렬이 '오래 기다린 순'
// 이어서, 전부 같은 시각이면 정렬이 돌아가는지 화면으로 확인할 수 없다.
// `noshow` 는 쓸 수 없다: 1:1 방 · 메시지 신고에서는 chatService.report 가 막는다
// (호스트 대상 + 이야기 자리 시작 뒤에만).
const PENDING = [
  {
    account: { email: 'demo.pending1@example.com', nickname: name('대기신고대상1', '문지후') },
    room: '5a0000000000000000000003', msg: '5a0000000000000000000013',
    text: '말귀가 그렇게 어두우세요? 몇 번을 말해요',
    reason: 'rude', hoursAgo: 50,
  },
  {
    account: { email: 'demo.pending2@example.com', nickname: name('대기신고대상2', '배하람') },
    room: '5a0000000000000000000004', msg: '5a0000000000000000000014',
    text: '어제는 그냥 안 갔어요. 딱히 약속한 것도 아닌데요',
    reason: 'promise', hoursAgo: 26,
  },
  {
    account: { email: 'demo.pending3@example.com', nickname: name('대기신고대상3', '오시언') },
    room: '5a0000000000000000000005', msg: '5a0000000000000000000015',
    text: '실례지만 몇 살이에요? 사는 동네랑 번호도 알려 주세요',
    reason: 'privacy', hoursAgo: 3,
  },
];

const ACCOUNTS = [SANCTIONED, APPEALED, REPORTER, ...PENDING.map((p) => p.account)];

// ---------- 정리 ----------

async function clean() {
  // ⚠ 방을 하나라도 빠뜨리면 그 방의 신고 · 메시지가 정리되지 않고 남는다 —
  //    새 상태를 더할 때 ROOM 과 PENDING 둘 다에서 모은다
  const rooms = [...Object.values(ROOM), ...PENDING.map((p) => p.room)].map(oid);
  const emails = ACCOUNTS.map((a) => a.email);
  const ids = (await User.find({ email: { $in: emails } }, { _id: 1 }).lean()).map((u) => u._id);

  const del = {
    // **방 기준으로만 지운다.** reporter/target 기준으로 지우면 실제 신고까지 날아간다
    // (seedTestData.clean 과 같은 규칙)
    신고: (await Report.deleteMany({ room: { $in: rooms } })).deletedCount,
    메시지: (await ChatMessage.deleteMany({ room: { $in: rooms } })).deletedCount,
    채팅방: (await ChatRoom.deleteMany({ _id: { $in: rooms } })).deletedCount,
  };

  if (ids.length) {
    // 점수를 되돌릴 필요가 없다 — 점수가 움직인 사람을 통째로 지우기 때문이다
    del['매너이력'] = (await MannerLog.deleteMany({ user: { $in: ids } })).deletedCount;
    del['알림'] = (await Notification.deleteMany({ user: { $in: ids } })).deletedCount;
  }
  del['계정'] = (await User.deleteMany({ email: { $in: emails } })).deletedCount;

  console.log('  지움: ' + Object.entries(del).map(([k, v]) => `${k} ${v}`).join(' · '));
  return del;
}

// ---------- 넣기 ----------

/** 한 사람에게 제재를 건다 — 신고 접수부터 판정까지 실제 경로로 */
async function sanction({ admin, target, reporter, roomId, messageId, text, reason, note }) {
  await ChatRoom.create({ _id: oid(roomId), type: 'direct', users: [target._id, reporter._id] });
  await ChatMessage.create({ _id: oid(messageId), room: oid(roomId), sender: target._id, text });

  await chatService.report(roomId, reporter._id, { messageId, reason });
  const report = await Report.findOne({ room: oid(roomId) }, { _id: 1 }).lean();

  // 점수 · 알림 · 이력이 전부 여기서 한 번에 생긴다
  const { report: done } = await adminService.resolveReport(report._id, admin._id, 'accept', note);
  return done;
}

/** 접수만 하고 판정하지 않는다 — 관리자 화면의 '대기 중' 자리 */
async function pending({ target, reporter, roomId, messageId, text, reason, hoursAgo }) {
  await ChatRoom.create({ _id: oid(roomId), type: 'direct', users: [target._id, reporter._id] });
  await ChatMessage.create({ _id: oid(messageId), room: oid(roomId), sender: target._id, text });

  await chatService.report(roomId, reporter._id, { messageId, reason });
  const report = await Report.findOne({ room: oid(roomId) }, { _id: 1 }).lean();

  // 기다린 시간만 뒤로 민다. 점수 · 이력에는 손대지 않으므로 불변식과 무관하다.
  // timestamps: false 가 없으면 mongoose 가 updatedAt 을 지금으로 덮어 createdAt 과 어긋난다
  await Report.updateOne(
    { _id: report._id },
    { $set: { createdAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000) } },
    { timestamps: false },
  );
  return report._id;
}

async function seed() {
  console.log('기존 더미 정리');
  await clean();

  const admin = await User.findOne({ role: 'admin' }, { _id: 1, nickname: 1 }).lean();
  if (!admin) {
    throw new Error('관리자 계정이 없어요. 먼저 npm run admin:grant -- <이메일> 을 돌리세요');
  }
  console.log(`판정할 관리자: ${admin.nickname}`);

  const make = (a) => userService.createUser({ ...a, password: PASSWORD, tastes: ['performance'], districts: [] });
  const [sanctioned, appealed, reporter] = await Promise.all([make(SANCTIONED), make(APPEALED), make(REPORTER)]);

  // ① 제재만 — 이의를 아직 안 낸 상태 ([이의제기] 버튼이 보인다)
  const a = await sanction({
    admin,
    target: sanctioned,
    reporter,
    roomId: ROOM.sanctioned,
    messageId: MSG.sanctioned,
    text: '아 진짜 말귀를 못 알아들으시네',
    reason: 'rude',
    note: '불쾌한 표현을 반복했다고 판단',
  });

  // ② 제재 + 이의제기 제출 — 관리자가 판정할 차례
  const b = await sanction({
    admin,
    target: appealed,
    reporter,
    roomId: ROOM.appealed,
    messageId: MSG.appealed,
    text: '관심 있으면 제 계정으로 디엠 주세요 좋은 거 있어요',
    reason: 'ad',
    note: '광고로 보이는 메시지',
  });
  await appealService.submit(
    appealed._id,
    b._id,
    '광고가 아니라 같이 보기로 한 전시 링크를 보낸 거예요. 대화 앞부분을 같이 봐 주세요.'
  );

  // ③ 대기 중 셋 — 판정하지 않는다. 대상의 점수는 50 그대로다
  const waiting = [];
  for (const p of PENDING) {
    const target = await make(p.account);
    waiting.push({
      nickname: p.account.nickname,
      id: await pending({
        target, reporter, roomId: p.room, messageId: p.msg,
        text: p.text, reason: p.reason, hoursAgo: p.hoursAgo,
      }),
    });
  }

  return { sanctioned, appealed, reporter, reportA: a._id, reportB: b._id, waiting };
}

function printChecklist({ reportA, reportB, waiting }) {
  const F = 'http://localhost:5173';
  const line = (s = '') => console.log(s);

  line('');
  line('━━ 만든 계정 (비밀번호는 셋 다 같음) ━━');
  line(`  비밀번호  ${PASSWORD}`);
  line(`  ${SANCTIONED.nickname}   ${SANCTIONED.email}`);
  line('      제재 7점 · 이의제기 아직 안 냄');
  line(`  ${APPEALED.nickname}   ${APPEALED.email}`);
  line('      제재 7점 · 이의제기 제출함(검토 중)');
  line(`  ${REPORTER.nickname}   ${REPORTER.email}`);
  line('      신고자 자리 — 제재받은 건 없음 (대기 중 셋도 이 사람이 신고했다)');
  for (const w of waiting) line(`  ${w.nickname}   대기 중 신고 대상 · 점수 50 그대로`);

  line('');
  line('━━ 관리자로 확인 ━━');
  line(`  [ ] ${F}/admin — 칩이 '대기 중 3' · '제재 2' · '이의제기 1'`);
  line('  [ ] 대기 중 목록이 오래 기다린 순(50시간 → 26시간 → 3시간)으로 쌓이는지');
  for (const w of waiting) line(`  [ ] ${F}/admin/reports/${w.id} — [기각] [제재하기] 가 있고, 판정 모달이 '50점 → 43점'`);
  line(`  [ ] ${F}/admin?tab=members — 두 계정 매너 점수가 43점`);
  line(`  [ ] ${F}/admin/reports/${reportB} — 이의제기 카드 + [무효처리] [이의 기각]`);
  line('  [ ] 무효처리를 누르면 점수가 50점으로 돌아오는지');

  line('');
  line(`━━ ${SANCTIONED.nickname} 으로 로그인해 확인 ━━`);
  line(`  [ ] ${F}/my?tab=praise — 매너 점수가 43점이고 '신고로 제재를 받았어요' 이력`);
  line(`  [ ] ${F}/my?tab=sanctions — '받은 제재' 탭(차단 목록 옆)에 [이의제기] 버튼`);
  line('  [ ] 종(알림)에 점수가 깎였다는 알림');
  line(`  [ ] 이의제기를 보내고 나면 '검토 중' 으로 바뀌고 두 번은 못 보내는지`);
  line(`  [ ] (참고) 이 신고 상세: ${F}/admin/reports/${reportA}`);

  line('');
  line(`━━ ${APPEALED.nickname} 으로 로그인해 확인 ━━`);
  line(`  [ ] ${F}/my?tab=sanctions — '검토 중' 과 본인이 쓴 글`);
  line('  [ ] 관리자가 판정한 뒤 다시 보면 관리자 답이 그 자리에 보이는지');

  line('');
  line('━━ 끝나면 ━━');
  line('  npm run seed:sanction -- --clean   ← 팀 공유 Atlas 다. 확인이 끝나면 지운다');
  line('  npm run manner:check               ← 정리 뒤 불변식 확인');
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

// `require` 만 해도 돌아 버리면 사고가 난다 (2026-11-07 공유 DB 정리 사고) — 직접 실행할 때만 돈다
if (require.main === module) main();
