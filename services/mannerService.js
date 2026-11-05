const mongoose = require('mongoose');
const User = require('../models/User');
const MannerLog = require('../models/MannerLog');
const Meetup = require('../models/Meetup');
const Review = require('../models/Review');
const notificationService = require('./notificationService');
const { reviewWindow, isLateLeave } = require('./socialRules');

// 매너 점수 — 점수를 움직이는 곳은 이 파일 하나다.
//
// ★ 이 기능의 목적은 "왜 내 점수가 깎였지? 왜 올랐지?"를 남기지 않는 것이다. 그래서 세 가지를 지킨다.
//
//   1) 불변식:  점수 = 50 + Σ(MannerLog.scoreChange)   (0 ~ 100)
//      이력을 다 더하면 현재 점수가 나온다. 0 · 100 경계에 걸려 덜 적용됐으면 **적용분**을 이력에 적고
//      requested 에 규칙상 요청분을 남긴다 → 화면이 "최고점이라 더 오르지 않았어요"를 설명할 수 있다.
//      scripts/checkMannerLedger.js 가 전원에 대해 이 식을 검사한다.
//
//   2) 점수를 움직이는 것은 **본인이 한 일**이거나 **본인이 볼 수 있는 결과**뿐이다.
//      숨은 입력(남의 비공개 선택) 하나로 점수가 움직이면 설명할 수가 없다. 남의 평가를
//      입력으로 쓸 때는 **문턱**을 둔다 — 한 사람의 선택만으로는 움직이지 않는다 (아래 ★★★).
//
//   3) 규칙 전문을 화면에 띄운다 (마이페이지 '이렇게 움직여요' 표). 숨기지 않는다.
//
// ★★ 활동 가점은 두 조건을 다 만족해야 인정된다 (2026-11)
//
//   ① 그 모임 평가를 보냈다 — 그 자리에 실제로 관여했다는 **본인의 자발적 증거**다.
//      아무도 남을 판정하지 않고도 노쇼가 이득이 되지 않게 만들어 준다.
//   ② 함께한 분들의 과반이 매너를 아쉽게 평가하지 않았다 — 그랬으면 활동으로 인정하지 않는다.
//
//   ②가 없으면 틀린 정책이 된다. 감점만 -2 붙이면 참여자는 +2 +1 -2 = +1, 호스트는
//   +5 +1 -2 = +4 다 — **매너가 아쉬웠다고 확인된 사람의 점수가 오른다.** 감점 숫자를 키워
//   막으려면 호스트 기준으로 -7 쯤 필요해지고, 그러면 호스트 취소(-5)보다 커져 서열이 뒤집힌다.
//   그래서 **활동 인정 여부**로 푼다. 덕분에 호스트와 참여자가 대칭이 된다 — 둘 다 평가 제출
//   +1 만 남고 거기서 -3 이 붙어 net -2.
//
//     참석 + 평가 + 칭찬   +2 +1 +1↑ = +4 이상
//     참석 + 평가          +2 +1     = +3
//     미리 취소                          0
//     참석했지만 미제출     0 -1     = -1
//     말없이 안 옴          0 -1     = -1      ← 전에는 승인 +2 가 남아 +1 이었다 (노쇼가 이득)
//     늦게 취소                         -1
//     매너 아쉬움(과반)     0 +1 -3  = -2      ← 활동 가점이 인정되지 않는다
//     호스트가 취소                     -5
//
//   한 방향으로 정렬된다. 매너 아쉬움이 미제출(-1)보다 나쁘다 — 평가를 안 낸 건 게으름이고,
//   과반이 매너를 아쉽다고 한 건 실제로 남에게 피해를 준 것이다.
//
// ★★★ 올리는 것은 1표, 깎는 것은 과반 (최소 2명)
//
//   칭찬은 한 명만 골라도 +1 이 붙는다. 감점은 `count >= MIN_LOW_COUNT && count * 2 > raters`
//   (= 과반 floor(raters/2)+1) 를 넘길 때만 붙는다. **모순이 아니라 의도된 비대칭이다** —
//   설명 못 하는 +1 은 아무도 항의하지 않지만 설명 못 하는 -1 은 이 기능의 목적을 깬다.
//   move() 가 깎일 때만 알림을 보내는 것과 같은 이유다.
//
//   버린 대안들 (같은 논의를 반복하지 않게 남긴다)
//     · 최소치 없는 순수 과반   raters=1 이면 과반이 1 이라 **한 사람 판단으로 깎인다**
//     · 최소 3명 + 과반        3인 모임(raters=2)에 감점 경로가 없어진다 — capacity 최소가
//                              2(호스트 제외)라 **가장 흔한 크기에서 기능이 죽는다**
//     · 전원 일치              만석(호스트+10)이면 10명 전원이 같은 평가를 해야 하므로
//                              **"큰 모임에 숨으면 안전하다"** 는 구멍이 생긴다
//
//   ⚠ 알고 받아들이는 한계: `평가자 3명 중 2명` 에서는 둘이 짜면 통과한다. 피해가 한 모임당
//     net -2 로 묶여 있고, 이력에 type · meetup 이 남아 사후 추적이 되고, 신고 → 관리자 판단으로
//     되돌릴 수 있어서 받아들인다. 문제가 실제로 생기면 **조정 지점은 MIN_LOW_COUNT 를 3 으로
//     올리는 것**이다 (상수 하나만 바꾸면 된다).
//
//   ⚠ 작은 모임에서 매너 평가는 **사실상 공개**다 — 3인 모임이면 나를 평가할 사람이 2명뿐이라
//     서로 알 수 있다. 그게 바로 이 문턱의 근거다(지목 가능성이 억제력이다). 그래서 UI 에
//     '익명' 이라고 적지 않는다 — 지킬 수 있는 약속은 "우리가 알려주지 않는다" 이고
//     "아무도 알 수 없다" 가 아니다.
//
//   노쇼를 평가에서 지목하게 하는 안('안 왔어요' 항목)은 그대로 버렸다 — 1표로 바로 깎이고,
//   지목자가 익명이고, 되돌릴 수단도 없어서 원칙 2)가 깨진다.
//   노쇼는 신고 → 관리자 판단 경로가 받는다 (판단 주체가 있어야 설명할 수 있다).
//
// ── 오르는 쪽 ──────────────────────────────────────────────────────────────
//   모임을 열었다                     +5   평가 마감 (cron) — 평가를 보냈고 매너가 과반으로 아쉽지 않을 때
//   모임에 참여했다                   +2   평가 마감 (cron) — 조건 같음
//   평가를 보냈다                     +1   제출 즉시
//   매너가 좋았다는 평가를 받았다     +1/건 평가 마감 (cron) — **한 명만 골라도 오른다**
//   친구가 됐다                       +1   성립 즉시 — 친구 목록과 1:1 방이 생긴다
//
// ── 내려가는 쪽 ────────────────────────────────────────────────────────────
//   확정된 참여 취소 — 이야기 자리 24시간 이내  -1
//   참여자가 있는 모임을 호스트가 취소          -5
//   평가를 안 냈다                              -1   평가 마감 (cron)
//                                                   단, 아무도 평가를 안 낸 모임은 전원 감점 없음
//                                                   (호스트가 안 와서 무산된 모임에서 억울하지 않게)
//   평가자 과반(최소 2명)이 매너를 아쉽게 평가  -3   평가 마감 (cron)
//                                                   + 그 모임 활동 가점(+5 · +2)도 인정되지 않는다
//
// ── 일부러 0점인 것 (물어보면 답할 수 있어야 한다) ─────────────────────────
//   미리 취소 (24시간 전까지)    미리 알려 주는 건 손해가 없어야 한다
//   신청 중(승인 전) 취소        아무 자리도 맡지 않았다
//   참여자 없는 모임 취소        아무도 영향받지 않았다
//   한 사람만 매너를 아쉽게 평가  한 사람 판단으로는 움직이지 않는다. 과반이 아니면 이력에도 없다
//   '또 만나고 싶어요' 받음      한쪽만 고른 건 상대에게 드러나지 않는 게 약속이다. 점수가 움직이면
//                                역추적 여지가 생기고 본인에게도 설명할 수 없다.
//                                상호 선택은 '친구가 됐다 +1' 로만 반영한다
//   노쇼                         확인할 방법이 없어 따로 깎지 않는다. 대신 평가를 보낼 수 없어서
//                                그 모임의 활동 가점(+2 · +5)이 인정되지 않는다
//   신고                         관리자 판단 화면이 없다. 접수만으로 깎으면 신고가 무기가 된다
//   차단 · 친구 끊기             양쪽 중 누가 잘못인지 알 수 없다

