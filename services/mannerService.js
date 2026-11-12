const mongoose = require('mongoose');
const User = require('../models/User');
const MannerLog = require('../models/MannerLog');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const notificationService = require('./notificationService');
const { reviewWindow, isLateLeave } = require('./socialRules');

// 매너 점수 — 점수를 움직이는 곳은 이 파일의 move() 하나다
//   불변식: 점수 = 50 + Σ(MannerLog.scoreChange), 0~100 (npm run manner:check 로 검사)
//   본인이 한 일 · 본인이 볼 수 있는 결과만 점수를 움직인다. 참석은 판정하지 않는다
//   남의 평가는 한 표에 ±1 만, 큰 것(개설 가점 박탈)은 문턱을 건다
// 규칙 표 · 일부러 0점인 것 · 버린 안은 CLAUDE.md "매너 점수" 절

const BASE = 50;
const MIN = 0;
const MAX = 100;
const RECENT_DAYS = 10; // cron 이 거슬러 보는 범위 — 이보다 오래된 모임은 이미 처리됐다

// 개설 가점 박탈에 필요한 '아쉬웠어요' 최소 수 (조정 지점). 감점 문턱이 아니다
const MIN_LOW_COUNT = 2;

const SCORES = {
  meetup_open: 5, // 승인 참여자 1명 이상 · 평가 제출 · 반 이상이 아쉬워하지 않음
  // 참여 가점(meetup_join)은 없다 — 참석을 확인할 수 없다. 되살리지 말 것
  review_submit: 1,
  review_praise: 1, // 1건당
  review_low: -1, // 1건당 — 문턱 · 상한 없음
  friend_matched: 1,
  leave_early: 0, // 0 이면 move() 가 이력도 안 남긴다
  leave_late: -1,
  host_cancel: -5,
  review_skip: -1,
  manner_report: -7, // 관리자 제재 — 유일하게 사람이 판단한 감점이라 가장 무겁다. 이유별 차등 없음
  manner_revert: 7, // 화면 표시용 — 실제로는 reportReverted 가 그때 적용분을 되돌린다
};

/**
 * 개설 가점 박탈 여부 — '아쉬웠어요'가 MIN_LOW_COUNT 이상 **그리고** 반 이상
 * (평가자 1명 → 박탈 없음 · 2명 → 2 · 3명 → 2 · 4명 → 3)
 * @param count  '아쉬웠어요'를 고른 사람 수
 * @param raters 나를 평가할 수 있었던 사람 수 (내 평가 제외)
 */
const forfeitsActivity = (count, raters) => count >= MIN_LOW_COUNT && count * 2 > raters;

const DAY = 24 * 60 * 60 * 1000;
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const clamp = (n) => Math.min(MAX, Math.max(MIN, n));

const participantsOf = (meetup) => [meetup.host, ...(meetup.members || []).filter((m) => m.status === 'approved').map((m) => m.user)];
/** 승인된 참여자 수 (호스트 제외) — 빈 모임에 개설 가점이 붙지 않게 */
const approvedCountOf = (meetup) => (meetup.members || []).filter((m) => m.status === 'approved').length;

/** 점수 — 저장된 값 하나. 왜 그 값인지는 이력(listLog)이 설명한다 */
const scoreOf = (user) => user?.manner?.score ?? BASE;

/**
 * 점수를 옮기고 이력을 남긴다 — 모든 변동이 지나는 유일한 문
 * @param type   MannerLog.TYPES 중 하나
 * @param amount 규칙상 요청분 (SCORES 값)
 * @param log    { message, meetup?, friend?, report? } — message 는 화면에 그대로 나간다
 * @returns 실제 적용분 (경계에 걸렸으면 요청분보다 작다)
 */
async function move(userId, type, amount, log) {
  if (!userId || !amount) return 0;

  // 원자적으로 가감 + 클램프. { new: false } 로 이전 점수를 받아 실제 적용분을 계산한다
  const before = await User.findOneAndUpdate(
    { _id: oid(userId) },
    [{ $set: { 'manner.score': { $min: [MAX, { $max: [MIN, { $add: [{ $ifNull: ['$manner.score', BASE] }, amount] }] }] } } }],
    { new: false, projection: { manner: 1 } }
  ).lean();
  if (!before) return 0; // 탈퇴 등

  const applied = clamp(scoreOf(before) + amount) - scoreOf(before);

  await MannerLog.create({
    user: oid(userId),
    type,
    message: log.message,
    scoreChange: applied,
    requested: amount,
    meetup: log.meetup,
    friend: log.friend,
    report: log.report,
  });

  // 깎일 때만 알린다 — 설명이 필요한 쪽이다. 오를 땐 조용히 이력에만
  if (applied < 0) {
    await notificationService.mannerDown({ userId, message: log.message, points: applied, meetup: log.meetup });
  }
  return applied;
}

