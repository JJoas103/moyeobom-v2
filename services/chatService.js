const mongoose = require('mongoose');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const { TEXT_MAX } = require('../models/ChatMessage');
const Meetup = require('../models/Meetup');
const Event = require('../models/Event');
const User = require('../models/User');
const Block = require('../models/Block');
const Report = require('../models/Report');
const Friendship = require('../models/Friendship');
const { emitToUsers } = require('../config/socket');
const { DAY, CLOSED_ROOM_VISIBLE_DAYS, CHAT_KEEP_DAYS, meetupRoomClosesAt } = require('./socialRules');
const { meetupSummary, loadEvents } = require('./meetupSummary');

// 채팅 — 응답 모양은 frontend/src/data/chat.js 맨 위 주석 기준
// 실시간: 받는 사람마다 user 방으로 'chat:message' · 'chat:read' · 'chat:notices' · 'chat:rooms'(목록 다시 불러오기)

const NOTICE_MAX = 3; // 임시 — 공지 최대 개수 (미결정)
const PAGE_SIZE = 50;

const SYSTEM = {
  meetupOpened: '모임 채팅방이 열렸어요. 호스트가 승인한 참여자만 들어올 수 있어요.',
  joined: (nickname) => `${nickname}님이 들어왔어요`,
  cancelled: '호스트가 모임을 취소했어요. 대화는 읽기만 할 수 있어요.',
  // 두 사람이 같은 문장을 보므로 '○○님과' 대신 중립 문구
  friends: (eventTitle) => (eventTitle ? `친구가 되었어요. ${eventTitle} 이야기 자리에서 만났어요.` : '친구가 되었어요.'),
};

const httpError = (status, message) => Object.assign(new Error(message), { status });
const idEq = (a, b) => Boolean(a && b) && String(a) === String(b);
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const publicUser = (user) => (user ? { _id: String(user._id), nickname: user.nickname, profileImage: user.profileImage || '' } : null);

/** 모임의 확정 참여자 — 호스트 + 승인된 참여자 */
const participantsOf = (meetup) => [
  meetup.host,
  ...(meetup.members || []).filter((m) => m.status === 'approved').map((m) => m.user),
];

const isClosed = (room, now = new Date()) => Boolean(room.closesAt && new Date(room.closesAt) <= now);

/** 내 목록에 보이는 방인지 — 모임 방: 닫힌 뒤 30일까지 / 1:1: 닫히면 바로 사라짐 */
function isVisible(room, now = new Date()) {
  if (!room.closesAt) return true;
  if (room.type === 'direct') return false;
  return now - new Date(room.closesAt) < CLOSED_ROOM_VISIBLE_DAYS * DAY;
}

const visibleRoomQuery = (userId, now = new Date()) => ({
  users: oid(userId),
  $or: [
    { closesAt: null },
    { type: 'meetup', closesAt: { $gt: new Date(now.getTime() - CLOSED_ROOM_VISIBLE_DAYS * DAY) } },
  ],
});

const toMessage = (m) => ({ _id: String(m._id), text: m.text, sender: m.sender ? String(m.sender) : null, createdAt: m.createdAt });

// ---------- 메시지 보내기 (공통) ----------

async function pushMessage(room, senderId, text) {
  const message = await ChatMessage.create({ room: room._id, sender: senderId || null, text });
  const at = message.createdAt;
  await ChatRoom.updateOne(
    { _id: room._id },
    { $set: { lastMessage: { text, sender: senderId || null, at } } }
  );
  if (senderId) await setRead(room._id, senderId, at);
  emitToUsers(room.users, 'chat:message', { roomId: String(room._id), message: toMessage(message) });
  return message;
}

const postSystem = (room, text) => pushMessage(room, null, text);

async function setRead(roomId, userId, at) {
  const updated = await ChatRoom.updateOne(
    { _id: roomId, reads: { $elemMatch: { user: oid(userId), at: { $lt: at } } } },
    { $set: { 'reads.$.at': at } }
  );
  if (!updated.matchedCount) {
    await ChatRoom.updateOne({ _id: roomId, 'reads.user': { $ne: oid(userId) } }, { $push: { reads: { user: oid(userId), at } } });
  }
}

// ---------- 모임 방 (meetupService 에서 부름) ----------

