const mongoose = require('mongoose');
const Event = require('../models/Event');
const Meetup = require('../models/Meetup');
const { getEvent, listEventsForRanking } = require('./eventService');

// 추천 — 응답 모양은 frontend/src/data/events.js 맨 위 주석 기준
//   순위: 고른 취향 일치 → 관심 지역 일치 → 참여했던 모임과 같은 분류 → 모집 중인 모임 많은 순 → 곧 끝나는 순
//   이유: 실제로 맞은 조건만 { type: 'taste'|'district'|'history', value } — 라벨은 프론트

/** 내가 호스트였거나 승인됐던 지난 모임의 행사 분류 */
async function historyCategories(userId, now) {
  const me = new mongoose.Types.ObjectId(String(userId));
  const eventIds = await Meetup.distinct('event', {
    status: { $ne: 'cancelled' },
    'talk.startAt': { $lt: now },
    $or: [{ host: me }, { members: { $elemMatch: { user: me, status: 'approved' } } }],
  });
  return eventIds.length ? Event.distinct('category', { _id: { $in: eventIds } }) : [];
}

async function viewerContext(user, now = new Date()) {
  if (!user) return null;
  return {
    tastes: user.tastes || [],
    districts: user.districts || [],
    history: await historyCategories(user._id, now),
  };
}

function reasonsOf(event, context) {
  if (!context) return [];
  const reasons = [];
  if (context.tastes.includes(event.category)) reasons.push({ type: 'taste', value: event.category });
  if (event.district && context.districts.includes(event.district)) reasons.push({ type: 'district', value: event.district });
  if (context.history.includes(event.category)) reasons.push({ type: 'history', value: event.category });
  return reasons;
}

const has = (item, type) => (item.reasons.some((r) => r.type === type) ? 1 : 0);
const endTime = (event) => (event.endDate ? new Date(event.endDate).getTime() : Infinity); // 끝나는 날이 없는 행사(영화)는 뒤로

function compare(a, b) {
  return (
    has(b, 'taste') - has(a, 'taste') ||
    has(b, 'district') - has(a, 'district') ||
    has(b, 'history') - has(a, 'history') ||
    b.event.openMeetupCount - a.event.openMeetupCount ||
    (endTime(a.event) === endTime(b.event) ? 0 : endTime(a.event) - endTime(b.event)) ||
    String(a.event._id).localeCompare(String(b.event._id))
  );
}

/**
 * 홈 추천 행사 하나. 맞는 조건이 없거나 비로그인이면 모집 중인 모임이 많은 행사 → 곧 끝나는 행사
 * @returns {{ event: object|null, reasons: object[], basis: 'taste'|'popular' }}
 */
async function recommendEvent(user) {
  const [events, context] = await Promise.all([listEventsForRanking(), viewerContext(user)]);
  const [best] = events.map((event) => ({ event, reasons: reasonsOf(event, context) })).sort(compare);
  if (!best) return { event: null, reasons: [], basis: 'popular' };
  const event = await getEvent(best.event._id);
  return { event, reasons: best.reasons, basis: best.reasons.length > 0 ? 'taste' : 'popular' };
}

/** 행사 상세의 추천 이유 — 로그인 사용자 전용, 비로그인은 null */
async function reasonsForEvent(event, user) {
  const context = await viewerContext(user);
  return context ? reasonsOf(event, context) : null;
}

module.exports = { recommendEvent, reasonsForEvent };
