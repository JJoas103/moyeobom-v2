const mongoose = require('mongoose');
const Report = require('../models/Report');
const { NOTE_MAX } = require('../models/Report');
const User = require('../models/User');
const { MANNER_BASE } = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const Meetup = require('../models/Meetup');
const MannerLog = require('../models/MannerLog');
const mannerService = require('./mannerService');
const notificationService = require('./notificationService');

// 관리자 — 신고 처리 · 회원 열람. 화면은 /admin (frontend/src/pages/admin/)
//
// ★ 이 파일이 하는 유일한 '쓰기'는 신고 판정이다. 회원 쪽은 전부 읽기다 —
//   계정 정지 · 강제 탈퇴는 넣지 않았다 (새 정책 · 새 필드 · 진행 중 모임 처리가 딸려 온다).
//   제재 수단은 **신고 제재(7점 깎기) 하나**이고, 그래서 취소가 반드시 함께 있다.
//
// ★★ '기각'은 두 가지다 — 섞으면 점수가 틀린다
//
//   · 대기 중 → 기각 (resolveReport 'reject'): **깎인 적이 없다.** 점수 변동 0, 이력도 남기지 않는다.
//     접수만으로는 절대 깎지 않는다는 원칙(services/mannerService.js) 때문에 되돌릴 것이 없다
//   · 제재 → 취소 (revertReport): 그때 **manner_revert 로 반대 부호 이력**을 쌓는다.
//     이력을 지우면 불변식(점수 = 50 + Σ)이 깨져 `npm run manner:check` 가 바로 실패한다
//
//   화면 버튼도 그래서 갈라져 있다 — 대기 중엔 [제재하기] [기각], 제재한 뒤엔 [제재 취소].
//   화면 말은 '제재' 로 통일한다 — 제재당한 회원이 마이페이지에서 보는 말이 '신고로 제재를 받았어요' 다.
//   -7 은 오판 비용이 커서 되돌리기가 선택이 아니라 필수다
//
// ★★★ 판단하면 증거가 사라진다 — 그래서 복사해 둔다
//
//   services/chatService.js purgeClosedRooms 는 **pending 인 신고가 있는 방만** 90일 정리에서
//   빼 준다. 판정하는 순간 그 보호가 풀려 방 · 메시지가 지워질 수 있다. 되돌리기를 검토할 때
//   "무슨 말 때문에 깎았는지" 가 남아 있어야 하므로 판정 시점에 메시지 본문을 Report.evidenceText
//   로 복사한다 (resolveReport).

const LIST_LIMIT = 20;
const LIST_LIMIT_MAX = 50;
const LOG_LIMIT = 50; // 회원 상세의 매너 변동 이력 — 마이페이지(30)보다 조금 길게 본다

const httpError = (status, message) => Object.assign(new Error(message), { status });
const oid = (id) => new mongoose.Types.ObjectId(String(id));

const paging = ({ page, limit } = {}) => {
  const take = Math.min(Math.max(Number(limit) || LIST_LIMIT, 1), LIST_LIMIT_MAX);
  const at = Math.max(Number(page) || 1, 1);
  return { take, skip: (at - 1) * take, page: at, limit: take };
};

/** 목록 · 상세에 쓰는 사람 모양. 점수를 함께 내려 판단 재료로 쓴다 */
const ADMIN_USER_FIELDS = { nickname: 1, profileImage: 1, email: 1, manner: 1, role: 1, createdAt: 1 };
const adminUser = (user) =>
  user
    ? {
        _id: String(user._id),
        nickname: user.nickname,
        profileImage: user.profileImage || '',
        email: user.email,
        role: user.role || 'user',
        // ⚠ users 는 v1 과 공유 컬렉션이다 — manner 가 없는 v1 회원이 섞여 나온다
        manner: { score: user.manner?.score ?? MANNER_BASE },
        createdAt: user.createdAt,
      }
    : null;

/** 탈퇴한 사람 자리 — 신고는 남고 사람은 지워질 수 있다 */
const goneUser = { _id: '', nickname: '탈퇴한 회원', profileImage: '', email: '', role: 'user', manner: { score: MANNER_BASE }, createdAt: null };

const noteOf = (note) => {
  const text = typeof note === 'string' ? note.trim() : '';
  if (text.length > NOTE_MAX) throw httpError(400, `메모는 ${NOTE_MAX}자까지 적을 수 있어요`);
  return text;
};