/** 모임 방 찾기 · 없으면 만들기. 취소됐거나 이미 닫힐 시각이 지난 모임은 새로 만들지 않음 */
async function ensureMeetupRoom(meetup) {
  const existing = await ChatRoom.findOne({ type: 'meetup', meetup: meetup._id }).lean();
  if (existing) return existing;

  const now = new Date();
  const closesAt = meetupRoomClosesAt(meetup);
  if (meetup.status === 'cancelled' || closesAt <= now) return null;

  const users = participantsOf(meetup);
  let room;
  try {
    room = (
      await ChatRoom.create({ type: 'meetup', meetup: meetup._id, users, reads: users.map((user) => ({ user, at: now })), closesAt })
    ).toObject();
  } catch (err) {
    if (err.code === 11000) return ChatRoom.findOne({ type: 'meetup', meetup: meetup._id }).lean(); // 동시에 만든 경우
    throw err;
  }
  await postSystem(room, SYSTEM.meetupOpened);
  return room;
}

/** 참여 승인 → 방에 추가 + '○○님이 들어왔어요' */
async function addMeetupMember(meetup, userId) {
  const room = await ensureMeetupRoom(meetup);
  if (!room || isClosed(room)) return;
  if (!room.users.some((u) => idEq(u, userId))) {
    await ChatRoom.updateOne(
      { _id: room._id },
      { $addToSet: { users: oid(userId) }, $push: { reads: { user: oid(userId), at: new Date() } } }
    );
    room.users.push(oid(userId));
  }
  const user = await User.findById(userId, { nickname: 1 }).lean();
  await postSystem(room, SYSTEM.joined(user?.nickname || '새 참여자'));
  emitToUsers([userId], 'chat:rooms', {});
}

/** 모임 수정 — 이야기 자리 시각이 바뀌면 방 닫히는 시각도 같이 */
async function syncMeetupRoom(meetup) {
  await ChatRoom.updateOne(
    { type: 'meetup', meetup: meetup._id, closesAt: { $gt: new Date() } },
    { $set: { closesAt: meetupRoomClosesAt(meetup) } }
  );
}

/** 모임 취소 → 방 바로 닫힘 (읽기 전용) */
async function closeMeetupRoom(meetupId) {
  const now = new Date();
  const room = await ChatRoom.findOneAndUpdate(
    { type: 'meetup', meetup: meetupId, closesAt: { $gt: now } },
    { $set: { closesAt: now } },
    { new: true }
  ).lean();
  if (room) await postSystem(room, SYSTEM.cancelled);
}

// 내가 확정 참여자인데 방이 아직 없는 모임(채팅 기능 전에 만든 모임) — 목록 볼 때 만들어 줌
async function backfillMeetupRooms(userId, now) {
  const me = oid(userId);
  const meetups = await Meetup.find({
    status: { $ne: 'cancelled' },
    'talk.startAt': { $gt: new Date(now.getTime() - 4 * DAY) }, // 평가 마감 전일 수 있는 모임만
    $or: [{ host: me }, { members: { $elemMatch: { user: me, status: 'approved' } } }],
  }).lean();
  if (!meetups.length) return;
  const withRoom = new Set(
    (await ChatRoom.distinct('meetup', { type: 'meetup', meetup: { $in: meetups.map((m) => m._id) } })).map(String)
  );
  for (const meetup of meetups) {
    if (!withRoom.has(String(meetup._id))) await ensureMeetupRoom(meetup);
  }
}

// ---------- 1:1 방 (friendService 에서 부름) ----------

async function createDirectRoom(userIds, meetupId) {
  const now = new Date();
  const room = (
    await ChatRoom.create({
      type: 'direct',
      meetup: meetupId || null,
      users: userIds,
      reads: userIds.map((user) => ({ user, at: now })),
    })
  ).toObject();

  const meetup = meetupId ? await Meetup.findById(meetupId, { event: 1 }).lean() : null;
  const event = meetup ? await Event.findById(meetup.event, { title: 1 }).lean() : null;
  await postSystem(room, SYSTEM.friends(event?.title));
  return room;
}

/** 친구 끊기 · 차단 → 1:1 방 닫힘 (목록에서 바로 사라짐) */
async function closeDirectRoom(roomId) {
  if (!roomId) return;
  const room = await ChatRoom.findOneAndUpdate(
    { _id: roomId, type: 'direct', closesAt: null },
    { $set: { closesAt: new Date() } },
    { new: true }
  ).lean();
  if (room) emitToUsers(room.users, 'chat:rooms', { closedRoomId: String(room._id) });
}

// ---------- 조회 ----------

async function blockedIdsOf(userId) {
  return (await Block.distinct('blocked', { blocker: oid(userId) })).map(String);
}

async function unreadCount(room, userId, blockedIds) {
  const readAt = room.reads?.find((r) => idEq(r.user, userId))?.at || new Date(0);
  return ChatMessage.countDocuments({
    room: room._id,
    sender: { $nin: [null, oid(userId), ...blockedIds.map(oid)] },
    createdAt: { $gt: readAt },
  });
}

