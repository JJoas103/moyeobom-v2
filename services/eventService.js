const mongoose = require('mongoose');
const Event = require('../models/Event');
const Meetup = require('../models/Meetup');

// 행사 조회 — 응답 모양은 frontend/src/data/events.js 맨 위 주석 그대로
//   event = Event 스키마 필드 + meetupCount(이 행사로 열린 모임 수) + openMeetupCount(지금 모집 중)

const DAY = 24 * 60 * 60 * 1000;
const KST = 9 * 60 * 60 * 1000;

// 최근 끝난 행사로 모임을 열 수 있는 기간 — 미결정이라 임시 14일 (frontend data/events.js RECENT_ENDED_DAYS 와 같이)
const RECENT_ENDED_DAYS = 14;

// ---------- 기간 필터 — frontend/src/utils/period.js 와 같은 규칙, 서울 시간 기준 ----------

// 서울 날짜 기준 하루의 시작 (UTC Date). offsetDays 만큼 옮긴 날
function kstStartOfDay(now, offsetDays = 0) {
  const k = new Date(now.getTime() + KST);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + offsetDays) - KST);
}
const endOf = (dayStart) => new Date(dayStart.getTime() + DAY - 1);

/** 주는 월요일 시작 · 일요일 끝 */
function periodRange(key, now = new Date()) {
  const today = kstStartOfDay(now);
  const dow = (new Date(now.getTime() + KST).getUTCDay() + 6) % 7; // 월=0 … 일=6
  switch (key) {
    case 'today':
      return [today, endOf(today)];
    case 'week':
      return [today, endOf(kstStartOfDay(now, 6 - dow))];
    case 'weekend':
      return [dow === 6 ? today : kstStartOfDay(now, 5 - dow), endOf(kstStartOfDay(now, 6 - dow))];
    case 'month': {
      const k = new Date(now.getTime() + KST);
      const lastDay = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 0) - KST);
      return [today, endOf(lastDay)];
    }
    default:
      return null;
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v) => DAY_RE.test(v) && !Number.isNaN(new Date(`${v}T00:00:00+09:00`).getTime());

/** from · to('YYYY-MM-DD') 쿼리가 맞는지 — 둘 다 없거나, 둘 다 있고 순서가 맞아야 함 */
const isValidDayRange = (from, to) => (!from && !to) || (isDay(from) && isDay(to) && from <= to);

/** 달력에서 고른 날짜 → 서울 시간 [시작, 끝]. 없으면 null */
const dayRange = (from, to) => (from && to ? [new Date(`${from}T00:00:00+09:00`), new Date(`${to}T23:59:59.999+09:00`)] : null);

// ---------- 모임 수 ----------

// 행사별 모임 수 · 모집 중 모임 수 (모집 중 = open + 승인 인원 < 정원)
//
// 행사마다 $lookup 서브쿼리를 돌리지 않고 모임 쪽에서 한 번에 모아 Map 으로 붙인다.
// 모임이 행사보다 훨씬 적고(행사 수천 : 모임 수십), 무엇보다 이래야 목록에서 $limit 을
// 정렬 바로 뒤에 둘 수 있다 — 전량에 $lookup 을 걸면 3분, 페이지만 세면 100ms 대다.
// 추천(listEventsForRanking)도 같은 이유로 이걸 쓴다.
const approvedSize = {
  $size: { $filter: { input: { $ifNull: ['$members', []] }, cond: { $eq: ['$$this.status', 'approved'] } } },
};