/**
 * 누르면 점수가 어떻게 되는지 — **서버가 계산해 내려 준다**
 *
 * 화면이 `50 - 7` 을 직접 하면 클램프 규칙(0~100)까지 프런트가 베껴야 하고, 서버 값이 바뀌면
 * 화면이 조용히 거짓말을 한다. 점수 규칙은 services/mannerService.js 한 곳이라는 원칙과도 어긋난다.
 *
 * `applied < requested` 면 경계에 걸린 것 — 모달이 '최저점이라 5점만 깎여요' 를 덧붙인다.
 * 취소 쪽 금액은 **그때 MannerLog 에 적힌 적용분**에서 읽는다 — reportReverted 가 쓰는 값과
 * 같은 출처여야 모달이 말한 숫자와 실제 결과가 어긋나지 않는다 (7 고정이 아니다).
 */
async function previewOf(report, scoreNow) {
  const clamp = (n) => Math.min(mannerService.MAX, Math.max(mannerService.MIN, n));
  const requested = Math.abs(mannerService.SCORES.manner_report);

  if (report.status === 'pending') {
    const scoreAfter = clamp(scoreNow - requested);
    return { action: 'sanction', scoreNow, scoreAfter, requested, applied: scoreNow - scoreAfter };
  }
  if (report.status === 'accepted') {
    const log = await MannerLog.findOne({ report: report._id, type: 'manner_report' }, { scoreChange: 1 }).lean();
    const back = log ? -log.scoreChange : 0; // 그때 깎인 만큼만 돌려준다
    const scoreAfter = clamp(scoreNow + back);
    return { action: 'revert', scoreNow, scoreAfter, requested, applied: scoreAfter - scoreNow };
  }
  return null; // 기각 · 제재 취소 · 예전 처리 — 더 누를 것이 없다
}

// ---------- 신고 ----------

/** 목록 한 줄 */
const reportRow = (doc, roomMap, meetupMap) => {
  const room = roomMap.get(String(doc.room));
  const meetup = room?.meetup ? meetupMap.get(String(room.meetup)) : null;
  return {
    _id: String(doc._id),
    reporter: adminUser(doc.reporter) || goneUser,
    target: adminUser(doc.target) || goneUser,
    reason: doc.reason || '',
    detail: doc.detail || '',
    isMessage: Boolean(doc.message),
    roomType: room?.type || '', // 방이 지워졌으면 빈 값 — 화면이 '삭제된 대화'로 보여 준다
    meetupTitle: meetup?.title || '',
    status: doc.status,
    appealOpen: doc.appeal?.status === 'open', // 목록에서 '이의' 꼬리표
    createdAt: doc.createdAt,
    resolvedAt: doc.resolvedAt || null,
  };
};

/** 신고가 가리키는 방 · 모임을 한 번에 모아 온다 (줄마다 조회하지 않게) */
async function loadContext(docs) {
  const roomIds = [...new Set(docs.map((d) => String(d.room)))];
  const rooms = await ChatRoom.find({ _id: { $in: roomIds } }, { type: 1, meetup: 1, closesAt: 1, users: 1 }).lean();
  const roomMap = new Map(rooms.map((r) => [String(r._id), r]));

  const meetupIds = [...new Set(rooms.map((r) => r.meetup).filter(Boolean).map(String))];
  const meetups = await Meetup.find({ _id: { $in: meetupIds } }, { title: 1, host: 1, status: 1, talk: 1 }).lean();
  return { roomMap, meetupMap: new Map(meetups.map((m) => [String(m._id), m])) };
}

/**
 * 신고 목록 — 기본은 대기 중, **오래 기다린 것 먼저**
 * 처리된 것은 최근 처리 순으로 본다 (방금 내린 판단을 확인하는 자리라서)
 */
