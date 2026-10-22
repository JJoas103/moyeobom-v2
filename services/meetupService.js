const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Meetup = require('../models/Meetup');
const Event = require('../models/Event');
const User = require('../models/User');
const Review = require('../models/Review');
const { BUDGETS } = require('../models/Meetup');
const { periodRange, RECENT_ENDED_DAYS } = require('./eventService');
const chatService = require('./chatService');
const { reviewWindow } = require('./socialRules');

// 모임 — 응답 모양은 frontend/src/data/meetups.js 맨 위 주석 기준
// members · talk.place 는 호스트 · 승인된 참여자 전용

const DAY = 24 * 60 * 60 * 1000;
const TIMELINE_TITLE_MAX = 30; // 타임라인 '모두' 칸 제목
const MEET_BEFORE_MS = 20 * 60 * 1000; // 관람 회차 20분 전 만남 (프론트가 안 보내면 서버 계산)
const IMAGE_PATH = /^\/images\/upload\/[\w.-]+$/; // 우리 서버에 올린 사진만

// 모임 응답에 붙이는 행사 필드
const EVENT_FIELDS = [
  '_id', 'title', 'subtitle', 'category', 'genre', 'runType', 'posterUrl', 'venue', 'area', 'district',
  'location', 'startDate', 'endDate', 'runningTime', 'sessionsText',
];
const pick = (obj, keys) => (obj ? Object.fromEntries(keys.map((k) => [k, obj[k] ?? null])) : null);

const httpError = (status, message) => Object.assign(new Error(message), { status });
const fieldError = (fieldErrors) =>
  Object.assign(new Error('입력한 내용을 확인해 주세요'), { status: 400, fieldErrors });

const idEq = (a, b) => Boolean(a && b) && String(a) === String(b);
const approvedCountOf = (doc) => (doc.members || []).filter((m) => m.status === 'approved').length;

/** 이 행사로 지금 모임을 열 수 있는지 — 끝난 지 RECENT_ENDED_DAYS 일까지 (프론트 utils/event.js canOpenMeetup 과 같게) */
const canOpenMeetup = (event, now) => !event.endDate || now - new Date(event.endDate) <= RECENT_ENDED_DAYS * DAY;

// 채팅방 처리는 곁가지 — 실패해도 모임 작업(만들기 · 승인 등)은 성공으로 두고 기록만
async function sideEffect(label, run) {
  try {
    await run();
  } catch (err) {
    console.error(`[모임 채팅] ${label} 실패:`, err.message);
  }
}

// ---------- 응답 만들기 ----------

const publicUser = (user) => (user ? { _id: String(user._id), nickname: user.nickname, profileImage: user.profileImage || '' } : null);

/**
 * 모임 문서 → API 응답
 * @param ctx { events: Map, users: Map, hostedCounts: Map, viewerId, withMembers }
 */
function serialize(doc, { events, users, hostedCounts, viewerId, withMembers = false }) {
  const isHost = idEq(doc.host, viewerId);
  const mine = (doc.members || []).find((m) => idEq(m.user, viewerId));
  const approved = mine?.status === 'approved';
  const canSeePrivate = isHost || approved;

  const { members = [], talk, host, event, __v, ...rest } = doc;
  const response = {
    ...rest,
    talk: {
      startAt: talk.startAt,
      area: talk.area,
      startTitle: talk.startTitle,
      ...(canSeePrivate && { place: talk.place }),
    },
    event: pick(events.get(String(event)), EVENT_FIELDS),
    host: users.get(String(host)) ? { ...publicUser(users.get(String(host))), hostedCount: hostedCounts.get(String(host)) || 0 } : null,
    approvedCount: approvedCountOf(doc),
    isHost,
    myMembership: mine ? { status: mine.status, joinType: mine.joinType } : null,
    review: reviewWindow(talk.startAt), // { opensAt, closesAt } — 평가 기한 (모임 채팅도 closesAt 에 읽기 전용)
  };

  // 호스트: 신청자 전부(승인 처리용) / 승인된 참여자: 승인된 사람끼리
  if (withMembers && canSeePrivate) {
    response.members = members
      .filter((m) => isHost || m.status === 'approved')
      .map((m) => ({
        user: publicUser(users.get(String(m.user))),
        joinType: m.joinType,
        status: m.status,
        appliedAt: m.appliedAt,
        approvedAt: m.approvedAt || null,
      }));
  }
  return response;
}

