const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Meetup = require('../models/Meetup');
const Event = require('../models/Event');
const User = require('../models/User');
const Review = require('../models/Review');
const Friendship = require('../models/Friendship');
const { BUDGETS } = require('../models/Meetup');
const { periodRange, dayRange, recentEndedFrom } = require('./eventService');
const chatService = require('./chatService');
const mannerService = require('./mannerService');
const notificationService = require('./notificationService');
const { publicUser, PUBLIC_USER_FIELDS } = require('./publicUser');
const { sideEffect } = require('./sideEffect');
const { reviewWindow, watchApplyOpen } = require('./socialRules');

// 모임 — 응답 모양은 frontend/src/data/meetups.js 맨 위 주석 기준
// members · talk.place · talk.address · talk.location 은 호스트 · 승인된 참여자 전용

const TIMELINE_TITLE_MAX = 30; // 타임라인 줄 제목
const TIMELINE_ROWS_MAX = 5; // 호스트가 쓰는 줄 (첫 줄 제외)
const TIMELINE_HOURS = 12; // 이야기 자리 시작에서 이 시간 안의 줄만
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

/** 이 행사로 지금 모임을 열 수 있는지 — 끝난 지 RECENT_ENDED_DAYS 일(날짜)까지 (프론트 utils/event.js canOpenMeetup 과 같게) */
const canOpenMeetup = (event, now) => !event.endDate || new Date(event.endDate) >= recentEndedFrom(now);

// ---------- 응답 만들기 ----------

/**
 * 모임 문서 → API 응답
 * @param ctx { events: Map, users: Map, hostedCounts: Map, viewerId, withMembers }
 */
