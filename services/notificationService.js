const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUsers } = require('../config/socket');

// 알림 — 응답 모양은 frontend/src/data/notifications.js 맨 위 주석 기준
//   보내는 곳 · 문구는 이 파일 하나. 소켓은 'notify:changed'(빈 payload) → 프론트가 다시 불러온다
//   수동 스크립트로 돌리면 io 가 없어 DB 에만 쌓인다 (cron 은 app.js 안이라 정상)
//   문구에서 '모임' · '매너 점수'는 뺐다 — 화면이 종류별 아이콘으로 대신한다 (Header.jsx NOTIFY_KINDS)

const NOTIFY_KEEP_DAYS = 90; // 채팅 메시지 보존 기간과 같게
const DAY = 24 * 60 * 60 * 1000;
const LIST_LIMIT = 30;

const oid = (id) => new mongoose.Types.ObjectId(String(id));


const approvedUsers = (meetup) => (meetup.members || []).filter((m) => m.status === 'approved').map((m) => m.user);
const participantsOf = (meetup) => [meetup.host, ...approvedUsers(meetup)];

const nicknameOf = async (userId) => {
  const user = await User.findById(userId, { nickname: 1 }).lean();
  return user?.nickname || '알 수 없음';
};

/**
 * 여러 사람에게 같은 알림
 * cron 종류는 { user, type, meetup } 유니크 인덱스로 두 번째부터 무시된다 (11000)
 */
async function notify(userIds, { type, message, link, meetup }) {
  const targets = [...new Set((userIds || []).filter(Boolean).map(String))];
  if (!targets.length) return 0;

  const docs = targets.map((user) => ({ user: oid(user), type, message, link, meetup }));
  const saved = await Notification.insertMany(docs, { ordered: false }).catch((err) => {
    if (err.code === 11000 || err.writeErrors) return err.insertedDocs || []; // 중복은 건너뛴다
    throw err;
  });

  const reached = (saved.length ? saved : docs).map((d) => String(d.user));
  if (reached.length) emitToUsers(reached, 'notify:changed', {});
  return reached.length;
}

// ---------- 모임 ----------

const meetupApplied = async (meetup, applicantId) =>
  notify([meetup.host], {
    type: 'meetup_apply',
    message: `${await nicknameOf(applicantId)}님이 '${meetup.title}'에 신청했어요`,
    link: `/meetup/${meetup._id}?manage=pending`, // 참여자 관리 팝업 신청 탭으로
    meetup: meetup._id,
  });

const meetupApproved = (meetup, memberUserId) =>
  notify([memberUserId], {
    type: 'meetup_approved',
    message: `'${meetup.title}' 참여가 확정됐어요`,
    link: `/meetup/${meetup._id}`,
    meetup: meetup._id,
  });

const meetupLeft = async (meetup, memberUserId) =>
  notify([meetup.host], {
    type: 'meetup_left',
    message: `${await nicknameOf(memberUserId)}님이 '${meetup.title}'에서 나갔어요`,
    link: `/meetup/${meetup._id}`,
    meetup: meetup._id,
  });

/** 모임 취소 — 신청 중인 사람까지 알린다 (기다리던 사람도 알아야 한다) */
const meetupCancelled = (meetup) =>
  notify(
    (meetup.members || []).map((m) => m.user),
    { type: 'meetup_cancelled', message: `'${meetup.title}' 취소됐어요`, link: `/meetup/${meetup._id}`, meetup: meetup._id }
  );

const meetupUpdated = (meetup) =>
  notify(approvedUsers(meetup), {
    type: 'meetup_updated',
    message: `'${meetup.title}' 내용이 바뀌었어요`,
    link: `/meetup/${meetup._id}`,
    meetup: meetup._id,
  });

// ---------- 평가 (cron) ----------

/** 평가가 열렸어요 — 확정 참여자 전원 */
const reviewOpen = (meetup) =>
  notify(participantsOf(meetup), {
    type: 'review_open',
    message: `'${meetup.title}' 평가가 열렸어요`, // 기한은 마감 임박 알림이 따로 알린다
    link: `/meetup/${meetup._id}/review`,
    meetup: meetup._id,
  });

