const mongoose = require('mongoose');
const FriendLink = require('../models/FriendLink');
const Friendship = require('../models/Friendship');
const { MEMO_MAX } = require('../models/Friendship');
const Block = require('../models/Block');
const User = require('../models/User');
const chatService = require('./chatService');
const { emitToUsers } = require('../config/socket');
const { DAY, SENT_EXPIRED_SHOW_DAYS, friendRequestExpiresAt } = require('./socialRules');
const { summarizeMeetups } = require('./meetupSummary');

// 친구 — 응답 모양은 frontend/src/data/friends.js 맨 위 주석 기준
//   '또 만나고 싶어요'를 서로 고름 → FriendLink(평가 마감에 '요청 가능') → 요청 → 상대도 요청(= 수락) → 친구 + 1:1 방
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

/** 나와 차단 관계(내가 했든 당했든)인 사람 id */
async function blockedEitherIds(me) {
  const docs = await Block.find({ $or: [{ blocker: oid(me) }, { blocked: oid(me) }] }, { blocker: 1, blocked: 1 }).lean();
  return new Set(docs.map((d) => String(idEq(d.blocker, me) ? d.blocked : d.blocker)));
}

const findFriendship = (a, b) => {
  const [userA, userB] = pairOf(a, b);
  return Friendship.findOne({ userA, userB }).lean();
};

const notify = (userIds) => emitToUsers(userIds, 'friends:changed', {});

// ---------- 평가에서 부름 ----------

/** 서로 '또 만나고 싶어요'를 고른 두 사람 → 요청 자리 만들기 (이미 친구 · 차단이면 건너뜀) */
async function createLink(meetupId, a, b, reviewClosesAt) {
  if (await isBlockedEither(a, b)) return;
  if (await findFriendship(a, b)) return;
  const [userA, userB] = pairOf(a, b);
  await FriendLink.updateOne(
    { meetup: meetupId, userA, userB },
    {
      $setOnInsert: {
        requests: [],
        status: 'open',
        visibleAt: reviewClosesAt,
        expiresAt: friendRequestExpiresAt(reviewClosesAt),
      },
    },
    { upsert: true }
  );
}

// ---------- 요청 · 수락 ----------

