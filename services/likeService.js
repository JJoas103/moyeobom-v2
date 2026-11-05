const mongoose = require('mongoose');
const Like = require('../models/Like');
const { TYPES } = require('../models/Like');
const Event = require('../models/Event');
const Meetup = require('../models/Meetup');
const eventService = require('./eventService');
const meetupService = require('./meetupService');

// 찜 — 응답 모양은 frontend/src/data/likes.js 맨 위 주석 기준
//   끝난 행사도 찜에 남음 · 취소된 모임은 새로 찜할 수 없고 목록에서 빠짐

const httpError = (status, message) => Object.assign(new Error(message), { status });
const oid = (id) => new mongoose.Types.ObjectId(String(id));

// 내 찜 _id 목록 — 최근 순, 종류별. 모임은 취소된 것 제외
async function likedIds(userId) {
  const likes = await Like.find({ user: oid(userId) }, { type: 1, target: 1 }).sort({ createdAt: -1, _id: -1 }).lean();
  const ofType = (type) => likes.filter((l) => l.type === type).map((l) => l.target);
  const meetupIds = ofType('meetup');
  const alive = new Set((await Meetup.distinct('_id', { _id: { $in: meetupIds }, status: { $ne: 'cancelled' } })).map(String));
  return { events: ofType('event'), meetups: meetupIds.filter((id) => alive.has(String(id))) };
}

/** 내가 찜한 _id 들 → { events: [_id], meetups: [_id] } — 카드 하트 표시용 */
async function listLikeIds(userId) {
  const { events, meetups } = await likedIds(userId);
  return { events: events.map(String), meetups: meetups.map(String) };
}

/** 찜 목록 → { events: [행사 + 모임 수], meetups: [모임] } 최근 찜한 순 */
async function listLikes(userId) {
  const ids = await likedIds(userId);
  const [events, meetups] = await Promise.all([eventService.listEventsByIds(ids.events), meetupService.listMeetupsByIds(ids.meetups, userId)]);
  return { events, meetups };
}

// 찜할 대상이 있는지 — 없거나 취소된 모임이면 막음
async function assertLikable(type, id) {
  if (!TYPES.includes(type) || !mongoose.isValidObjectId(id)) throw httpError(404, '찜할 대상을 찾을 수 없습니다');
  if (type === 'event') {
    if (!(await Event.exists({ _id: id }))) throw httpError(404, '행사를 찾을 수 없습니다');
    return;
  }
  const meetup = await Meetup.findById(id, { status: 1 }).lean();
  if (!meetup) throw httpError(404, '모임을 찾을 수 없습니다');
  if (meetup.status === 'cancelled') throw httpError(400, '취소된 모임은 찜할 수 없어요');
}

/** 찜하기 — 이미 찜했어도 그대로 성공 */
async function addLike(userId, type, id) {
  await assertLikable(type, id);
  const key = { user: oid(userId), type, target: oid(id) };
  try {
    await Like.updateOne(key, { $setOnInsert: key }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err; // 동시에 두 번 눌린 경우는 그대로 성공
  }
}

/** 찜 풀기 — 안 찜했어도 그대로 성공 */
async function removeLike(userId, type, id) {
  if (!TYPES.includes(type) || !mongoose.isValidObjectId(id)) throw httpError(404, '찜할 대상을 찾을 수 없습니다');
  await Like.deleteOne({ user: oid(userId), type, target: oid(id) });
}

/** 회원 탈퇴 — 내 찜 전부 지우기 */
async function removeUser(userId) {
  await Like.deleteMany({ user: oid(userId) });
}

module.exports = { listLikeIds, listLikes, addLike, removeLike, removeUser };