// ---------- 즉시 반영 (서비스에서 부름) ----------

/**
 * 확정된 참여를 취소했다 — 이야기 자리 24시간 안이면 -1, 그 전이면 0
 * 문구는 '만나기 하루 전에' ('하루 안에'는 일찍 취소한 쪽으로 읽힌다)
 */
function left(userId, meetup, now = new Date()) {
  const late = isLateLeave(meetup.talk.startAt, now);
  if (!late) return 0; // 미리 취소는 변동 없음 — 이력도 남기지 않는다
  return move(userId, 'meetup_leave', SCORES.leave_late, {
    message: `만나기 하루 전에 '${meetup.title}' 참여를 취소했어요`,
    meetup: meetup._id,
  });
}

/** 참여자가 있는 모임을 호스트가 취소했다 -5 */
const hostCancelled = (hostId, meetup) =>
  move(hostId, 'meetup_cancel', SCORES.host_cancel, {
    message: `참여자가 있는 '${meetup.title}' 모임을 취소했어요`,
    meetup: meetup._id,
  });

/** 평가를 보냈다 +1 */
const reviewSubmitted = (userId, meetup) =>
  move(userId, 'review_submit', SCORES.review_submit, { message: `'${meetup.title}' 평가를 보냈어요`, meetup: meetup._id });

/** 친구가 됐다 +1 — 양쪽에. 상호 선택이라 양쪽 다 아는 사실이다 */
async function friendsMade(userA, userB, meetupId) {
  const [a, b] = await Promise.all([
    User.findById(userA, { nickname: 1 }).lean(),
    User.findById(userB, { nickname: 1 }).lean(),
  ]);
  await move(userA, 'friend_matched', SCORES.friend_matched, {
    message: `${b?.nickname || '알 수 없음'}님과 친구가 됐어요`,
    meetup: meetupId,
    friend: userB,
  });
  await move(userB, 'friend_matched', SCORES.friend_matched, {
    message: `${a?.nickname || '알 수 없음'}님과 친구가 됐어요`,
    meetup: meetupId,
    friend: userA,
  });
}

// ---------- 신고 처리 (관리자 화면 — services/adminService.js) ----------

/** 관리자가 신고를 받아들여 제재했다 -7. 접수만으로는 깎지 않는다 (알림은 move() 가 보냄) */
const reportAccepted = (targetId, { reportId, meetup, meetupTitle }) =>
  move(targetId, 'manner_report', SCORES.manner_report, {
    // 모임 밖(친구 1:1 방) 신고는 제목이 없다 — 어느 모임인지 못 적을 때는 말하지 않는다
    message: meetupTitle ? `'${meetupTitle}'에서 신고로 제재를 받았어요` : '신고로 제재를 받았어요',
    meetup,
    report: reportId,
  });

/**
 * 제재를 취소했다 — 그 신고의 제재 이력에서 **실제 적용분**을 찾아 반대 부호로 쌓는다
 * (5점인 사람은 -7 중 -5 만 적용됐다 — +7 을 주면 불변식이 깨진다). 이력은 지우지 않는다
 */
async function reportReverted(targetId, reportId) {
  const log = await MannerLog.findOne({ report: oid(reportId), type: 'manner_report' }, { scoreChange: 1, meetup: 1 }).lean();
  if (!log) return 0; // 제재 이력이 없다 — 깎인 적이 없으니 돌려줄 것도 없다
  return move(targetId, 'manner_revert', -log.scoreChange, {
    message: '신고가 다시 검토돼 제재가 취소됐어요',
    meetup: log.meetup,
    report: reportId,
  });
}

// ---------- cron 반영 (schedulers/reviewDaily.js) ----------