const BASE = 50;
const MIN = 0;
const MAX = 100;
const RECENT_DAYS = 10; // cron 이 거슬러 보는 범위 — 이보다 오래된 모임은 이미 처리됐다

const MIN_LOW_COUNT = 2; // '매너가 아쉬웠어요'가 이 수 미만이면 과반이어도 안 깎는다 (조정 지점)

const SCORES = {
  meetup_open: 5,
  meetup_join: 2,
  review_submit: 1,
  review_praise: 1, // '매너가 좋았어요' 1건당 — 문턱 없음, 한 명만 골라도 오른다
  review_low: -3, // '매너가 아쉬웠어요'가 2명 이상이고 평가자 과반일 때. 활동 가점도 함께 사라진다
  friend_matched: 1,
  leave_early: 0, // 미리 취소는 손해가 없다 — move() 가 0 에서 바로 반환해 이력에도 안 남는다
  leave_late: -1,
  host_cancel: -5,
  review_skip: -1,
};

/**
 * '매너가 아쉬웠어요'가 점수를 움직이는 문턱 — **2명 이상 그리고 나를 평가한 사람의 과반**.
 * `count * 2 > raters` 는 과반 `floor(raters/2) + 1` 과 같은 식이다.
 *   raters 1명 → 안 움직인다 (한 사람 판단으로는 깎지 않는다)
 *   raters 2명 → 2명 (전원)   ·   3명 → 2명   ·   4명 → 3명   ·   7명 → 4명
 * 순수 함수로 빼 둔 건 이 정책이 가장 논쟁적인 부분이라 DB 없이 검사할 수 있어야 하기 때문이다.
 * @param count  '아쉬웠어요'를 고른 사람 수
 * @param raters 나를 평가할 수 있었던 평가자 수 (내가 낸 평가는 세지 않는다)
 */