// 방 목록 · 상세에 붙이는 모임 · 상대 정보
async function loadRoomContext(rooms, userId) {
  const meetupIds = [...new Set(rooms.filter((r) => r.meetup).map((r) => String(r.meetup)))];
  const partnerIds = rooms.filter((r) => r.type === 'direct').flatMap((r) => r.users.filter((u) => !idEq(u, userId)));
  const meetups = await Meetup.find(
    { _id: { $in: meetupIds } },
    { title: 1, event: 1, talk: 1, imageUrl: 1, host: 1, members: 1, capacity: 1, watch: 1 }
  ).lean();
  const [events, users] = await Promise.all([
    loadEvents(meetups),
    User.find({ _id: { $in: partnerIds } }, { nickname: 1, profileImage: 1 }).lean(),
  ]);
  return {
    meetups: new Map(meetups.map((m) => [String(m._id), m])),
    events,
    users: new Map(users.map((u) => [String(u._id), u])),
  };
}

function roomSummary(room, ctx, userId, now) {
  const meetup = meetupSummary(room.meetup && ctx.meetups.get(String(room.meetup)), ctx.events);
  const partnerId = room.type === 'direct' ? room.users.find((u) => !idEq(u, userId)) : null;
  const partner = partnerId ? publicUser(ctx.users.get(String(partnerId))) : null;
  return {
    _id: String(room._id),
    type: room.type,
    title: room.type === 'meetup' ? meetup?.title || '모임 채팅' : partner?.nickname || '알 수 없음',
    meetup,
    partner,
    memberCount: room.users.length,
    lastMessage: room.lastMessage?.at
      ? { text: room.lastMessage.text, at: room.lastMessage.at, system: !room.lastMessage.sender, mine: idEq(room.lastMessage.sender, userId) }
      : null,
    closed: isClosed(room, now), // 읽기 전용 (흐리게)
    closesAt: room.closesAt,
  };
}

/** 내 채팅방 목록 — 최근 메시지순 */
async function listRooms(userId) {
  const now = new Date();
  await backfillMeetupRooms(userId, now);
  const rooms = await ChatRoom.find(visibleRoomQuery(userId, now)).lean();
  const [ctx, blockedIds] = await Promise.all([loadRoomContext(rooms, userId), blockedIdsOf(userId)]);
  const unread = await Promise.all(rooms.map((r) => unreadCount(r, userId, blockedIds)));

  return rooms
    .map((room, i) => ({ ...roomSummary(room, ctx, userId, now), unread: unread[i] }))
    .sort((a, b) => new Date(b.lastMessage?.at || 0) - new Date(a.lastMessage?.at || 0));
}

/** 안 읽은 메시지 총수 — 헤더 채팅 아이콘 점 */
async function totalUnread(userId) {
  const rooms = await ChatRoom.find(visibleRoomQuery(userId), { reads: 1 }).lean();
  const blockedIds = await blockedIdsOf(userId);
  const counts = await Promise.all(rooms.map((r) => unreadCount(r, userId, blockedIds)));
  return counts.reduce((sum, n) => sum + n, 0);
}

async function findRoomFor(roomId, userId) {
  if (!mongoose.isValidObjectId(roomId)) throw httpError(404, '채팅방을 찾을 수 없습니다');
  const room = await ChatRoom.findById(roomId).lean();
  if (!room || !room.users.some((u) => idEq(u, userId)) || !isVisible(room)) throw httpError(404, '채팅방을 찾을 수 없습니다');
  return room;
}

/** 모임 상세 '모임 채팅 열기' → 방 id. 호스트 · 승인된 참여자만 */
async function roomIdForMeetup(meetupId, userId) {
  if (!mongoose.isValidObjectId(meetupId)) throw httpError(404, '모임을 찾을 수 없습니다');
  const meetup = await Meetup.findById(meetupId).lean();
  if (!meetup) throw httpError(404, '모임을 찾을 수 없습니다');
  if (!participantsOf(meetup).some((u) => idEq(u, userId))) throw httpError(403, '승인된 참여자만 들어갈 수 있어요');
  const room = await ensureMeetupRoom(meetup);
  if (!room || !isVisible(room)) throw httpError(404, '닫힌 지 오래된 채팅방이에요');
  return String(room._id);
}

