const cron = require('node-cron');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const mannerService = require('../services/mannerService');
const notificationService = require('../services/notificationService');
const { reviewWindow } = require('../services/socialRules');

// 평가 일정 처리 — 매일 12:00(서울). 평가 열림 · 마감이 둘 다 12:00 이라 하루 한 번이면 된다
//   1. 열림 알림   확정 참여자            (Meetup.reviewOpenNoticedAt)
//   2. 마감 임박   아직 안 낸 사람만      (Meetup.reviewClosingNoticedAt) — 미제출 감점의 전제조건
//   3. 마감 반영   개설 가점 · 받은 평가 · 미제출 감점 (Meetup.reviewAppliedAt)
// 모임에 표식을 남기므로 두 번 돌아도 중복되지 않는다
// 수동 실행(npm run review:daily)은 소켓이 없어 알림이 DB 에만 쌓인다
const SCHEDULE = '0 12 * * *';
const TIMEZONE = 'Asia/Seoul';
const RECENT_DAYS = 10; // 이보다 오래된 모임은 이미 처리됐다
const DAY = 24 * 60 * 60 * 1000;

const participantsOf = (meetup) => [meetup.host, ...(meetup.members || []).filter((m) => m.status === 'approved').map((m) => m.user)];

/** 평가가 열려 있는 모임에 '평가가 열렸어요' */
async function noticeReviewOpen(now) {
  const docs = await Meetup.find(
    {
      status: { $ne: 'cancelled' },
      reviewOpenNoticedAt: null,
      'talk.startAt': { $lte: now, $gte: new Date(now - RECENT_DAYS * DAY) },
    },
    { title: 1, host: 1, members: 1, talk: 1 }
  ).lean();

  let sent = 0;
  for (const m of docs) {
    const { opensAt, closesAt } = reviewWindow(m.talk.startAt);
    if (now < opensAt) continue; // 아직 안 열렸다
    if (now < closesAt) {
      await notificationService.reviewOpen(m);
      sent += 1;
    }
    // 이미 마감된 모임은 이제 알려도 소용없다 — 표식만 남기고 넘어간다
    await Meetup.updateOne({ _id: m._id }, { $set: { reviewOpenNoticedAt: now } });
  }
  return sent;
}

/** 아직 평가를 안 낸 참여자 id (문자열) */
async function pendingReviewers(meetup) {
  const reviews = await Review.find({ meetup: meetup._id }, { reviewer: 1 }).lean();
  const done = new Set(reviews.map((r) => String(r.reviewer)));
  return participantsOf(meetup)
    .map(String)
    .filter((id) => !done.has(id));
}

/** 마감 24시간 전 — 아직 안 낸 사람에게만. 미제출 감점(-1)의 전제조건이다 */
async function noticeReviewClosing(now) {
  const docs = await Meetup.find(
    {
      status: { $ne: 'cancelled' },
      reviewClosingNoticedAt: null,
      'talk.startAt': { $lte: now, $gte: new Date(now - RECENT_DAYS * DAY) },
    },
    { title: 1, host: 1, members: 1, talk: 1 }
  ).lean();

  let sent = 0;
  for (const m of docs) {
    const { closesAt } = reviewWindow(m.talk.startAt);
    const left = closesAt - now;
    if (left > DAY) continue; // 아직 하루 넘게 남았다 — 다음 실행에서 보낸다
    if (left > 0) {
      const pending = await pendingReviewers(m);
      if (pending.length) {
        await notificationService.reviewClosing(m, pending);
        sent += 1;
      }
    }
    await Meetup.updateOne({ _id: m._id }, { $set: { reviewClosingNoticedAt: now } });
  }
  return sent;
}

async function runReviewDaily(now = new Date()) {
  try {
    const noticed = await noticeReviewOpen(now);
    const closing = await noticeReviewClosing(now);
    const applied = await mannerService.applyReviewClosed(now);
    console.log(`[평가 하루 처리] 열림 알림 ${noticed} · 마감 임박 ${closing} · 마감 반영 ${applied}`);
  } catch (err) {
    console.error('[평가 하루 처리] 실행 오류:', err.message);
  }
}

function startReviewDailyScheduler() {
  cron.schedule(SCHEDULE, () => runReviewDaily(), { name: 'review-daily', timezone: TIMEZONE, noOverlap: true });
  console.log(`[평가 하루 처리] 스케줄 등록: 매일 12:00 (${TIMEZONE})`);
}

module.exports = { startReviewDailyScheduler, runReviewDaily };