/** 평가가 곧 마감돼요 — 아직 안 낸 사람만. 미제출 감점(-1)의 전제조건 */
const reviewClosing = (meetup, pendingUserIds) =>
  notify(pendingUserIds, {
    type: 'review_closing',
    message: `'${meetup.title}' 평가가 내일 마감돼요 · 안 보내면 1점 깎여요`,
    link: `/meetup/${meetup._id}/review`,
    meetup: meetup._id,
  });

// ---------- 친구 ----------

const friendMatched = async (userA, userB) => {
  const [nameA, nameB] = await Promise.all([nicknameOf(userA), nicknameOf(userB)]);
  await notify([userA], { type: 'friend_matched', message: `${nameB}님과 친구가 됐어요`, link: '/friends' });
  await notify([userB], { type: 'friend_matched', message: `${nameA}님과 친구가 됐어요`, link: '/friends' });
};

// ---------- 매너 점수 ----------

/** 점수가 깎였을 때만 (오를 땐 보내지 않음). 숫자에 부호를 붙이지 않고 '깎였어요'로 적는다 */
const mannerDown = ({ userId, message, points, meetup }) =>
  notify([userId], {
    type: 'manner_down',
    message: `${message} · ${Math.abs(points)}점 깎였어요`, // '매너 점수'는 내림 화살표 아이콘이 대신한다
    link: '/my?tab=praise',
    meetup,
  });

// ---------- 이의제기 ----------

/** 이의제기 결과 — 수용 · 기각 모두. 수용은 점수가 올라 move() 가 알리지 않으므로 여기서 보낸다 */
const appealDone = ({ userId, accepted }) =>
  notify([userId], {
    type: 'appeal_done',
    message: accepted ? '이의제기가 받아들여져 제재가 취소됐어요' : '이의제기를 다시 검토했지만 제재는 그대로예요',
    link: '/my?tab=sanctions',
  });

// ---------- 읽기 · 읽음 · 정리 ----------

const listNotifications = async (userId, limit = LIST_LIMIT) => ({
  notifications: await Notification.find({ user: oid(userId) }, { type: 1, message: 1, link: 1, readAt: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || LIST_LIMIT, 100))
    .lean(),
});

const unreadCount = async (userId) => ({ count: await Notification.countDocuments({ user: oid(userId), readAt: null }) });

/** 읽음 — ids 가 없으면 전부 */
async function markRead(userId, ids) {
  const filter = { user: oid(userId), readAt: null };
  if (Array.isArray(ids) && ids.length) {
    filter._id = { $in: ids.filter((id) => mongoose.isValidObjectId(id)).map(oid) };
  }
  const { modifiedCount } = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return { read: modifiedCount };
}

/** 내 알림 전부 지우기 — cron 알림을 지워도 모임 쪽 표식이 있어 다시 오지 않는다 */
const clearAll = async (userId) => ({ cleared: (await Notification.deleteMany({ user: oid(userId) })).deletedCount });

/** 한 건 지우기 — 내 알림만. 없거나 이미 지웠으면 removed 0 (다시 눌러도 오류 아님) */
async function removeOne(userId, id) {
  if (!mongoose.isValidObjectId(id)) return { removed: 0 };
  const { deletedCount } = await Notification.deleteOne({ _id: oid(id), user: oid(userId) });
  return { removed: deletedCount };
}

/** 90일 지난 알림 삭제 (cron) */
async function purgeOld(now = new Date()) {
  const { deletedCount } = await Notification.deleteMany({ createdAt: { $lt: new Date(now - NOTIFY_KEEP_DAYS * DAY) } });
  return deletedCount;
}

module.exports = {
  NOTIFY_KEEP_DAYS,
  notify,
  meetupApplied,
  meetupApproved,
  meetupLeft,
  meetupCancelled,
  meetupUpdated,
  reviewOpen,
  reviewClosing,
  friendMatched,
  mannerDown,
  appealDone,
  listNotifications,
  unreadCount,
  markRead,
  clearAll,
  removeOne,
  purgeOld,
};