/** 고정 공지 id 순서(최근 고정 먼저) 그대로 메시지로 */
async function noticeMessages(noticeIds = []) {
  if (!noticeIds.length) return [];
  const docs = await ChatMessage.find({ _id: { $in: noticeIds } }).lean();
  return noticeIds.map((id) => docs.find((d) => idEq(d._id, id))).filter(Boolean).map(toMessage);
}

async function loadMessages(roomId, blockedIds, before) {
  const query = { room: roomId, sender: { $nin: blockedIds.map(oid) } };
  if (before) {
    const pivot = mongoose.isValidObjectId(before) ? await ChatMessage.findById(before, { createdAt: 1 }).lean() : null;
    if (pivot) query.createdAt = { $lt: pivot.createdAt };
  }
  const docs = await ChatMessage.find(query).sort({ createdAt: -1, _id: -1 }).limit(PAGE_SIZE + 1).lean();
  const hasMore = docs.length > PAGE_SIZE;
  return { messages: docs.slice(0, PAGE_SIZE).reverse().map(toMessage), hasMore };
}

/** 채팅방 하나 — 방 정보 · 참여자 · 공지 · 최근 메시지 */
async function getRoom(roomId, userId) {
  const now = new Date();
  const room = await findRoomFor(roomId, userId);
  const [ctx, blockedIds] = await Promise.all([loadRoomContext([room], userId), blockedIdsOf(userId)]);
  const meetupDoc = room.meetup ? ctx.meetups.get(String(room.meetup)) : null;

  // 참여자 — 모임 방: 호스트 + 승인된 참여자(참여 방식 포함) / 1:1: 두 사람
  const memberUsers = await User.find({ _id: { $in: room.users } }, { nickname: 1, profileImage: 1 }).lean();
  const userMap = new Map(memberUsers.map((u) => [String(u._id), u]));
  // 호스트는 관람 동행이 있는 모임이면 관람부터 함께
  const hostJoinType = meetupDoc?.watch?.enabled ? 'watch' : 'talk';
  const joinTypes = new Map((meetupDoc?.members || []).map((m) => [String(m.user), m.joinType]));
  const members = room.users.map((u) => {
    const isHost = room.type === 'meetup' && idEq(meetupDoc?.host, u);
    return {
      user: publicUser(userMap.get(String(u))) || { _id: String(u), nickname: '알 수 없음', profileImage: '' },
      isHost,
      joinType: room.type === 'meetup' ? (isHost ? hostJoinType : joinTypes.get(String(u)) || null) : null,
      isMe: idEq(u, userId),
      blocked: blockedIds.includes(String(u)),
    };
  });

  const [notices, { messages, hasMore }, friendship] = await Promise.all([
    noticeMessages(room.notices),
    loadMessages(room._id, blockedIds, null),
    room.type === 'direct' ? Friendship.findOne({ room: room._id }, { _id: 1 }).lean() : null,
  ]);
  const closed = isClosed(room, now);

  return {
    room: {
      ...roomSummary(room, ctx, userId, now),
      friendshipId: friendship ? String(friendship._id) : null, // 1:1 방 '친구 끊기'
      isHost: room.type === 'meetup' && idEq(meetupDoc?.host, userId),
      canReport: isVisible(room, now), // 모임 방은 닫힌 뒤 30일까지 (목록에 보이는 동안)
      noticeMax: NOTICE_MAX,
      notices,
      members,
      reads: (room.reads || []).map((r) => ({ user: String(r.user), at: r.at })),
      closed,
    },
    messages,
    hasMore,
  };
}

/** 더 이전 메시지 — before: 지금 화면 맨 위 메시지 id */
async function listMessages(roomId, userId, before) {
  const room = await findRoomFor(roomId, userId);
  return loadMessages(room._id, await blockedIdsOf(userId), before);
}

// ---------- 쓰기 ----------

async function sendMessage(roomId, userId, rawText) {
  const room = await findRoomFor(roomId, userId);
  if (isClosed(room)) throw httpError(400, room.type === 'meetup' ? '평가가 마감돼 읽기만 할 수 있어요' : '닫힌 채팅방이에요');
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) throw httpError(400, '메시지를 적어 주세요');
  if (text.length > TEXT_MAX) throw httpError(400, `${TEXT_MAX}자 안으로 줄여 주세요`);
  return toMessage(await pushMessage(room, userId, text));
}

/** 읽음 표시 — 방을 보고 있는 동안 새 메시지마다 */
async function markRead(roomId, userId) {
  const room = await findRoomFor(roomId, userId);
  const at = new Date();
  await setRead(room._id, userId, at);
  emitToUsers(room.users, 'chat:read', { roomId: String(room._id), userId: String(userId), at });
  return at;
}

