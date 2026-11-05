const cron = require('node-cron');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const mannerService = require('../services/mannerService');
const notificationService = require('../services/notificationService');
const { reviewWindow } = require('../services/socialRules');

// 평가 진행에 맞춰 하루 한 번 처리하는 일들 — 매일 12:00(서울)
//
// 평가는 이야기 자리 다음날 12:00 에 열리고 48시간 뒤(= 3일째 12:00) 마감된다. 둘 다 12:00 이라
// 하루 한 번 도는 cron 하나로 전부 커버된다. 지금까지 이 cron 이 없어서 점수 반영도 알림도 없었다.
//
// 하는 일 (전부 모임에 표식을 남겨서 두 번 돌아도 중복되지 않는다)
//   1. 열림 알림   확정 참여자에게 '평가가 열렸어요'              (Meetup.reviewOpenNoticedAt)
//   2. 마감 임박   아직 안 낸 사람에게만 '내일 마감돼요'          (Meetup.reviewClosingNoticedAt)
//   3. 마감 반영   활동 가점(평가를 보낸 사람만) · 칭찬 · 미제출 감점 (Meetup.reviewAppliedAt)
//
// 2번이 3번의 전제조건이다 — 미제출 감점은 미리 알려줘야 "몰라서 못 냈다"가 안 남는다.
// 활동 가점(개설 +5 · 참여 +2)도 3번에서 함께 준다 — 평가 제출이 그 모임에 관여했다는 증거라서,
// 승인만 받고 안 온 사람에게는 가점이 남지 않는다 (services/mannerService.js 주석 참고).
//
// ⚠ config/socket.js 의 emitToUsers 는 io 가 없으면 조용히 무시한다. cron 은 app.js 안에서 도니
//   실시간 push 가 가지만, npm run review:daily 로 수동 실행하면 DB 에만 쌓인다 (정상)
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