/** 행사 id → { meetupCount, openMeetupCount }. eventIds 를 주면 그 행사들만, 없으면 전부 */
async function meetupStats(eventIds) {
  const match = { status: { $ne: 'cancelled' } }; // 취소된 모임은 세지 않음
  if (eventIds) {
    if (eventIds.length === 0) return new Map();
    match.event = { $in: eventIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  }

  const rows = await Meetup.aggregate([
    { $match: match },
    { $project: { event: 1, status: 1, capacity: 1, approved: approvedSize } },
    {
      $group: {
        _id: '$event',
        meetupCount: { $sum: 1 },
        openMeetupCount: {
          $sum: { $cond: [{ $and: [{ $eq: ['$status', 'open'] }, { $lt: ['$approved', '$capacity'] }] }, 1, 0] },
        },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), { meetupCount: r.meetupCount, openMeetupCount: r.openMeetupCount }]));
}

const withCounts = (event, stats) => ({
  ...event,
  meetupCount: stats.get(String(event._id))?.meetupCount || 0,
  openMeetupCount: stats.get(String(event._id))?.openMeetupCount || 0,
});

// endDate 가 없는 행사(영화)는 '곧 끝나는 순'에서 맨 뒤로
const FAR_FUTURE = new Date('9999-12-31');

// 목록 카드에 필요한 필드만 — frontend components/event/EventCard.jsx · meetup/EventPickRow.jsx 기준
// (description 같은 큰 필드를 함께 내려주면 수천 건에서 수 MB 가 된다. 상세에서만 내려준다)
const LIST_FIELDS = {
  title: 1, subtitle: 1, category: 1, genre: 1, runType: 1, posterUrl: 1,
  venue: 1, area: 1, district: 1, startDate: 1, endDate: 1, sessionsText: 1, runningTime: 1,
};

const LIST_LIMIT = 15; // 프론트 data/events.js PAGE_SIZE 와 같게
const LIST_LIMIT_MAX = 50;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 행사 목록 — 한 페이지씩. 응답 모양은 frontend/src/data/events.js 맨 위 주석 기준
 * @param {{ category?, genre?, district?, period?, from?, to?, q?, hasMeetup?: boolean, includeEnded?: boolean,
 *           sort?: 'meetups'|'endingSoon', page?: number, limit?: number }} params
 *   from · to 가 있으면 period 대신 그 날짜 범위
 * @returns {{ events, total, genres }} genres = 이 조건에서 나오는 분야 전부 (화면 선택지용)
 */
async function listEvents({
  category, genre, district, period, from: fromDay, to: toDay, q,
  hasMeetup, includeEnded, sort = 'endingSoon', page = 1, limit = LIST_LIMIT,
} = {}) {
  const now = new Date();
  const and = [];

  if (!includeEnded) and.push({ $or: [{ endDate: null }, { endDate: { $gte: now } }] });
  if (category) and.push({ category });
  if (district) and.push({ district });
  // genre 는 and 에 넣지 않는다 — 분야 선택지(genres)는 분야를 고르기 전 기준으로 뽑아야
  // 고른 분야만 남지 않는다. 목록 · 전체 수에만 genreMatch 로 따로 적용한다

  const range = dayRange(fromDay, toDay) || periodRange(period, now);
  if (range) {
    const [from, to] = range;
    and.push({ startDate: { $lte: to } }, { $or: [{ endDate: null }, { endDate: { $gte: from } }] });
  }

  const keyword = q?.trim();
  if (keyword) and.push({ title: { $regex: escapeRegex(keyword), $options: 'i' } });

  // '모임 있는 행사만' · 모임 수 정렬은 모임 있는 행사 id 로 처리한다 ($lookup 없이 — 모임은 적다)
  const needMeetupIds = Boolean(hasMeetup) || sort === 'meetups';
  const allStats = needMeetupIds ? await meetupStats() : null;
  const idsWithMeetups = allStats ? [...allStats.keys()].map((id) => new mongoose.Types.ObjectId(id)) : [];
  if (hasMeetup) and.push({ _id: { $in: idsWithMeetups } });

  const size = Math.min(Math.max(Number(limit) || LIST_LIMIT, 1), LIST_LIMIT_MAX);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * size;

  const addFields = { _endSort: { $ifNull: ['$endDate', FAR_FUTURE] } };
  // 모임 수 정렬 = 모임 있는 행사 먼저, 같으면 곧 끝나는 순.
  // 정확한 '개수 많은 순'은 Event 에 모임 수를 비정규화해야 가능하다 (CLAUDE.md 미결정)
  if (sort === 'meetups') addFields._noMeetup = { $cond: [{ $in: ['$_id', idsWithMeetups] }, 0, 1] };

  const sortStage = sort === 'meetups' ? { _noMeetup: 1, _endSort: 1, _id: 1 } : { _endSort: 1, startDate: 1, _id: 1 };
  const genreMatch = genre ? [{ $match: { genre } }] : [];

  const [out] = await Event.aggregate([
    { $match: and.length ? { $and: and } : {} },
    { $addFields: addFields },
    {
      $facet: {
        // 정렬 → 자르기 → 필요한 필드만. 모임 수는 이 페이지 분량에만 아래에서 붙인다
        rows: [...genreMatch, { $sort: sortStage }, { $skip: skip }, { $limit: size }, { $project: LIST_FIELDS }],
        total: [...genreMatch, { $count: 'n' }],
        genres: [{ $group: { _id: '$genre' } }, { $sort: { _id: 1 } }], // 분야 조건 전 기준
      },
    },
  ]);

  const stats = allStats || (await meetupStats(out.rows.map((e) => e._id)));
  return {
    events: out.rows.map((e) => withCounts(e, stats)),
    total: out.total[0]?.n || 0,
    genres: out.genres.map((g) => g._id).filter(Boolean),
  };
}

/**
 * 추천 순위 계산용 안 끝난 행사 — 비교에 쓰는 필드만 받아 전송량을 줄임
 * 모임 수는 $lookup 대신 meetupStats 로 붙인다 (전량 $lookup 이 추천홈을 몇 분씩 멈추게 했다)
 */
async function listEventsForRanking() {
  const now = new Date();
  const events = await Event.aggregate([
    { $match: { $or: [{ endDate: null }, { endDate: { $gte: now } }] } },
    { $project: { category: 1, district: 1, endDate: 1 } },
  ]);
  const stats = await meetupStats();
  return events.map((e) => withCounts(e, stats));
}

/** 최근 끝난 행사 — 끝난 지 RECENT_ENDED_DAYS 일 안. 최근에 끝난 순 (14일 창이라 건수가 적어 전부 내려준다) */
async function listRecentEndedEvents() {
  const now = new Date();
  const events = await Event.find(
    { endDate: { $lt: now, $gte: new Date(now.getTime() - RECENT_ENDED_DAYS * DAY) } },
    LIST_FIELDS
  )
    .sort({ endDate: -1, _id: 1 })
    .lean();

  const stats = await meetupStats(events.map((e) => e._id));
  return events.map((e) => withCounts(e, stats));
}

/**
 * _id 목록의 행사 — 넘긴 순서대로, 끝난 행사 포함 (찜 목록)
 *
 * ⚠ 모임 수는 **$lookup 이 아니라 meetupStats() 로 붙인다.** 이 파일의 다른 조회 함수들과 같다.
 *   행사 전량에 $lookup 을 걸면 추천홈이 몇 분씩 멈춰서 2026-11-04 에 걷어낸 방식이고,
 *   그때 `meetupCountStages` 를 아예 지웠다 (아래 '행사 목록은 한 페이지씩' 결정 — CLAUDE.md).
 *   찜 기능이 올라올 때 그 헬퍼를 쓰고 있어서 병합하면 ReferenceError 가 났다. 되돌리지 말 것.
 */
async function listEventsByIds(ids) {
  if (!ids.length) return [];
  const events = await Event.find({ _id: { $in: ids } }, LIST_FIELDS).lean();
  const stats = await meetupStats(ids);
  const byId = new Map(events.map((e) => [String(e._id), withCounts(e, stats)]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean); // 넘긴 순서 유지
}

/** 행사 하나. 없으면 404 */
async function getEvent(id) {
  const notFound = Object.assign(new Error('행사를 찾을 수 없습니다'), { status: 404 });
  if (!mongoose.isValidObjectId(id)) throw notFound;

  const event = await Event.findById(id, { __v: 0 }).lean();
  if (!event) throw notFound;

  const stats = await meetupStats([event._id]);
  // recommendReasons 는 컨트롤러가 보는 사람 기준으로 채움 (services/recommendService.js)
  return { ...withCounts(event, stats), recommendReasons: null };
}

module.exports = { listEvents, listEventsForRanking, listRecentEndedEvents, listEventsByIds, getEvent, periodRange, dayRange, isValidDayRange, RECENT_ENDED_DAYS };