async function emitNotices(room) {
  const fresh = await ChatRoom.findById(room._id, { notices: 1 }).lean();
  const notices = await noticeMessages(fresh.notices);
  emitToUsers(room.users, 'chat:notices', { roomId: String(room._id), notices });
  return notices;
}

async function assertHostRoom(roomId, userId) {
  const room = await findRoomFor(roomId, userId);
  if (room.type !== 'meetup') throw httpError(400, '모임 채팅에서만 공지를 고정할 수 있어요');
  const meetup = await Meetup.findById(room.meetup, { host: 1 }).lean();
  if (!idEq(meetup?.host, userId)) throw httpError(403, '공지는 호스트만 고정할 수 있어요');
  if (isClosed(room)) throw httpError(400, '닫힌 채팅방이에요');
  return room;
}

/** 공지 고정 — 호스트만. 최근 고정 먼저 */
async function pinNotice(roomId, userId, messageId) {
  const room = await assertHostRoom(roomId, userId);
  if (!mongoose.isValidObjectId(messageId)) throw httpError(404, '메시지를 찾을 수 없습니다');
  const message = await ChatMessage.findOne({ _id: messageId, room: room._id }).lean();
  if (!message || !message.sender) throw httpError(404, '메시지를 찾을 수 없습니다');
  if ((room.notices || []).some((n) => idEq(n, messageId))) throw httpError(409, '이미 고정한 공지예요');
  if ((room.notices || []).length >= NOTICE_MAX) throw httpError(400, `공지는 ${NOTICE_MAX}개까지 고정할 수 있어요`);

  await ChatRoom.updateOne({ _id: room._id }, { $push: { notices: { $each: [message._id], $position: 0 } } });
  return emitNotices(room);
}

async function unpinNotice(roomId, userId, messageId) {
  const room = await assertHostRoom(roomId, userId);
  if (!mongoose.isValidObjectId(messageId)) throw httpError(404, '공지를 찾을 수 없습니다');
  await ChatRoom.updateOne({ _id: room._id }, { $pull: { notices: oid(messageId) } });
  return emitNotices(room);
}

/** 신고 — 메시지 또는 참여자. 모임 방은 닫힌 뒤 30일까지 */
async function report(roomId, userId, { targetId, messageId }) {
  const room = await findRoomFor(roomId, userId);
  let target = targetId;
  if (messageId) {
    if (!mongoose.isValidObjectId(messageId)) throw httpError(404, '메시지를 찾을 수 없습니다');
    const message = await ChatMessage.findOne({ _id: messageId, room: room._id }).lean();
    if (!message?.sender) throw httpError(404, '메시지를 찾을 수 없습니다');
    target = message.sender;
  }
  if (!target || !mongoose.isValidObjectId(target) || !room.users.some((u) => idEq(u, target))) {
    throw httpError(404, '신고할 사람을 찾을 수 없습니다');
  }
  if (idEq(target, userId)) throw httpError(400, '나를 신고할 수는 없어요');

  try {
    await Report.create({ reporter: userId, target, room: room._id, ...(messageId && { message: messageId }) });
  } catch (err) {
    if (err.code !== 11000) throw err; // 같은 신고를 또 누른 경우는 그대로 성공
  }
}

// ---------- 정리 (매일 12:00) ----------

/** 닫힌 지 90일 지난 방 삭제 — 처리 중인 신고가 있는 방은 남김 */
async function purgeClosedRooms(now = new Date()) {
  const cutoff = new Date(now.getTime() - CHAT_KEEP_DAYS * DAY);
  const roomIds = await ChatRoom.distinct('_id', { closesAt: { $ne: null, $lte: cutoff } });
  if (!roomIds.length) return { rooms: 0, messages: 0, kept: 0 };
  const kept = new Set((await Report.distinct('room', { status: 'pending', room: { $in: roomIds } })).map(String));
  const targets = roomIds.filter((id) => !kept.has(String(id)));
  const { deletedCount: messages } = await ChatMessage.deleteMany({ room: { $in: targets } });
  const { deletedCount: rooms } = await ChatRoom.deleteMany({ _id: { $in: targets } });
  return { rooms, messages, kept: kept.size };
}

module.exports = {
  ensureMeetupRoom,
  addMeetupMember,
  syncMeetupRoom,
  closeMeetupRoom,
  createDirectRoom,
  closeDirectRoom,
  listRooms,
  totalUnread,
  roomIdForMeetup,
  getRoom,
  listMessages,
  sendMessage,
  markRead,
  pinNotice,
  unpinNotice,
  report,
  purgeClosedRooms,
};
