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
const meetupCountStages = [
  {
    $lookup: {
      from: Meetup.collection.name,
      let: { eventId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$event', '$$eventId'] }, status: { $ne: 'cancelled' } } }, // 취소된 모임은 세지 않음
        {
          $project: {
            status: 1,
            capacity: 1,
            approved: {
              $size: {
                $filter: { input: { $ifNull: ['$members', []] }, cond: { $eq: ['$$this.status', 'approved'] } },
              },
            },
          },
        },
      ],
      as: 'meetups',
    },
  },
  {
    $addFields: {
      meetupCount: { $size: '$meetups' },
      openMeetupCount: {
        $size: {
          $filter: {
            input: '$meetups',
            cond: { $and: [{ $eq: ['$$this.status', 'open'] }, { $lt: ['$$this.approved', '$$this.capacity'] }] },
          },
        },
      },
    },
  },
  { $project: { meetups: 0, __v: 0 } },
];

// endDate 가 없는 행사(영화)는 '곧 끝나는 순'에서 맨 뒤로
const endDateSortStages = [
  { $addFields: { _endSort: { $ifNull: ['$endDate', new Date('9999-12-31')] } } },
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 행사 목록
 * @param {{ category?, genre?, district?, period?, from?, to?, q?, hasMeetup?: boolean, includeEnded?: boolean, sort?: 'meetups'|'endingSoon' }} params
 *   from · to 가 있으면 period 대신 그 날짜 범위
 */
async function listEvents({ category, genre, district, period, from: fromDay, to: toDay, q, hasMeetup, includeEnded, sort = 'meetups' } = {}) {
  const now = new Date();
  const and = [];

  if (!includeEnded) and.push({ $or: [{ endDate: null }, { endDate: { $gte: now } }] });
  if (category) and.push({ category });
  if (genre) and.push({ genre });
  if (district) and.push({ district });

  const range = dayRange(fromDay, toDay) || periodRange(period, now);
  if (range) {
    const [from, to] = range;
    and.push({ startDate: { $lte: to } }, { $or: [{ endDate: null }, { endDate: { $gte: from } }] });
  }

  const keyword = q?.trim();
  if (keyword) and.push({ title: { $regex: escapeRegex(keyword), $options: 'i' } });

  const sortStage =
    sort === 'endingSoon'
      ? { _endSort: 1, startDate: 1, _id: 1 }
      : { meetupCount: -1, _endSort: 1, _id: 1 }; // 모임 수가 같으면 곧 끝나는 순

  return Event.aggregate([
    { $match: and.length ? { $and: and } : {} },
    ...meetupCountStages,
    ...(hasMeetup ? [{ $match: { meetupCount: { $gt: 0 } } }] : []),
    ...endDateSortStages,
    { $sort: sortStage },
    { $project: { _endSort: 0 } },
  ]);
}

/** 추천 순위 계산용 안 끝난 행사 — 비교에 쓰는 필드만 받아 전송량을 줄임 */
async function listEventsForRanking() {
  const now = new Date();
  return Event.aggregate([
    { $match: { $or: [{ endDate: null }, { endDate: { $gte: now } }] } },
    { $project: { category: 1, district: 1, endDate: 1 } },
    ...meetupCountStages,
  ]);
}

/** 최근 끝난 행사 — 끝난 지 RECENT_ENDED_DAYS 일 안. 최근에 끝난 순 */
async function listRecentEndedEvents() {
  const now = new Date();
  return Event.aggregate([
    { $match: { endDate: { $lt: now, $gte: new Date(now.getTime() - RECENT_ENDED_DAYS * DAY) } } },
    ...meetupCountStages,
    { $sort: { endDate: -1, _id: 1 } },
  ]);
}

/** 행사 하나. 없으면 404 */
async function getEvent(id) {
  const notFound = Object.assign(new Error('행사를 찾을 수 없습니다'), { status: 404 });
  if (!mongoose.isValidObjectId(id)) throw notFound;

  const [event] = await Event.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(id) } }, ...meetupCountStages]);
  if (!event) throw notFound;

  // recommendReasons 는 컨트롤러가 보는 사람 기준으로 채움 (services/recommendService.js)
  return { ...event, recommendReasons: null };
}

module.exports = { listEvents, listEventsForRanking, listRecentEndedEvents, getEvent, periodRange, dayRange, isValidDayRange, RECENT_ENDED_DAYS };