// 행사 · 사용자 · 호스트별 모임 수를 한 번에 조회 → serialize 에 전달
async function loadContext(docs, { withMembers }) {
  const eventIds = [...new Set(docs.map((d) => String(d.event)))];
  const hostIds = [...new Set(docs.map((d) => String(d.host)))];
  const memberIds = withMembers ? docs.flatMap((d) => (d.members || []).map((m) => String(m.user))) : [];
  const userIds = [...new Set([...hostIds, ...memberIds])];

  const [events, users, counts] = await Promise.all([
    Event.find({ _id: { $in: eventIds } }).lean(),
    User.find({ _id: { $in: userIds } }, { nickname: 1, profileImage: 1 }).lean(),
    Meetup.aggregate([
      { $match: { host: { $in: hostIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: '$host', n: { $sum: 1 } } },
    ]),
  ]);
  return {
    events: new Map(events.map((e) => [String(e._id), e])),
    users: new Map(users.map((u) => [String(u._id), u])),
    hostedCounts: new Map(counts.map((c) => [String(c._id), c.n])),
  };
}

async function serializeMany(docs, viewerId, { withMembers = false } = {}) {
  const ctx = await loadContext(docs, { withMembers });
  return docs.map((doc) => serialize(doc, { ...ctx, viewerId, withMembers }));
}

// ---------- 조회 ----------

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 승인된 인원 < 정원 — 쿼리 조건으로 쓰는 식
const notFullExpr = {
  $lt: [
    { $size: { $filter: { input: { $ifNull: ['$members', []] }, cond: { $eq: ['$$this.status', 'approved'] } } } },
    '$capacity',
  ],
};

/**
 * 모임 목록 — 가까운 날짜순. 이미 시작한 모임은 기본 제외
 * @param params { eventId, category, district, period, joinType, alcohol, budget, q, openOnly, includePast }
 */
async function listMeetups(params, viewerId) {
  const { eventId, category, district, period, joinType, alcohol, budget, q, openOnly, includePast } = params;
  const now = new Date();
  const and = [{ status: { $ne: 'cancelled' } }]; // 취소된 모임은 목록에서 제외

  if (!includePast) and.push({ 'talk.startAt': { $gte: now } });
  if (eventId) {
    if (!mongoose.isValidObjectId(eventId)) return [];
    and.push({ event: new mongoose.Types.ObjectId(eventId) });
  }
  const range = periodRange(period, now);
  if (range) and.push({ 'talk.startAt': { $gte: range[0], $lte: range[1] } });
  if (joinType === 'watch') and.push({ 'watch.enabled': true });
  if (joinType === 'talk') and.push({ 'watch.enabled': { $ne: true } });
  if (alcohol === 'yes') and.push({ alcohol: true });
  if (alcohol === 'no') and.push({ alcohol: false });
  if (budget) and.push({ budget });
  if (openOnly) and.push({ status: 'open' }, { $expr: notFullExpr });

  // 행사 조건(분류 · 지역)은 행사 _id 목록으로 변환해 적용
  if (category || district) {
    const eventIds = await Event.distinct('_id', { ...(category && { category }), ...(district && { district }) });
    and.push({ event: { $in: eventIds } });
  }
  // 검색어: 모임 제목 또는 행사 제목
  const keyword = q?.trim();
  if (keyword) {
    const regex = { $regex: escapeRegex(keyword), $options: 'i' };
    const eventIds = await Event.distinct('_id', { title: regex });
    and.push({ $or: [{ title: regex }, { event: { $in: eventIds } }] });
  }

  const docs = await Meetup.find(and.length ? { $and: and } : {})
    .sort({ 'talk.startAt': 1, _id: 1 })
    .lean();
  return serializeMany(docs, viewerId);
}

async function findDoc(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, '모임을 찾을 수 없습니다');
  const doc = await Meetup.findById(id).lean();
  if (!doc) throw httpError(404, '모임을 찾을 수 없습니다');
  return doc;
}

