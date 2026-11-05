const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUsers } = require('../config/socket');

// 알림 — 응답 모양은 frontend/src/data/notifications.js 맨 위 주석 기준
//   보내는 곳은 이 파일 하나다. 문구도 여기 모아 둬서 화면마다 말투가 갈리지 않게 한다
//   소켓은 받는 사람 user 방으로 `notify:changed` 를 빈 payload 로 보내고 프론트가 다시 불러온다
//   (chat:rooms · friends:changed 와 같은 방식 — 숫자를 소켓으로 직접 안 보낸다)
//
// ⚠ config/socket.js 의 emitToUsers 는 io 가 없으면 조용히 무시한다. 수동 스크립트
//   (npm run review:daily)로 돌리면 DB 에는 쌓이고 실시간 push 만 안 간다 — cron 은 app.js 안에서
//   돌기 때문에 정상이다. 알림이 '안 왔다'는 제보가 오면 이걸 먼저 확인할 것
//
// 보내지 않는 것은 models/Notification.js 주석에 정리해 두었다

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
 * 여러 사람에게 같은 알림. 받는 사람이 없으면 아무 일도 안 한다
 * cron 종류(review_open · review_closing)는 { user, type, meetup } 유니크 인덱스에 걸려
 * 두 번째부터 조용히 무시된다 — 그래서 하루 한 번 도는 작업을 여러 번 돌려도 안전하다
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
    message: `${await nicknameOf(applicantId)}님이 '${meetup.title}'에 참여를 신청했어요`,
    link: `/meetup/${meetup._id}`,
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
    message: `${await nicknameOf(memberUserId)}님이 '${meetup.title}' 참여를 취소했어요`,
    link: `/meetup/${meetup._id}`,
    meetup: meetup._id,
  });

/** 모임 취소 — 신청 중인 사람까지 알린다 (기다리던 사람도 알아야 한다) */
const meetupCancelled = (meetup) =>
  notify(
    (meetup.members || []).map((m) => m.user),
    { type: 'meetup_cancelled', message: `'${meetup.title}' 모임이 취소됐어요`, link: `/meetup/${meetup._id}`, meetup: meetup._id }
  );

const meetupUpdated = (meetup) =>
  notify(approvedUsers(meetup), {
    type: 'meetup_updated',
    message: `'${meetup.title}' 모임 내용이 바뀌었어요`,
    link: `/meetup/${meetup._id}`,
    meetup: meetup._id,
  });

// ---------- 평가 (cron) ----------

/** 평가가 열렸어요 — 확정 참여자 전원 */
const reviewOpen = (meetup) =>
  notify(participantsOf(meetup), {
    type: 'review_open',
    message: `'${meetup.title}' 평가가 열렸어요. 48시간 동안 보낼 수 있어요`,
    link: `/meetup/${meetup._id}/review`,
    meetup: meetup._id,
  });

/**
 * 평가가 곧 마감돼요 — 아직 안 낸 사람에게만
 * 기한을 넘기면 다시 보낼 수 없으므로 미리 한 번 알린다. "몰라서 못 냈다"를 남기지 않는다
 */
const reviewClosing = (meetup, pendingUserIds) =>
  notify(pendingUserIds, {
    type: 'review_closing',
    message: `'${meetup.title}' 평가가 내일 마감돼요. 기한이 지나면 보낼 수 없어요`,
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

/** 점수가 깎였을 때만 — 오를 때는 보내지 않는다. 링크는 이력이 있는 마이페이지 */
const mannerDown = ({ userId, message, points, meetup }) =>
  notify([userId], {
    type: 'manner_down',
    message: `${message} · 매너 점수 ${points}점`,
    link: '/my?tab=praise',
    meetup,
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
  listNotifications,
  unreadCount,
  markRead,
  purgeOld,
};