const isLowManner = (count, raters) => count >= MIN_LOW_COUNT && count * 2 > raters;

const DAY = 24 * 60 * 60 * 1000;
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const clamp = (n) => Math.min(MAX, Math.max(MIN, n));

const participantsOf = (meetup) => [meetup.host, ...(meetup.members || []).filter((m) => m.status === 'approved').map((m) => m.user)];

/** 점수 — 저장된 값 하나. 왜 그 값인지는 이력(listLog)이 설명한다 */
const scoreOf = (user) => user?.manner?.score ?? BASE;

/**
 * 점수를 옮기고 이력을 남긴다 — 모든 변동이 지나는 유일한 문
 * @param type   MannerLog.TYPES 중 하나
 * @param amount 규칙상 요청분 (SCORES 값)
 * @param log    { message, meetup?, friend? } — message 는 화면에 그대로 나간다
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
 * 승인 시점에는 가점이 없다 (평가 마감에 평가를 보낸 사람에게만 +2) — 그래서 여기는 감점만 본다
 */
function left(userId, meetup, now = new Date()) {
  const late = isLateLeave(meetup.talk.startAt, now);
  if (!late) return 0; // 미리 취소는 변동 없음 — 이력도 남기지 않는다
  return move(userId, 'meetup_leave', SCORES.leave_late, {
    message: `'${meetup.title}' 참여를 이야기 자리 하루 안에 취소했어요`,
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

// ---------- cron 반영 (schedulers/reviewDaily.js) ----------

/**
 * 평가 마감 반영 — 이 모임에서 점수가 움직이는 모든 일을 한 번에 처리한다
 *   ① 활동 가점: 평가를 보냈고 **매너가 과반으로 아쉽지 않은** 사람에게만 (호스트 +5 · 참여자 +2)
 *   ② 매너가 좋았다는 평가 +1/건 — 문턱 없음
 *   ③ 매너가 아쉬웠다는 평가 -3 — 2명 이상 + 평가자 과반일 때만
 *   ④ 평가 미제출 -1
 *
 * **집계를 먼저 하고 지급을 나중에 한다.** ① 이 ③ 의 결과에 의존하기 때문이다 — 순서를 되돌리면
 * 매너가 아쉬웠다고 확인된 사람에게 활동 가점이 먼저 붙어 점수가 오른다.
 *
 * 평가 마감 시각은 저장되지 않고 reviewWindow 로 계산하는 값이라 쿼리로 못 걸러진다 → 메모리에서 건다
 * (myPageService.receivedPraise 가 이미 같은 방식)
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

    // 아무도 평가를 안 낸 모임 — 성사되지 않았다고 보고 누구도 깎지 않는다.
    // (호스트가 안 와서 무산된 자리에서 참여자가 억울하게 -1 을 받으면 안 된다)
    if (reviewers.size === 0) {
      await Meetup.updateOne({ _id: m._id }, { $set: { reviewAppliedAt: now } });
      continue;
    }

    // ── 집계 ── 누가 칭찬했는지 · 누가 아쉽다고 했는지는 쓰지 않는다 (사람이 아니라 수만 센다)
    const tally = (field) => {
      const map = new Map();
      for (const r of reviews) {
        for (const id of r[field] || []) map.set(String(id), (map.get(String(id)) || 0) + 1);
      }
      return map;
    };
    const praised = tally('praised');
    const low = tally('disappointed');

    // 문턱: 2명 이상 **그리고** 나를 평가한 사람의 과반. 한 사람의 선택만으로는 움직이지 않는다.
    // raters 는 '나를 평가할 수 있었던 평가자 수' — 내가 낸 평가는 세지 않는다
    const lowSet = new Set();
    for (const [userId, count] of low) {
      const raters = reviews.filter((r) => String(r.reviewer) !== userId).length;
      if (isLowManner(count, raters)) lowSet.add(userId);
    }

    // ── 지급 ──
    // ① 활동 가점 — 평가를 보냈고 매너가 과반으로 아쉽지 않은 사람에게만. 이게 노쇼를 이득이 아니게
    //    만들고, 매너가 아쉬웠다고 확인된 사람의 점수가 오르지 않게 만드는 지점이다.
    //    호스트는 개설 가점만 받는다 (참여 가점과 중복 지급하지 않는다)
    for (const userId of participants) {
      if (!reviewers.has(userId) || lowSet.has(userId)) continue;
      if (userId === String(m.host)) {
        await move(userId, 'meetup_open', SCORES.meetup_open, { message: `'${m.title}' 모임을 열었어요`, meetup: m._id });
      } else {
        await move(userId, 'meetup_join', SCORES.meetup_join, { message: `'${m.title}'에 참여했어요`, meetup: m._id });
      }
    }

    // ② 매너가 좋았다는 평가 — 문턱이 없다. 한 명만 골라도 오른다. ③ 과 비대칭인 건 의도다
    //    (설명 못 하는 +1 은 항의를 만들지 않지만 설명 못 하는 -1 은 이 기능의 목적을 깬다)
    for (const [userId, count] of praised) {
      await move(userId, 'review_praise', SCORES.review_praise * count, {
        message: `'${m.title}'에서 매너가 좋았다는 평가를 ${count}번 받았어요`,
        meetup: m._id,
      });
    }

    // ③ 매너가 아쉬웠다는 평가 — **인원수를 적지 않는다.** 적으면 작은 모임에서 누가 눌렀는지 역산된다
    for (const userId of lowSet) {
      await move(userId, 'review_low', SCORES.review_low, {
        message: `'${m.title}'에서 여러 분이 매너를 아쉽게 평가했어요`,
        meetup: m._id,
      });
    }

    // ④ 평가를 안 낸 참여자 -1. 열림 · 마감 임박 알림을 받은 뒤라 "몰라서 못 냈다"가 아니다
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

/** 내 점수 변동 이력 — 최근 순. 화면이 합을 검산해 보여준다 */
const listLog = (userId, limit = 30) =>
  MannerLog.find({ user: oid(userId) }, { type: 1, message: 1, scoreChange: 1, requested: 1, meetup: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

/** 이력 전체의 합 — 불변식 검산용 (화면에 '50 + 합 = 점수' 로 보여준다) */
async function logSum(userId) {
  const [row] = await MannerLog.aggregate([{ $match: { user: oid(userId) } }, { $group: { _id: null, sum: { $sum: '$scoreChange' } } }]);
  return row?.sum || 0;
}

module.exports = {
  BASE,
  MIN,
  MAX,
  SCORES,
  MIN_LOW_COUNT,
  isLowManner,
  scoreOf,
  left,
  hostCancelled,
  reviewSubmitted,
  friendsMade,
  applyReviewClosed,
  listLog,
  logSum,
};
