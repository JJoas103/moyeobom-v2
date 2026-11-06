const mongoose = require('mongoose');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const User = require('../models/User');
const friendService = require('./friendService');
const mannerService = require('./mannerService');
const { sideEffect } = require('./sideEffect');
const { reviewWindow } = require('./socialRules');
const { summarizeMeetups } = require('./meetupSummary');

// 모임 평가 — 응답 모양은 frontend/src/data/reviews.js 맨 위 주석 기준
//   열림: 이야기 자리 다음날 12:00 · 마감: 열림 + 48시간 (socialRules.reviewWindow)
//   대상: 같은 모임의 확정 참여자(호스트 포함, 본인 제외)
//   제출은 한 번 — 매너 평가(좋았어요 / 보통이에요 / 아쉬웠어요) · 또 만나고 싶어요(비공개)
//   '보통이에요'는 저장하지 않는다 — 대상에서 praised · disappointed 를 뺀 나머지다

const httpError = (status, message) => Object.assign(new Error(message), { status });
const idEq = (a, b) => Boolean(a && b) && String(a) === String(b);
// 평가 화면에는 매너 점수를 싣지 않는다 — 점수를 보고 칭찬을 고르면 평가가 점수를 따라간다.
// 그래서 services/publicUser.js(점수 포함)를 쓰지 않고 이 로컬 모양을 유지한다
const publicUser = (user) => (user ? { _id: String(user._id), nickname: user.nickname, profileImage: user.profileImage || '' } : null);

const participantsOf = (meetup) => [
  meetup.host,
  ...(meetup.members || []).filter((m) => m.status === 'approved').map((m) => m.user),
];

/** 'before' | 'open' | 'closed' */
function reviewState(meetup, now = new Date()) {
  const { opensAt, closesAt } = reviewWindow(meetup.talk.startAt);
  return { opensAt, closesAt, state: now < opensAt ? 'before' : now < closesAt ? 'open' : 'closed' };
}

async function loadForReviewer(meetupId, me) {
  if (!mongoose.isValidObjectId(meetupId)) throw httpError(404, '모임을 찾을 수 없습니다');
  const meetup = await Meetup.findById(meetupId).lean();
  if (!meetup) throw httpError(404, '모임을 찾을 수 없습니다');
  if (meetup.status === 'cancelled') throw httpError(400, '취소된 모임은 평가하지 않아요');
  const participants = participantsOf(meetup);
  if (!participants.some((u) => idEq(u, me))) throw httpError(403, '함께한 참여자만 평가할 수 있어요');
  return { meetup, targetIds: participants.filter((u) => !idEq(u, me)).map(String) };
}

/** 평가 화면 — 모임 요약 · 기한 · 대상 · 내가 낸 평가 */
async function getReview(meetupId, me) {
  const { meetup, targetIds } = await loadForReviewer(meetupId, me);
  const [users, summaries, mine] = await Promise.all([
    User.find({ _id: { $in: targetIds } }, { nickname: 1, profileImage: 1 }).lean(),
    summarizeMeetups([meetup._id]),
    Review.findOne({ meetup: meetup._id, reviewer: me }).lean(),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return {
    meetup: summaries.get(String(meetup._id)),
    ...reviewState(meetup),
    targets: targetIds
      .filter((id) => userMap.has(id)) // 탈퇴한 사람 제외
      .map((id) => ({ user: publicUser(userMap.get(id)), isHost: idEq(meetup.host, id) })),
    submitted: mine
      ? {
          praisedCount: mine.praised.length,
          disappointedCount: (mine.disappointed || []).length, // 이전 평가 문서에는 없는 필드다
          againCount: mine.again.length,
        }
      : null,
  };
}

/** 평가 보내기 — 서로 '또 만나고 싶어요'면 그 자리에서 친구 + 1:1 방 */
async function submitReview(meetupId, me, body) {
  const { meetup, targetIds } = await loadForReviewer(meetupId, me);
  const { state } = reviewState(meetup);
  if (state === 'before') throw httpError(400, '아직 평가가 열리지 않았어요');
  if (state === 'closed') throw httpError(400, '평가가 마감됐어요');

  // 대상 안에 있는 사람만 (중복 제거)
  const pickTargets = (list) => [...new Set((Array.isArray(list) ? list : []).map(String))].filter((id) => targetIds.includes(id));
  const praised = pickTargets(body?.praised);
  const disappointed = pickTargets(body?.disappointed);

  // 한 사람에게 좋았어요와 아쉬웠어요를 동시에 줄 수는 없다. 화면은 라디오라 불가능하지만 여기서 막는다
  if (praised.some((id) => disappointed.includes(id))) {
    throw httpError(400, '한 사람에게는 하나만 고를 수 있어요');
  }
  // 아쉬웠다고 한 사람과 친구가 될 수는 없다 — 화면에서도 2단계에서 빼지만 서버가 기준이다
  const again = pickTargets(body?.again).filter((id) => !disappointed.includes(id));

  try {
    await Review.create({ meetup: meetup._id, reviewer: me, praised, disappointed, again });
  } catch (err) {
    if (err.code === 11000) throw httpError(409, '이미 평가를 보냈어요');
    throw err;
  }

  // 평가를 보냈다 +1 — 내가 누른 일이라 설명이 필요 없다.
  // 받은 매너 평가(좋았어요 +1/건 · 아쉬웠어요 -1/건) · 개설 가점 · 미제출 감점은
  // 평가 마감에 cron 이 한꺼번에 반영한다 (schedulers/reviewDaily.js → mannerService.applyReviewClosed)
  await sideEffect('제출 가점', () => mannerService.reviewSubmitted(me, meetup));

  // 상대도 나를 골랐는지
  if (again.length) {
    const mutual = await Review.find({ meetup: meetup._id, reviewer: { $in: again }, again: me }, { reviewer: 1 }).lean();
    for (const { reviewer } of mutual) await friendService.makeFriends(meetup._id, me, reviewer);
  }
  return { praisedCount: praised.length, disappointedCount: disappointed.length, againCount: again.length };
}

module.exports = { reviewState, getReview, submitReview };
