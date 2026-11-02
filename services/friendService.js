const mongoose = require('mongoose');
const Friendship = require('../models/Friendship');
const { MEMO_MAX } = require('../models/Friendship');
const Block = require('../models/Block');
const User = require('../models/User');
const chatService = require('./chatService');
const { emitToUsers } = require('../config/socket');
const { summarizeMeetups } = require('./meetupSummary');

// 친구 — 응답 모양은 frontend/src/data/friends.js 맨 위 주석 기준
//   '또 만나고 싶어요'를 서로 고름 → 그 자리에서 친구 + 1:1 방 (요청 · 수락 단계 없음)
//   양쪽 평가가 모두 들어와야 성립하므로, 아직 평가를 안 낸 사람은 그 전에 아무것도 볼 수 없다
// 실시간: 두 사람 user 방으로 'friends:changed' (목록 다시 불러오기)

const httpError = (status, message) => Object.assign(new Error(message), { status });
const idEq = (a, b) => Boolean(a && b) && String(a) === String(b);
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const publicUser = (user) => (user ? { _id: String(user._id), nickname: user.nickname, profileImage: user.profileImage || '' } : null);

/** 두 사람을 userA < userB 순서로 */
const pairOf = (a, b) => (String(a) < String(b) ? [oid(a), oid(b)] : [oid(b), oid(a)]);
const otherOf = (doc, me) => (idEq(doc.userA, me) ? doc.userB : doc.userA);
const partyQuery = (me) => ({ $or: [{ userA: oid(me) }, { userB: oid(me) }] });

async function isBlockedEither(a, b) {
  return Boolean(
    await Block.exists({
      $or: [
        { blocker: oid(a), blocked: oid(b) },
        { blocker: oid(b), blocked: oid(a) },
      ],
    })
  );
}

const findFriendship = (a, b) => {
  const [userA, userB] = pairOf(a, b);
  return Friendship.findOne({ userA, userB }).lean();
};

const notify = (userIds) => emitToUsers(userIds, 'friends:changed', {});

// ---------- 평가에서 부름 ----------

/**
 * 서로 '또 만나고 싶어요'를 고름 → 그 자리에서 친구 + 1:1 방.
 * 차단 관계면 건너뛴다. 유니크 인덱스(userA+userB)가 있어 동시에 두 번 불려도 하나만 생긴다.
 */
async function makeFriends(meetupId, a, b) {
  if (await isBlockedEither(a, b)) return;
  const [userA, userB] = pairOf(a, b);
  let friendship;
  try {
    friendship = await Friendship.create({ userA, userB, meetup: meetupId });
  } catch (err) {
    if (err.code !== 11000) throw err;
    return; // 이미 친구다
  }
  const room = await chatService.createDirectRoom([userA, userB], meetupId);
  await Friendship.updateOne({ _id: friendship._id }, { $set: { room: room._id } });
  emitToUsers([userA, userB], 'chat:rooms', {});
  notify([userA, userB]); // 상대가 화면을 열어 두고 있으면 새로고침 없이 나타난다
}

// ---------- 조회 ----------