function serialize(doc, { events, users, hostedCounts, viewerId, withMembers = false }) {
  const isHost = idEq(doc.host, viewerId);
  const mine = (doc.members || []).find((m) => idEq(m.user, viewerId));
  const approved = mine?.status === 'approved';
  const canSeePrivate = isHost || approved;

  // approvedEver 는 내려주지 않는다 (서버 판정용) — 호스트에게만 아래 hadMembers 로 알린다
  const { members = [], talk, host, event, __v, approvedEver = 0, ...rest } = doc;
  const response = {
    ...rest,
    talk: {
      startAt: talk.startAt,
      area: talk.area,
      startTitle: talk.startTitle,
      ...(canSeePrivate && { place: talk.place, address: talk.address, location: talk.location }),
    },
    event: pick(events.get(String(event)), EVENT_FIELDS),
    host: users.get(String(host)) ? { ...publicUser(users.get(String(host))), hostedCount: hostedCounts.get(String(host)) || 0 } : null,
    approvedCount: approvedCountOf(doc),
    // 승인한 적 있는지 — **호스트에게만.** 취소 팝업이 감점(-5)을 미리 알리는 데 쓴다.
    // 전원 내보낸 뒤에도 true 라서 approvedCount 와 다를 수 있다 (그게 이 값을 두는 이유다)
    ...(isHost && { hadMembers: approvedEver > 0 }),
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
    User.find({ _id: { $in: userIds } }, PUBLIC_USER_FIELDS).lean(), // manner 포함 — publicUser 와 짝
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
 * @param params { eventId, category, district, period, from, to, joinType, alcohol, budget, q, openOnly, includePast }
 *   from · to 가 있으면 period 대신 그 날짜 범위
 */
async function listMeetups(params, viewerId) {
  const { eventId, category, district, period, from, to, joinType, alcohol, budget, q, openOnly, includePast } = params;
  const now = new Date();
  const and = [{ status: { $ne: 'cancelled' } }]; // 취소된 모임은 목록에서 제외

  if (!includePast) and.push({ 'talk.startAt': { $gte: now } });
  if (eventId) {
    if (!mongoose.isValidObjectId(eventId)) return [];
    and.push({ event: new mongoose.Types.ObjectId(eventId) });
  }
  const range = dayRange(from, to) || periodRange(period, now);
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

/**
 * 내 모임 — 내가 연 모임 · 참여한 모임(신청 중 포함). 취소된 모임도 포함 (카드에 '취소된 모임')
 * 순서: 다가오는 모임 가까운 순 → 지난 모임 최근 순
 */
async function listMyMeetups(userId) {
  const me = new mongoose.Types.ObjectId(String(userId));
  const [docs, friendCount] = await Promise.all([
    Meetup.find({ $or: [{ host: me }, { 'members.user': me }] }).lean(),
    Friendship.countDocuments({ $or: [{ userA: me }, { userB: me }] }),
  ]);
  const now = Date.now();
  const time = (d) => new Date(d.talk.startAt).getTime();
  docs.sort((a, b) => {
    const pastA = time(a) <= now;
    const pastB = time(b) <= now;
    if (pastA !== pastB) return pastA ? 1 : -1;
    return pastA ? time(b) - time(a) : time(a) - time(b);
  });
  const meetups = await serializeMany(docs, userId);
  return {
    hosted: meetups.filter((m) => m.isHost),
    joined: meetups.filter((m) => !m.isHost),
    friendCount,
  };
}

/** _id 목록의 모임 — 넘긴 순서대로, 취소된 모임 제외 (찜 목록) */
async function listMeetupsByIds(ids, viewerId) {
  const docs = await Meetup.find({ _id: { $in: ids }, status: { $ne: 'cancelled' } }).lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return serializeMany(ids.map((id) => byId.get(String(id))).filter(Boolean), viewerId);
}

/** 모임 하나 — 보는 사람에 따라 talk.place · members 포함. 확정 참여자면 내 평가 제출 여부도 */
async function getMeetup(id, viewerId) {
  const doc = await findDoc(id);
  const [meetup] = await serializeMany([doc], viewerId, { withMembers: true });
  if (meetup.isHost || meetup.myMembership?.status === 'approved') {
    meetup.review.submitted = Boolean(await Review.exists({ meetup: doc._id, reviewer: viewerId }));
  }
  if (meetup.myMembership?.status === 'approved') {
    meetup.canReportHost = await chatService.canReportInMeetupRoom(doc._id, viewerId);
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
  const address = text(talk.address);
  const area = text(talk.area);
  if (!place) e.place = '만날 장소를 적어 주세요.';
  if (!area) e.area = '목록에 보일 동네를 적어 주세요.';
  const lat = Number(talk.location?.lat);
  const lng = Number(talk.location?.lng);
  const location = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;

  // 타임라인 — 이야기 자리 시작 뒤 TIMELINE_HOURS 안, 줄마다 할 일 필수 (프론트 MeetupForm validate 와 같게)
  const rows = Array.isArray(body.timeline) ? body.timeline : [];
  const timeline = rows.map((r) => ({ at: toDate(r?.at), title: text(r?.title) }));
  if (timeline.length > TIMELINE_ROWS_MAX) e.timeline = `타임라인은 ${TIMELINE_ROWS_MAX}줄까지 쓸 수 있어요.`;
  else if (startAt) {
    const limit = startAt.getTime() + TIMELINE_HOURS * 60 * 60 * 1000;
    const bad = timeline.findIndex((r) => !r.title || r.title.length > TIMELINE_TITLE_MAX || !r.at || r.at <= startAt || r.at > limit);
    if (bad >= 0) {
      const r = timeline[bad];
      e.timeline = !r.title
        ? `${bad + 1}번째 줄에 할 일을 적어 주세요.`
        : r.title.length > TIMELINE_TITLE_MAX
          ? `${bad + 1}번째 줄을 ${TIMELINE_TITLE_MAX}자 안으로 줄여 주세요.`
          : `${bad + 1}번째 줄은 이야기 자리 시작 뒤 ${TIMELINE_HOURS}시간 안으로 골라 주세요.`;
    }
  }
  timeline.sort((a, b) => a.at - b.at);

  if (!BUDGETS.includes(body.budget)) e.budget = '예산을 골라 주세요.';
  const capacity = Number(body.capacity);
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10) e.capacity = '정원은 2~10명으로 골라 주세요.';

  // 관람도 함께 — 받을지 말지만 (회차는 승인 뒤 채팅에서). 수정하면 옛 sessionAt · meetAt · meetPlace 도 지워진다
  const watch = { enabled: false };
  if (body.watch?.enabled) {
    if (event.endDate && new Date(event.endDate) < now) e.watch = '이미 끝난 행사라 이야기 자리만 열 수 있어요.';
    watch.enabled = true;
  }

  if (Object.keys(e).length) throw fieldError(e);

  return {
    event: event._id,
    title,
    intro,
    imageUrl,
    talk: { startAt, place, address: address || undefined, location, area },
    timeline,
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

  const { title, intro, imageUrl, talk, timeline, alcohol, budget, capacity, watch } = buildMeetup(body, event, now);
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
    { $set: { title, intro, imageUrl, talk, timeline, alcohol, budget, capacity, watch } },
    { new: true }
  );
  if (!updated) throw httpError(409, '수정하지 못했어요. 새로고침 후 다시 시도해 주세요');

  removeOldImage(doc.imageUrl, imageUrl);
  await sideEffect('닫히는 시각 맞추기', () => chatService.syncMeetupRoom(updated.toObject()));
  await sideEffect('수정 알림', () => notificationService.meetupUpdated(updated.toObject()));
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
  if (status === 'cancelled') {
    await sideEffect('방 닫기', () => chatService.closeMeetupRoom(doc._id));
    await sideEffect('취소 알림', () => notificationService.meetupCancelled(doc));
    // 승인한 적 있는 모임을 엎었을 때만 감점 — 지금 인원이 아니라 approvedEver 로 본다
    // (지금 인원으로 보면 전원 내보낸 뒤 취소해 -5 를 피할 수 있다)
    if ((doc.approvedEver || 0) > 0) await sideEffect('취소 감점', () => mannerService.hostCancelled(hostId, doc));
  }
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
    if (!watchApplyOpen(doc.talk.startAt, now)) throw httpError(400, '관람 동행 신청은 전날까지예요. 이야기 자리만 신청할 수 있어요');
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

  // 신청 · 승인으로는 점수가 움직이지 않는다
  await sideEffect('신청 알림', () => notificationService.meetupApplied(doc, userId));
  return { status: 'pending', joinType };
}

/** 신청 승인 — 호스트만. 승인된 인원이 정원보다 적을 때만 */
async function approveMember(id, hostId, memberUserId) {
  const doc = await findDoc(id);
  if (!idEq(doc.host, hostId)) throw httpError(403, '호스트만 승인할 수 있어요');
  if (doc.status === 'cancelled') throw httpError(400, '취소된 모임이에요');
  if (new Date(doc.talk.startAt) <= new Date()) throw httpError(400, '이미 시작한 모임이에요');
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
    // approvedEver 는 같은 수정 문서에서 올린다 — 쿼리를 따로 두면 동시 승인 두 건이 카운터를 흘린다
    { $set: { 'members.$.status': 'approved', 'members.$.approvedAt': new Date() }, $inc: { approvedEver: 1 } },
    { new: true }
  );
  if (!updated) throw httpError(409, '승인하지 못했어요. 새로고침 후 다시 시도해 주세요');

  await sideEffect('참여자 들이기', () => chatService.addMeetupMember(updated.toObject(), memberUserId));
  await sideEffect('승인 알림', () => notificationService.meetupApproved(doc, memberUserId));
  // 승인에는 점수 변동이 없다 — 참석을 확인할 수 없어 참여 가점은 두지 않는다
  return getMeetup(doc._id, hostId);
}

/**
 * 호스트가 members 에서 빼기 — 호스트만, 이야기 자리 시작 전까지. status 가 그대로일 때만 뺌
 * 기록을 남기지 않으므로 다시 신청할 수 있고, 상대에게 따로 알리지 않음
 */
async function dismissMember(id, hostId, memberUserId, status) {
  const doc = await findDoc(id);
  if (!idEq(doc.host, hostId)) throw httpError(403, '호스트만 할 수 있어요');
  if (doc.status === 'cancelled') throw httpError(400, '취소된 모임이에요');
  if (new Date(doc.talk.startAt) <= new Date()) throw httpError(400, '이미 시작한 모임이에요');
  if (!mongoose.isValidObjectId(memberUserId)) throw httpError(404, '신청자를 찾을 수 없습니다');

  const memberObjectId = new mongoose.Types.ObjectId(String(memberUserId));
  const updated = await Meetup.findOneAndUpdate(
    { _id: doc._id, host: doc.host, members: { $elemMatch: { user: memberObjectId, status } } },
    { $pull: { members: { user: memberObjectId } } },
    { new: true }
  );
  if (!updated) throw httpError(409, '처리하지 못했어요. 새로고침 후 다시 시도해 주세요');

  if (status === 'approved') await sideEffect('참여자 내보내기', () => chatService.removeMeetupMember(doc._id, memberUserId));
  return getMeetup(doc._id, hostId);
}

/** 신청 거절 — 승인 전 신청만 */
const rejectMember = (id, hostId, memberUserId) => dismissMember(id, hostId, memberUserId, 'pending');

/** 내보내기 — 승인된 참여자만. 모임 채팅방에서도 빠짐 ('○○님이 나갔어요') */
const removeMember = (id, hostId, memberUserId) => dismissMember(id, hostId, memberUserId, 'approved');

/** 신고 — 호스트가 승인된 참여자를. 상대에게 알리지 않음 */
async function reportMember(id, hostId, memberUserId, content) {
  const doc = await findDoc(id);
  if (!idEq(doc.host, hostId)) throw httpError(403, '호스트만 할 수 있어요');
  const member = (doc.members || []).find((m) => idEq(m.user, memberUserId));
  if (member?.status !== 'approved') throw httpError(404, '신고할 사람을 찾을 수 없습니다');
  await chatService.reportMeetupMember(doc._id, hostId, memberUserId, content);
}

/** 모임 신고 — 확정 참여자가 모임 상세에서. 신고 대상은 호스트, 상대에게 알리지 않음 */
async function reportHost(id, userId, content) {
  const doc = await findDoc(id);
  const mine = (doc.members || []).find((m) => idEq(m.user, userId));
  if (mine?.status !== 'approved') throw httpError(403, '확정된 참여자만 신고할 수 있어요');
  await chatService.reportMeetupMember(doc._id, userId, doc.host, content);
}

/**
 * 참여 취소 — 신청 중 · 승인 모두 이야기 자리 시작 전까지. members 에서 빼므로 다시 신청할 수 있음
 * 승인된 참여자였으면 모임 채팅방에서도 빠짐 ('○○님이 나갔어요')
 */
async function leaveMeetup(id, userId) {
  const doc = await findDoc(id);
  const member = (doc.members || []).find((m) => idEq(m.user, userId));
  if (!member) throw httpError(404, '신청한 모임이 아니에요');
  if (doc.status === 'cancelled') throw httpError(400, '취소된 모임이에요');
  if (new Date(doc.talk.startAt) <= new Date()) throw httpError(400, '이미 시작한 모임이에요');

  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  await Meetup.updateOne({ _id: doc._id }, { $pull: { members: { user: userObjectId } } });
  if (member.status === 'approved') {
    await sideEffect('참여자 내보내기', () => chatService.removeMeetupMember(doc._id, userId));
    // 확정됐던 자리를 비운 것만 감점 — 신청 중 취소는 변동 0 (아무 자리도 비우지 않았다).
    // members 에서 $pull 로 지워지므로 이 순간에 기록해야 한다
    await sideEffect('취소 감점', () => mannerService.left(userId, doc));
  }
  await sideEffect('취소 알림', () => notificationService.meetupLeft(doc, userId));
  return getMeetup(doc._id, userId);
}

module.exports = { listMeetups, listMyMeetups, listMeetupsByIds, getMeetup, createMeetup, updateMeetup, setMeetupStatus, applyMeetup, approveMember, rejectMember, removeMember, reportMember, reportHost, leaveMeetup };