/** 모임 하나 — 보는 사람에 따라 talk.place · members 포함. 확정 참여자면 내 평가 제출 여부도 */
async function getMeetup(id, viewerId) {
  const doc = await findDoc(id);
  const [meetup] = await serializeMany([doc], viewerId, { withMembers: true });
  if (meetup.isHost || meetup.myMembership?.status === 'approved') {
    meetup.review.submitted = Boolean(await Review.exists({ meetup: doc._id, reviewer: viewerId }));
  }
  return meetup;
}

// ---------- 만들기 ----------

const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** 입력 검사 — 프론트 CreateInfo validate 와 같은 규칙 + 서버만 알 수 있는 것(행사 기간). fieldErrors 키도 프론트와 같게 */
function buildMeetup(body, event, now) {
  const e = {};
  const title = text(body.title);
  const intro = text(body.intro);
  if (!title) e.title = '모임 제목을 적어 주세요.';
  else if (title.length > 40) e.title = '40자 안으로 줄여 주세요.';
  if (intro.length > 200) e.intro = '200자 안으로 줄여 주세요.';

  const imageUrl = text(body.imageUrl);
  if (imageUrl && !IMAGE_PATH.test(imageUrl)) e.image = '사진을 다시 올려 주세요.';

  const talk = body.talk || {};
  const startAt = toDate(talk.startAt);
  if (!startAt) e.talkStart = '만나는 날짜와 시각을 골라 주세요.';
  else if (startAt <= now) e.talkStart = '지금보다 뒤의 시각으로 골라 주세요.';
  const place = text(talk.place);
  const area = text(talk.area);
  if (!place) e.place = '만날 장소를 적어 주세요.';
  if (!area) e.area = '목록에 보일 동네를 적어 주세요. 예: 혜화역 근처';
  const startTitle = text(talk.startTitle);
  if (!startTitle) e.startTitle = '만나서 할 일을 적어 주세요.';
  else if (startTitle.length > TIMELINE_TITLE_MAX) e.startTitle = `${TIMELINE_TITLE_MAX}자 안으로 줄여 주세요.`;

  if (!BUDGETS.includes(body.budget)) e.budget = '예산을 골라 주세요.';
  const capacity = Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10) e.capacity = '정원은 2~10명으로 골라 주세요.';

  // 관람도 함께
  const watchIn = body.watch || {};
  let watch = { enabled: false };
  if (watchIn.enabled) {
    const ended = event.endDate && new Date(event.endDate) < now;
    const sessionAt = toDate(watchIn.sessionAt);
    const meetPlace = text(watchIn.meetPlace);
    if (ended) e.sessionAt = '이미 끝난 행사라 이야기 자리만 열 수 있어요.';
    else if (!sessionAt) e.sessionAt = '관람 회차 시각을 골라 주세요.';
    else if (sessionAt <= now) e.sessionAt = '지금보다 뒤의 회차로 골라 주세요.';
    else if (startAt && sessionAt >= startAt) e.sessionAt = '관람은 이야기 자리보다 먼저여야 해요.';
    else if (event.endDate && sessionAt > new Date(event.endDate)) e.sessionAt = '행사 기간이 지난 회차예요.';
    if (!meetPlace) e.meetPlace = '관람 전에 만날 곳을 적어 주세요.';

    const meetAt = toDate(watchIn.meetAt) || (sessionAt && new Date(sessionAt.getTime() - MEET_BEFORE_MS));
    watch = { enabled: true, sessionAt, meetAt, meetPlace };
  }

  if (Object.keys(e).length) throw fieldError(e);

  return {
    event: event._id,
    title,
    intro,
    imageUrl,
    talk: { startAt, place, area, startTitle },
    alcohol: body.alcohol === true || body.alcohol === 'true',
    budget: body.budget,
    capacity,
    watch,
    members: [],
    status: 'open',
  };
}