/** 내 친구 목록 — 최근 친구 먼저. 메모는 본인 것만 */
async function listFriends(me) {
  const docs = await Friendship.find(partyQuery(me)).sort({ createdAt: -1 }).lean();
  const otherIds = docs.map((d) => otherOf(d, me));
  const [users, meetups] = await Promise.all([
    User.find({ _id: { $in: otherIds } }, { nickname: 1, profileImage: 1 }).lean(),
    summarizeMeetups(docs.map((d) => d.meetup).filter(Boolean)),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const friends = docs
    .filter((d) => userMap.has(String(otherOf(d, me)))) // 탈퇴한 사람 제외
    .map((d) => ({
      _id: String(d._id),
      user: publicUser(userMap.get(String(otherOf(d, me)))),
      memo: d.memos?.find((m) => idEq(m.user, me))?.text || '',
      roomId: d.room ? String(d.room) : null,
      meetup: d.meetup ? meetups.get(String(d.meetup)) || null : null,
      since: d.createdAt,
    }));
  return { friends };
}

// ---------- 메모 · 끊기 · 차단 ----------

async function findMyFriendship(friendshipId, me) {
  if (!mongoose.isValidObjectId(friendshipId)) throw httpError(404, '친구를 찾을 수 없습니다');
  const doc = await Friendship.findOne({ _id: friendshipId, ...partyQuery(me) }).lean();
  if (!doc) throw httpError(404, '친구를 찾을 수 없습니다');
  return doc;
}

/** 메모 — 본인만 보임. 빈 값이면 지움 */
async function setMemo(friendshipId, me, rawText) {
  const doc = await findMyFriendship(friendshipId, me);
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (text.length > MEMO_MAX) {
    throw Object.assign(new Error('입력한 내용을 확인해 주세요'), { status: 400, fieldErrors: { memo: `${MEMO_MAX}자 안으로 줄여 주세요.` } });
  }
  await Friendship.updateOne({ _id: doc._id }, { $pull: { memos: { user: oid(me) } } });
  if (text) await Friendship.updateOne({ _id: doc._id }, { $push: { memos: { user: oid(me), text } } });
  return text;
}

async function endFriendship(doc) {
  await Friendship.deleteOne({ _id: doc._id });
  await chatService.closeDirectRoom(doc.room);
  notify([doc.userA, doc.userB]);
}

/** 친구 끊기 — 1:1 방은 목록에서 바로 사라짐 (대화는 90일 뒤 삭제) */
async function unfriend(friendshipId, me) {
  await endFriendship(await findMyFriendship(friendshipId, me));
}

/** 차단 — 친구였으면 끊고, 요청 자리도 안 보이게 */
async function block(me, targetId) {
  if (!mongoose.isValidObjectId(targetId)) throw httpError(404, '사용자를 찾을 수 없습니다');
  if (idEq(me, targetId)) throw httpError(400, '나를 차단할 수는 없어요');
  if (!(await User.exists({ _id: targetId }))) throw httpError(404, '사용자를 찾을 수 없습니다');

  await Block.updateOne({ blocker: oid(me), blocked: oid(targetId) }, { $setOnInsert: { blocker: oid(me), blocked: oid(targetId) } }, { upsert: true });
  const friendship = await findFriendship(me, targetId);
  if (friendship) await endFriendship(friendship);
  else notify([me]);
  emitToUsers([me], 'chat:rooms', {}); // 모임 채팅에서 상대 메시지 숨김 반영
}

/** 내가 차단한 사람 → { blocks: [{ user, blockedAt }] } 최근 순 (탈퇴한 사람 제외) */
async function listBlocks(me) {
  const docs = await Block.find({ blocker: oid(me) }).sort({ createdAt: -1 }).populate('blocked', 'nickname profileImage').lean();
  return { blocks: docs.filter((d) => d.blocked).map((d) => ({ user: publicUser(d.blocked), blockedAt: d.createdAt })) };
}

/** 차단 풀기 — 끊긴 친구 · 지나간 요청 자리는 되살리지 않음 */
async function unblock(me, targetId) {
  if (!mongoose.isValidObjectId(targetId)) throw httpError(404, '사용자를 찾을 수 없습니다');
  await Block.deleteOne({ blocker: oid(me), blocked: oid(targetId) });
  notify([me]);
  emitToUsers([me], 'chat:rooms', {}); // 모임 채팅에서 상대 메시지 다시 보임
}

/** 탈퇴 — 친구 끊기(1:1 방 닫힘) · 차단 기록 정리 */
async function removeUser(me) {
  const friendships = await Friendship.find(partyQuery(me)).lean();
  for (const doc of friendships) await endFriendship(doc);
  await Block.deleteMany({ $or: [{ blocker: oid(me) }, { blocked: oid(me) }] });
}

module.exports = {
  makeFriends,
  listFriends,
  setMemo,
  unfriend,
  block,
  listBlocks,
  unblock,
  removeUser,
};