async function listReports({ status = 'pending', page, limit } = {}) {
  const { take, skip, ...at } = paging({ page, limit });
  // 'appealed' 는 상태가 아니라 **이의가 들어와 있는 것**이다 (상태는 여전히 accepted).
  // 관리자가 먼저 봐야 할 줄이라 칩 하나를 내준다
  const filter =
    status === 'appealed' ? { 'appeal.status': 'open' } : status && status !== 'all' ? { status } : {};
  const sort = status === 'pending' || status === 'appealed' ? { createdAt: 1 } : { resolvedAt: -1, createdAt: -1 };

  const [docs, total, grouped, appealed] = await Promise.all([
    Report.find(filter)
      .populate('reporter', ADMIN_USER_FIELDS)
      .populate('target', ADMIN_USER_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(take)
      .lean(),
    Report.countDocuments(filter),
    Report.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Report.countDocuments({ 'appeal.status': 'open' }),
  ]);

  const { roomMap, meetupMap } = await loadContext(docs);
  const counts = { pending: 0, appealed, accepted: 0, rejected: 0, reverted: 0, done: 0 };
  grouped.forEach((g) => {
    if (g._id in counts) counts[g._id] = g.n;
  });

  return { reports: docs.map((d) => reportRow(d, roomMap, meetupMap)), total, counts, ...at };
}

/** 신고 한 건 — 판단에 필요한 것 전부 */
async function getReport(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, '신고를 찾을 수 없습니다');
  const doc = await Report.findById(id)
    .populate('reporter', ADMIN_USER_FIELDS)
    .populate('target', ADMIN_USER_FIELDS)
    .populate('resolvedBy', { nickname: 1 })
    .lean();
  if (!doc) throw httpError(404, '신고를 찾을 수 없습니다');

  const { roomMap, meetupMap } = await loadContext([doc]);
  const room = roomMap.get(String(doc.room));
  const meetup = room?.meetup ? meetupMap.get(String(room.meetup)) : null;

  // 증거 — 메시지가 남아 있으면 원문, 지워졌으면 판정 때 복사해 둔 것 (위 ★★★)
  const message = doc.message ? await ChatMessage.findById(doc.message, { text: 1, createdAt: 1 }).lean() : null;

  const targetId = doc.target?._id || doc.target;
  const [targetReportCount, targetAcceptedCount, lastMessages] = await Promise.all([
    Report.countDocuments({ target: targetId, _id: { $ne: doc._id } }),
    Report.countDocuments({ target: targetId, status: 'accepted', _id: { $ne: doc._id } }),
    // 메시지 신고가 아니면(사람 신고) 그 방에서 대상이 한 말 몇 줄을 붙여 준다 — 맥락 없이 판단하지 않게
    doc.message || !room
      ? []
      : ChatMessage.find({ room: doc.room, sender: targetId }, { text: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  return {
    report: {
      _id: String(doc._id),
      reporter: adminUser(doc.reporter) || goneUser,
      target: adminUser(doc.target) || goneUser,
      reason: doc.reason || '',
      detail: doc.detail || '',
      status: doc.status,
      createdAt: doc.createdAt,

      isMessage: Boolean(doc.message),
      roomType: room?.type || '',
      roomClosed: Boolean(room?.closesAt),
      roomGone: !room, // 90일 정리로 대화가 지워진 상태
      meetup: meetup ? { _id: String(meetup._id), title: meetup.title, status: meetup.status, startAt: meetup.talk?.startAt } : null,
      isTargetHost: Boolean(meetup && String(meetup.host) === String(targetId)),

      evidence: message?.text || doc.evidenceText || '',
      evidenceAt: message?.createdAt || null,
      evidenceFromSnapshot: !message && Boolean(doc.evidenceText),
      recentMessages: lastMessages.reverse().map((m) => ({ text: m.text, createdAt: m.createdAt })),

      targetReportCount, // 이 대상의 다른 신고 수
      targetAcceptedCount, // 그중 제재된 수 — 누진 규칙은 없지만 판단 재료다
      resolvedBy: doc.resolvedBy ? { _id: String(doc.resolvedBy._id), nickname: doc.resolvedBy.nickname } : null,
      resolvedAt: doc.resolvedAt || null,
      adminNote: doc.adminNote || '', // 제재 · 기각할 때 적은 것
      revertNote: doc.revertNote || '', // 취소할 때 적은 것 (adminNote 를 덮지 않는다)
      appeal: doc.appeal?.at
        ? {
            text: doc.appeal.text || '',
            at: doc.appeal.at,
            status: doc.appeal.status,
            reply: doc.appeal.reply || '',
            decidedAt: doc.appeal.decidedAt || null,
          }
        : null,

      // 지금 누를 수 있는 판정이 점수를 어떻게 바꾸는지. 누를 것이 없으면 null
      preview: await previewOf(doc, adminUser(doc.target)?.manner.score ?? MANNER_BASE),
    },
  };
}

/**
 * 제재 · 기각 — **대기 중인 신고만.** 두 번 눌러도 한 번만 반영된다
 *
 * 상태를 먼저 선점한 뒤 점수를 움직인다 (findOneAndUpdate 로 pending 을 가져간 사람만 진행) —
 * 쿼리를 따로 두면 두 관리자가 동시에 눌렀을 때 -7 이 두 번 걸린다
 */
async function resolveReport(id, adminId, action, note) {
  if (!['accept', 'reject'].includes(action)) throw httpError(400, '제재할지 기각할지 골라 주세요');
  if (!mongoose.isValidObjectId(id)) throw httpError(404, '신고를 찾을 수 없습니다');
  const adminNote = noteOf(note);

  const current = await Report.findById(id, { status: 1, message: 1 }).lean();
  if (!current) throw httpError(404, '신고를 찾을 수 없습니다');
  if (current.status !== 'pending') throw httpError(400, '이미 처리된 신고예요');

  // 증거 복사 — 판정하면 방 보존이 풀려 메시지가 지워질 수 있다 (위 ★★★)
  const message = current.message ? await ChatMessage.findById(current.message, { text: 1 }).lean() : null;

  const doc = await Report.findOneAndUpdate(
    { _id: oid(id), status: 'pending' },
    {
      $set: {
        status: action === 'accept' ? 'accepted' : 'rejected',
        resolvedBy: oid(adminId),
        resolvedAt: new Date(),
        adminNote,
        ...(message?.text && { evidenceText: message.text }),
      },
    },
    { new: true, projection: { status: 1, target: 1, room: 1 } }
  ).lean();
  if (!doc) throw httpError(400, '이미 처리된 신고예요'); // 동시에 누른 쪽

  // 제재만 점수를 움직인다. 기각은 깎인 적이 없어 되돌릴 것이 없다 (위 ★★)
  if (action === 'accept') {
    const room = await ChatRoom.findById(doc.room, { meetup: 1 }).lean();
    const meetup = room?.meetup ? await Meetup.findById(room.meetup, { title: 1 }).lean() : null;
    await mannerService.reportAccepted(doc.target, { reportId: doc._id, meetup: meetup?._id, meetupTitle: meetup?.title });
  }

  return getReport(id);
}

/**
 * 제재 취소 — 오판을 되돌리는 유일한 길. 상태는 **'reverted'** 가 된다 (기각과 다르다)
 * 점수는 **그때 적용된 분**만큼 돌아간다 (mannerService.reportReverted — 7 고정이 아니다)
 *
 * ⚠ `adminNote`(왜 제재했는지)는 **건드리지 않는다.** 취소 사유는 `revertNote` 에 따로 적는다 —
 *   덮어쓰면 판단의 근거가 사라져 나중에 "왜 제재했었지" 에 답할 수 없다
 */
async function revertReport(id, adminId, note) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, '신고를 찾을 수 없습니다');
  const revertNote = noteOf(note);

  const doc = await Report.findOneAndUpdate(
    { _id: oid(id), status: 'accepted' },
    { $set: { status: 'reverted', resolvedBy: oid(adminId), resolvedAt: new Date(), revertNote } },
    { new: true, projection: { target: 1 } }
  ).lean();
  if (!doc) throw httpError(400, '제재한 신고만 취소할 수 있어요');

  await mannerService.reportReverted(doc.target, doc._id);
  return getReport(id);
}

/**
 * 이의제기 판정 — 'accept'(무효처리) · 'reject'(이의 기각)
 *
 * **무효처리는 제재 취소와 똑같은 일이다** — 점수 복구 · 상태 reverted.
 * 그래서 경로를 새로 만들지 않고 mannerService.reportReverted 를 그대로 쓴다.
 * 길이 둘로 갈리면 한쪽만 고쳐져 불변식이 깨진다.
 *
 * 기각은 제재를 그대로 둔다 — 상태는 accepted 그대로고 appeal.status 만 rejected 가 된다
 */
async function decideAppeal(id, adminId, action, reply) {
  if (!['accept', 'reject'].includes(action)) throw httpError(400, '무효처리할지 기각할지 골라 주세요');
  if (!mongoose.isValidObjectId(id)) throw httpError(404, '신고를 찾을 수 없습니다');
  const text = noteOf(reply);

  const accepted = action === 'accept';
  const doc = await Report.findOneAndUpdate(
    { _id: oid(id), 'appeal.status': 'open' },
    {
      $set: {
        'appeal.status': accepted ? 'accepted' : 'rejected',
        'appeal.reply': text,
        'appeal.decidedBy': oid(adminId),
        'appeal.decidedAt': new Date(),
        ...(accepted && { status: 'reverted', resolvedBy: oid(adminId), resolvedAt: new Date(), revertNote: text }),
      },
    },
    { new: true, projection: { target: 1 } }
  ).lean();
  if (!doc) throw httpError(400, '처리할 이의제기가 없어요');

  if (accepted) await mannerService.reportReverted(doc.target, doc._id);
  await notificationService.appealDone({ userId: doc.target, accepted });
  return getReport(id);
}

// ---------- 회원 (열람만) ----------

/**
 * 회원 목록 — 닉네임 · 이메일 부분 일치. 정렬은 가입 최근(기본) · 매너 점수 낮은 순
 * 점수 낮은 순이 있는 이유: 신고를 보기 전에 "문제가 쌓이는 계정" 을 먼저 찾는 자리다
 */
async function listMembers({ q, sort, page, limit } = {}) {
  const { take, skip, ...at } = paging({ page, limit });
  const text = typeof q === 'string' ? q.trim() : '';
  const filter = text
    ? { $or: [{ nickname: new RegExp(escapeRegex(text), 'i') }, { email: new RegExp(escapeRegex(text), 'i') }] }
    : {};
  const order = sort === 'manner' ? { 'manner.score': 1, createdAt: -1 } : { createdAt: -1 };

  const [docs, total] = await Promise.all([
    User.find(filter, ADMIN_USER_FIELDS).sort(order).skip(skip).limit(take).lean(),
    User.countDocuments(filter),
  ]);

  // 받은 신고 수 — 목록에 보이는 사람만 한 번에 센다 (줄마다 조회하지 않게)
  const ids = docs.map((d) => d._id);
  const grouped = await Report.aggregate([
    { $match: { target: { $in: ids } } },
    { $group: { _id: { target: '$target', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const reportMap = new Map();
  grouped.forEach((g) => {
    const key = String(g._id.target);
    const row = reportMap.get(key) || { total: 0, pending: 0, accepted: 0 };
    row.total += g.n;
    if (g._id.status === 'pending') row.pending += g.n;
    if (g._id.status === 'accepted') row.accepted += g.n;
    reportMap.set(key, row);
  });

  return {
    members: docs.map((d) => ({
      ...adminUser(d),
      reports: reportMap.get(String(d._id)) || { total: 0, pending: 0, accepted: 0 },
    })),
    total,
    ...at,
  };
}

/** 회원 한 명 — 점수 · 변동 이력 · 신고 · 모임. 전부 읽기다 */
async function getMember(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, '회원을 찾을 수 없습니다');
  const doc = await User.findById(id, { ...ADMIN_USER_FIELDS, provider: 1, tastes: 1, districts: 1 }).lean();
  if (!doc) throw httpError(404, '회원을 찾을 수 없습니다');

  const [logs, received, filed, receivedCount, hostedCount, joinedCount] = await Promise.all([
    mannerService.listLog(id, LOG_LIMIT), // 마이페이지와 같은 함수 — 문구가 갈리지 않는다
    Report.find({ target: oid(id) }, { reason: 1, status: 1, createdAt: 1, resolvedAt: 1 }).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
    Report.find({ reporter: oid(id) }, { reason: 1, status: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
    // 머리줄 숫자는 **전체 건수**다 — 아래 목록은 LIST_LIMIT 까지만 보여 주므로 길이로 세면 20 에서 멈춘다
    Report.countDocuments({ target: oid(id) }),
    Meetup.countDocuments({ host: oid(id) }),
    // ⚠ $elemMatch 여야 한다 — 점 표기를 따로 쓰면 '아무 멤버가 나' + '아무 멤버가 승인' 으로
    //   느슨하게 걸려서 신청만 한 모임까지 세진다
    Meetup.countDocuments({ members: { $elemMatch: { user: oid(id), status: 'approved' } } }),
  ]);

  return {
    member: {
      ...adminUser(doc),
      provider: doc.provider,
      tastes: doc.tastes || [],
      districts: doc.districts || [],
    },
    // 불변식(점수 = 50 + Σ)을 화면이 검산해 보여 준다 — 틀리면 npm run manner:check 를 돌릴 신호다
    manner: { score: doc.manner?.score ?? MANNER_BASE, logs, logSum: logs.reduce((sum, l) => sum + l.scoreChange, 0), logLimit: LOG_LIMIT },
    reports: {
      receivedCount,
      received: received.map((r) => ({ _id: String(r._id), reason: r.reason || '', status: r.status, createdAt: r.createdAt, resolvedAt: r.resolvedAt || null })),
      filed: filed.map((r) => ({ _id: String(r._id), reason: r.reason || '', status: r.status, createdAt: r.createdAt })),
    },
    meetups: { hosted: hostedCount, joined: joinedCount },
  };
}

/** 검색어를 정규식에 그대로 넣으면 '.' 이나 '*' 가 패턴으로 돈다 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  LIST_LIMIT,
  listReports,
  getReport,
  resolveReport,
  revertReport,
  decideAppeal,
  listMembers,
  getMember,
};