/** 모임 만들기 — 로그인한 사람이 호스트 */
async function createMeetup(body, hostId) {
  if (!mongoose.isValidObjectId(body.event)) throw httpError(404, '행사를 찾을 수 없습니다');
  const event = await Event.findById(body.event).lean();
  if (!event) throw httpError(404, '행사를 찾을 수 없습니다');

  const now = new Date();
  if (!canOpenMeetup(event, now)) throw httpError(400, '끝난 지 오래된 행사라 모임을 열 수 없어요');

  const doc = await Meetup.create({ ...buildMeetup(body, event, now), host: hostId });
  await sideEffect('방 만들기', () => chatService.ensureMeetupRoom(doc.toObject()));
  return getMeetup(doc._id, hostId);
}

// ---------- 수정 · 마감 · 취소 (호스트만) ----------

// 호스트 본인 · 취소 안 된 · 아직 시작 안 한 모임만 바꿀 수 있음
function assertEditable(doc, hostId, now) {
  if (!idEq(doc.host, hostId)) throw httpError(403, '호스트만 바꿀 수 있어요');
  if (doc.status === 'cancelled') throw httpError(400, '취소된 모임이에요');
  if (new Date(doc.talk.startAt) <= now) throw httpError(400, '이미 시작한 모임은 바꿀 수 없어요');
}

// 바꾼 사진이 우리 서버에 올린 파일이면 예전 파일 삭제
function removeOldImage(oldUrl, newUrl) {
  if (!oldUrl || oldUrl === newUrl || !IMAGE_PATH.test(oldUrl)) return;
  fs.unlink(path.join(__dirname, '..', 'public', oldUrl), () => {});
}

/** 모임 수정 — 행사 빼고 전부. 정원은 승인된 인원보다 적게 못 줄임 */
async function updateMeetup(id, hostId, body) {
  const doc = await findDoc(id);
  const now = new Date();
  assertEditable(doc, hostId, now);

  const event = await Event.findById(doc.event).lean();
  if (!event) throw httpError(404, '행사를 찾을 수 없습니다');

  const { title, intro, imageUrl, talk, alcohol, budget, capacity, watch } = buildMeetup(body, event, now);
  const approved = approvedCountOf(doc);
  if (capacity < approved) throw fieldError({ capacity: `이미 승인한 ${approved}명보다 적게 줄일 수 없어요.` });

  const updated = await Meetup.findOneAndUpdate(
    // 확인 사이 승인이 늘어 정원 초과되는 경우 방지
    {
      _id: doc._id,
      host: doc.host,
      status: { $ne: 'cancelled' },
      $expr: {
        $lte: [
          { $size: { $filter: { input: { $ifNull: ['$members', []] }, cond: { $eq: ['$$this.status', 'approved'] } } } },
          capacity,
        ],
      },
    },
    { $set: { title, intro, imageUrl, talk, alcohol, budget, capacity, watch } },
    { new: true }
  );
  if (!updated) throw httpError(409, '수정하지 못했어요. 새로고침 후 다시 시도해 주세요');

  removeOldImage(doc.imageUrl, imageUrl);
  await sideEffect('닫히는 시각 맞추기', () => chatService.syncMeetupRoom(updated.toObject()));
  return getMeetup(doc._id, hostId);
}

// 바꿀 수 있는 상태 — 마감 ↔ 다시 열기, 취소(되돌리기 없음)
const STATUS_CHANGES = {
  open: ['closed', 'cancelled'],
  closed: ['open', 'cancelled'],
  cancelled: [],
};

