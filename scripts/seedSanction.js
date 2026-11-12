// 제재 · 이의제기를 눈으로 확인할 더미 계정: npm run seed:sanction
//   정리:  npm run seed:sanction -- --clean
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
// ⚠ 팀 공유 Atlas 에 쓴다. 만드는 건 **로그인 계정 셋뿐**이라 팀원의 모임 · 행사 목록에는
//   아무것도 안 보이지만(모임을 만들지 않는다), 관리자 회원 목록에는 뜬다.
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

const SANCTIONED = { email: 'demo.sanctioned@example.com', nickname: '제재받은회원' };
const APPEALED = { email: 'demo.appeal@example.com', nickname: '이의낸회원' };
const REPORTER = { email: 'demo.reporter@example.com', nickname: '신고한회원' };
const ACCOUNTS = [SANCTIONED, APPEALED, REPORTER];

// 신고에는 방이 필요하다 (Report.room 이 required) — 1:1 방을 계정마다 하나씩
const ROOM = { sanctioned: '5a0000000000000000000001', appealed: '5a0000000000000000000002' };
const MSG = { sanctioned: '5a0000000000000000000011', appealed: '5a0000000000000000000012' };

// ---------- 정리 ----------

async function clean() {
  const rooms = Object.values(ROOM).map(oid);
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

  return { sanctioned, appealed, reporter, reportA: a._id, reportB: b._id };
}

function printChecklist({ reportA, reportB }) {
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
  line('      신고자 자리 — 제재받은 건 없음');

  line('');
  line('━━ 관리자로 확인 ━━');
  line(`  [ ] ${F}/admin — 칩이 '제재 2' · '이의제기 1'`);
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