/** 친구 맺기 — 친구 문서 + 1:1 방. 동시에 두 번 불려도 하나만 생김 */
async function makeFriends(link) {
  const { userA, userB } = link;
  let friendship;
  try {
    friendship = await Friendship.create({ userA, userB, meetup: link.meetup });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
  if (friendship) {
    const room = await chatService.createDirectRoom([userA, userB], link.meetup);
    await Friendship.updateOne({ _id: friendship._id }, { $set: { room: room._id } });
    emitToUsers([userA, userB], 'chat:rooms', {});
  }
  await FriendLink.updateMany({ userA, userB, status: 'open' }, { $set: { status: 'friends' } });
  notify([userA, userB]);
}

/**
 * 친구 요청 보내기 = 받은 요청 수락 (같은 동작). 상대도 이미 요청했으면 바로 친구
 * @returns {{ status: 'requested' | 'friends' }}
 */
async function sendRequest(linkId, me) {
  if (!mongoose.isValidObjectId(linkId)) throw httpError(404, '요청을 찾을 수 없습니다');
  const link = await FriendLink.findById(linkId).lean();
  if (!link || (!idEq(link.userA, me) && !idEq(link.userB, me))) throw httpError(404, '요청을 찾을 수 없습니다');

  const now = new Date();
  const other = otherOf(link, me);
  if (link.status === 'friends' || (await findFriendship(me, other))) return { status: 'friends' };
  if (now < new Date(link.visibleAt)) throw httpError(404, '요청을 찾을 수 없습니다');
  if (link.status === 'expired' || now >= new Date(link.expiresAt)) throw httpError(400, '기한이 지나 요청할 수 없어요');
  if (await isBlockedEither(me, other)) throw httpError(404, '요청을 찾을 수 없습니다');
  if (link.requests.some((r) => idEq(r.user, me))) throw httpError(409, '이미 요청을 보냈어요');

  const updated = await FriendLink.findOneAndUpdate(
    { _id: link._id, status: 'open', expiresAt: { $gt: now }, 'requests.user': { $ne: oid(me) } },
    { $push: { requests: { user: oid(me), at: now } } },
    { new: true }
  ).lean();
  if (!updated) throw httpError(409, '요청하지 못했어요. 새로고침 후 다시 시도해 주세요');

  if (updated.requests.length >= 2) {
    await makeFriends(updated);
    return { status: 'friends' };
  }
  notify([me, other]);
  return { status: 'requested' };
}

/** 모두 요청 보내기 · 모두 수락 — 하나씩 처리하고 결과 수 반환 */
async function sendRequests(linkIds, me) {
  const ids = Array.isArray(linkIds) ? [...new Set(linkIds.map(String))] : [];
  if (!ids.length) throw httpError(400, '보낼 요청을 골라 주세요');
  const result = { requested: 0, friends: 0, failed: 0 };
  for (const id of ids) {
    try {
      const { status } = await sendRequest(id, me);
      result[status] += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

// ---------- 조회 ----------

/** 내 친구 목록 — 최근 친구 먼저. 메모는 본인 것만 */
async function listFriends(me) {
  const docs = await Friendship.find(partyQuery(me)).sort({ createdAt: -1 }).lean();
  const otherIds = docs.map((d) => otherOf(d, me));
  const [users, meetups, receivedCount] = await Promise.all([
    User.find({ _id: { $in: otherIds } }, { nickname: 1, profileImage: 1 }).lean(),
    summarizeMeetups(docs.map((d) => d.meetup).filter(Boolean)),
    countReceived(me),
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
  return { friends, receivedCount };
}

// 지금 보이는 요청 자리 — 평가 마감 지난 것, 만료된 건 SENT_EXPIRED_SHOW_DAYS 일까지
async function visibleLinks(me, now) {
  const [links, blocked] = await Promise.all([
    FriendLink.find({
      ...partyQuery(me),
      visibleAt: { $lte: now },
      $and: [
        {
          $or: [
            { status: 'open' },
            { status: 'expired', expiresAt: { $gt: new Date(now.getTime() - SENT_EXPIRED_SHOW_DAYS * DAY) } },
          ],
        },
      ],
    })
      .sort({ expiresAt: 1 })
      .lean(),
    blockedEitherIds(me),
  ]);
  return links.filter((l) => !blocked.has(String(otherOf(l, me))));
}

/** 받은 요청 · 요청 가능 · 보낸 요청 나누기 */
function classify(link, me, now) {
  const other = otherOf(link, me);
  const mine = link.requests.some((r) => idEq(r.user, me));
  const theirs = link.requests.some((r) => idEq(r.user, other));
  const expired = link.status === 'expired' || new Date(link.expiresAt) <= now;
  if (expired) return mine ? 'sent' : null; // 만료된 '요청 가능' · '받은 요청'은 조용히 사라짐
  if (theirs && !mine) return 'received';
  if (!theirs && !mine) return 'available';
  if (mine && !theirs) return 'sent';
  return null;
}

async function countReceived(me) {
  const now = new Date();
  return (await visibleLinks(me, now)).filter((l) => classify(l, me, now) === 'received').length;
}

/** 요청 탭 — { received, available, sent, friendCount } */
async function listRequests(me) {
  const now = new Date();
  const links = await visibleLinks(me, now);
  const groups = { received: [], available: [], sent: [] };
  const sorted = links.map((l) => [l, classify(l, me, now)]).filter(([, group]) => group);

  const otherIds = sorted.map(([l]) => otherOf(l, me));
  const [users, meetups, friendCount, friendDocs] = await Promise.all([
    User.find({ _id: { $in: otherIds } }, { nickname: 1, profileImage: 1 }).lean(),
    summarizeMeetups(sorted.map(([l]) => l.meetup)),
    Friendship.countDocuments(partyQuery(me)),
    Friendship.find(partyQuery(me), { userA: 1, userB: 1 }).lean(),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const friendIds = new Set(friendDocs.map((d) => String(otherOf(d, me))));

  for (const [link, group] of sorted) {
    const other = String(otherOf(link, me));
    if (!userMap.has(other) || friendIds.has(other)) continue; // 탈퇴 · 이미 친구
    groups[group].push({
      _id: String(link._id),
      user: publicUser(userMap.get(other)),
      meetup: meetups.get(String(link.meetup)) || null,
      expiresAt: link.expiresAt,
      expired: link.status === 'expired' || new Date(link.expiresAt) <= now,
    });
  }
  return { ...groups, friendCount };
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

// ---------- 정리 (매일 12:00) ----------

async function expireLinks(now = new Date()) {
  const { modifiedCount } = await FriendLink.updateMany({ status: 'open', expiresAt: { $lte: now } }, { $set: { status: 'expired' } });
  return modifiedCount;
}

module.exports = {
  createLink,
  sendRequest,
  sendRequests,
  listFriends,
  listRequests,
  setMemo,
  unfriend,
  block,
  expireLinks,
};