/** 모집 마감 · 다시 열기 · 모임 취소 */
async function setMeetupStatus(id, hostId, status) {
  const doc = await findDoc(id);
  assertEditable(doc, hostId, new Date());
  if (!STATUS_CHANGES[doc.status]?.includes(status)) throw httpError(400, '바꿀 수 없는 상태예요');

  await Meetup.updateOne({ _id: doc._id, status: doc.status }, { $set: { status } });
  if (status === 'cancelled') await sideEffect('방 닫기', () => chatService.closeMeetupRoom(doc._id));
  return getMeetup(doc._id, hostId);
}

// ---------- 신청 · 승인 ----------

/** 참여 신청 — pending 으로 추가. 조건 확인 + 추가를 한 번에 처리 (중복 신청 방지) */
async function applyMeetup(id, userId, joinType) {
  const doc = await findDoc(id);
  const now = new Date();

  if (idEq(doc.host, userId)) throw httpError(400, '내가 연 모임이에요');
  if ((doc.members || []).some((m) => idEq(m.user, userId))) throw httpError(409, '이미 신청한 모임이에요');
  if (doc.status !== 'open') throw httpError(400, '마감된 모임이에요');
  if (new Date(doc.talk.startAt) <= now) throw httpError(400, '이미 시작한 모임이에요');
  if (approvedCountOf(doc) >= doc.capacity) throw httpError(400, '자리가 다 찼어요');
  if (!['watch', 'talk'].includes(joinType)) throw httpError(400, '참여 방식을 골라 주세요');
  if (joinType === 'watch') {
    if (!doc.watch?.enabled) throw httpError(400, '관람 동행을 받지 않는 모임이에요');
    if (doc.watch.sessionAt && new Date(doc.watch.sessionAt) <= now) throw httpError(400, '관람 회차가 지나 이야기 자리만 신청할 수 있어요');
  }

  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const updated = await Meetup.findOneAndUpdate(
    {
      _id: doc._id,
      status: 'open',
      host: { $ne: userObjectId },
      'members.user': { $ne: userObjectId },
      $expr: notFullExpr,
    },
    { $push: { members: { user: userObjectId, joinType, status: 'pending', appliedAt: now } } },
    { new: true }
  );
  // 위에서 확인한 사이에 다른 요청이 먼저 바꾼 경우
  if (!updated) throw httpError(409, '신청하지 못했어요. 새로고침 후 다시 시도해 주세요');

  return { status: 'pending', joinType };
}

/** 신청 승인 — 호스트만. 승인된 인원이 정원보다 적을 때만 */
async function approveMember(id, hostId, memberUserId) {
  const doc = await findDoc(id);
  if (!idEq(doc.host, hostId)) throw httpError(403, '호스트만 승인할 수 있어요');
  if (doc.status === 'cancelled') throw httpError(400, '취소된 모임이에요');
  if (!mongoose.isValidObjectId(memberUserId)) throw httpError(404, '신청자를 찾을 수 없습니다');

  const member = (doc.members || []).find((m) => idEq(m.user, memberUserId));
  if (!member) throw httpError(404, '신청자를 찾을 수 없습니다');
  if (member.status === 'approved') throw httpError(409, '이미 승인한 신청이에요');
  if (approvedCountOf(doc) >= doc.capacity) throw httpError(400, '정원이 다 찼어요');

  const memberObjectId = new mongoose.Types.ObjectId(String(memberUserId));
  const updated = await Meetup.findOneAndUpdate(
    {
      _id: doc._id,
      host: doc.host,
      members: { $elemMatch: { user: memberObjectId, status: 'pending' } },
      $expr: notFullExpr,
    },
    { $set: { 'members.$.status': 'approved', 'members.$.approvedAt': new Date() } },
    { new: true }
  );
  if (!updated) throw httpError(409, '승인하지 못했어요. 새로고침 후 다시 시도해 주세요');

  await sideEffect('참여자 들이기', () => chatService.addMeetupMember(updated.toObject(), memberUserId));
  return getMeetup(doc._id, hostId);
}

module.exports = { listMeetups, getMeetup, createMeetup, updateMeetup, setMeetupStatus, applyMeetup, approveMember };