/**
 * 평가 마감 반영 — ① 개설 +5(호스트) ② 좋았어요 +1/건 ③ 아쉬웠어요 -1/건 ④ 미제출 -1
 * 집계를 먼저 하고 지급은 나중에 — ① 이 아쉬움 집계에 달려 있다
 * 마감 시각은 계산값(reviewWindow)이라 쿼리 대신 메모리에서 거른다
 */
async function applyReviewClosed(now = new Date()) {
  const docs = await Meetup.find(
    { status: { $ne: 'cancelled' }, reviewAppliedAt: null, 'talk.startAt': { $gte: new Date(now - RECENT_DAYS * DAY) } },
    { title: 1, host: 1, members: 1, talk: 1 }
  ).lean();
  const closed = docs.filter((m) => reviewWindow(m.talk.startAt).closesAt <= now);

  for (const m of closed) {
    const reviews = await Review.find({ meetup: m._id }, { reviewer: 1, praised: 1, disappointed: 1 }).lean();
    const reviewers = new Set(reviews.map((r) => String(r.reviewer)));
    // 취소한 사람은 members 에서 $pull 로 이미 빠져 있다 — 여기 남은 사람이 '오기로 한 사람'이다
    const participants = participantsOf(m).map(String);

    // 아무도 평가를 안 냈으면 무산된 모임으로 보고 누구도 깎지 않는다
    if (reviewers.size === 0) {
      await Meetup.updateOne({ _id: m._id }, { $set: { reviewAppliedAt: now } });
      continue;
    }

    // ── 집계 ── 누가 골랐는지는 쓰지 않고 수만 센다
    const tally = (field) => {
      const map = new Map();
      for (const r of reviews) {
        for (const id of r[field] || []) map.set(String(id), (map.get(String(id)) || 0) + 1);
      }
      return map;
    };
    const praised = tally('praised');
    const low = tally('disappointed');

    // 개설 가점 박탈 대상 (raters = 내 평가를 뺀 평가자 수)
    const forfeitSet = new Set();
    for (const [userId, count] of low) {
      const raters = reviews.filter((r) => String(r.reviewer) !== userId).length;
      if (forfeitsActivity(count, raters)) forfeitSet.add(userId);
    }

    // ── 지급 ──
    // ① 개설 가점 — 호스트만. ⚠ 승인 참여자 조건을 빼면 빈 모임을 반복해 열어 +6 을 무제한 받는다
    const hostId = String(m.host);
    if (approvedCountOf(m) > 0 && reviewers.has(hostId) && !forfeitSet.has(hostId)) {
      await move(hostId, 'meetup_open', SCORES.meetup_open, { message: `'${m.title}' 모임을 열었어요`, meetup: m._id });
    }

    // ② 좋았어요 — 1건당 +1
    for (const [userId, count] of praised) {
      await move(userId, 'review_praise', SCORES.review_praise * count, {
        message: `'${m.title}'에서 매너가 좋았다는 평가를 ${count}번 받았어요`,
        meetup: m._id,
      });
    }

    // ③ 아쉬웠어요 — 1건당 -1. 문구에 인원수를 적지 않는다 (작은 모임에서 누군지 역산된다)
    for (const [userId, count] of low) {
      await move(userId, 'review_low', SCORES.review_low * count, {
        message: `'${m.title}'에서 매너가 아쉬웠다는 평가를 받았어요`,
        meetup: m._id,
      });
    }

    // ④ 미제출 -1 — 열림 · 마감 임박 알림을 이미 받았다
    for (const userId of participants) {
      if (reviewers.has(userId)) continue;
      await move(userId, 'review_skip', SCORES.review_skip, {
        message: `'${m.title}' 평가를 보내지 않았어요`,
        meetup: m._id,
      });
    }

    await Meetup.updateOne({ _id: m._id }, { $set: { reviewAppliedAt: now } });
  }
  return closed.length;
}
// ---------- 조회 ----------

/** 내 점수 변동 이력 — 최근 순 */
const listLog = (userId, limit = 30) =>
  MannerLog.find({ user: oid(userId) }, { type: 1, message: 1, scoreChange: 1, requested: 1, meetup: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

module.exports = {
  BASE,
  MIN,
  MAX,
  SCORES,
  MIN_LOW_COUNT,
  forfeitsActivity,
  scoreOf,
  left,
  hostCancelled,
  reviewSubmitted,
  friendsMade,
  reportAccepted,
  reportReverted,
  applyReviewClosed,
  listLog,
};
