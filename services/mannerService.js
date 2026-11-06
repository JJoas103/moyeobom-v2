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
//      **우리가 판단할 수 없는 것에는 점수를 주지 않는다** — 참석 여부가 그렇다(아래 ★★).
//      남의 평가를 입력으로 쓸 때는 **한 표로는 작은 것만** 움직인다(아래 ★★★).
//
//   3) 규칙 전문을 화면에 띄운다 (마이페이지 '이렇게 움직여요' 표). 숨기지 않는다.
//
// ★★ 참여 가점(+2)은 없앴다 (2026-11-06) — 참석을 확인할 방법이 없다
//
//   전에는 "평가 제출이 그 자리에 관여했다는 증거" 라고 보고 참여 +2 를 줬다. **틀렸다.**
//   reviewService.loadForReviewer 에 **출석 확인이 없어서** 노쇼도 집에서 평가를 낼 수 있고,
//   그러면 +2 +1 = +3 으로 실제 참석자와 점수가 같았다. 평가 제출은 '버튼을 눌렀다'는 증거일 뿐이다.
//   (CLAUDE.md 에 "노쇼는 평가를 보낼 수 없다" 고 적혀 있었는데 그것도 거짓이었다 — 고쳤다)
//
//   그래서 **참석의 보상은 함께한 사람의 평가로만 준다.** 우리가 출석을 판정하지 않아도
//   노쇼는 아쉬움 평가를 받아 자연히 마이너스로 간다. 원칙 2)에 맞는 방식이다.
//
//     참여자                                  호스트
//       참석 · 좋았어요 2건   +1 +2 = +3        참여자 있는 모임 · 평가  +5 +1 = +6
//       참석 · 평가 못 받음   +1    = +1        빈 모임 · 평가만 제출    +1    = +1
//       노쇼 · 아쉬웠어요 2건 +1 -2 = -1
//       미제출                -1    = -1
//
//   **개설 가점(+5)은 남긴다** — '모임을 만들고 사람을 모아 운영한 노동'은 DB 에 흔적이 남아
//   확인된다(모임 문서 · 승인 기록 · 채팅방). 세 조건을 다 만족해야 붙는다.
//     ① 그 모임 평가를 보냈다
//     ② 함께한 분들 반 이상이 매너를 아쉬워하지 않았다
//     ③ **승인된 참여자가 1명 이상이다** ← 없으면 빈 모임을 반복해 열어 +6 을 무제한 수급할 수 있었다
//        (participantsOf 는 호스트를 항상 넣으므로 혼자 평가를 내면 'reviewers.size === 0' 보호에
//         안 걸렸다. 2026-11-06 에 막았다)
//
//   호스트가 그 자리에 나타났는지는 여전히 모른다 — 반 이상이 아쉬워하면 ② 로 박탈되고,
//   그 밖은 모임 신고(호스트 노쇼)가 받는다.
//
// ★★★ 한 표로는 작은 것만, 큰 것은 문턱
//
//   평가는 **누른 만큼 ±1** 이다. 좋았어요 +1 · 보통이에요 0(저장도 안 한다) · 아쉬웠어요 -1.
//   섞이면 상쇄된다(1:1 이면 0). 상한은 두지 않는다 — 피해 규모와 증거 강도에 비례한다.
//
//   전에는 아쉬움에만 '과반' 문턱을 걸어 -3 고정이었다. 버린 이유 둘.
//     · **한 표 차이로 5점이 갈렸다** (3인 모임: 아쉬움 1명 → +3, 2명 → -2). 계단이 급했다
//     · **과반이 안 되는 신호를 통째로 버렸다** (5인 모임 2명 → +3. 둘이 불편했는데 만점)
//   그리고 비대칭의 근거로 쓴 원칙 2)는 **이미 칭찬에서 깨져 있었다** — 칭찬도 한 사람의
//   익명 선택으로 +1 이 움직인다. 엄격히 읽으면 칭찬도 안 됐어야 한다.
//
//   **문턱이 꼭 필요한 자리는 활동 가점 박탈 하나다** (forfeitsActivity) — 한 사람의 악의로
//   +5 가 날아가면 안 된다. 감점 자체는 -1 이라 미제출 · 늦은 취소와 같은 급이고
//   좋은 모임 한 번으로 복구된다.
//
//   ⚠ 작은 모임에서 매너 평가는 **사실상 공개**다 — 3인 모임이면 나를 평가할 사람이 2명뿐이라
//     서로 알 수 있다. 그래서 UI 에 '익명' 이라고 적지 않는다 — 지킬 수 있는 약속은
//     "우리가 알려주지 않는다" 이고 "아무도 알 수 없다" 가 아니다.
//
//   노쇼를 평가에서 지목하게 하는 안('안 왔어요' 항목)은 버렸다 — 1표로 바로 깎이고,
//   지목자가 익명이고, 되돌릴 수단도 없다. 노쇼는 신고 → 관리자 판단 경로가 받는다.
//
// ── 오르는 쪽 ──────────────────────────────────────────────────────────────
//   모임을 열었다                     +5   평가 마감 (cron) — 위 ★★ 의 세 조건을 다 만족할 때만
//   평가를 보냈다                     +1   제출 즉시
//   매너가 좋았다는 평가를 받았다     +1/건 평가 마감 (cron) — **한 명만 골라도 오른다**
//                                           (화면 라벨에는 '1건마다' 를 안 쓴다 — 이력에 'n번 받았어요' 로 드러난다)
//   친구가 됐다                       +1   성립 즉시 — 친구 목록과 1:1 방이 생긴다
//
// ── 내려가는 쪽 ────────────────────────────────────────────────────────────
//   매너가 아쉬웠다는 평가를 받았다   -1/건 평가 마감 (cron) — 칭찬과 대칭. 문턱 없음
//   확정된 참여 취소 — 이야기 자리 24시간 이내  -1
//   평가를 안 냈다                              -1   평가 마감 (cron)
//                                                   단, 아무도 평가를 안 낸 모임은 전원 감점 없음
//                                                   (호스트가 안 와서 무산된 모임에서 억울하지 않게)
//   참여자가 있는 모임을 호스트가 취소          -5
//   신고로 제재를 받았다                        -7   관리자 확인 뒤 — 가장 무겁다 (유일하게 사람이 판단한 결과)
//                                                   접수만으로는 절대 깎이지 않는다. 신고가 무기가 되면 안 된다
//                                                   기각하면 manner_revert 로 반대 부호 이력을 쌓아 되돌린다
//                                                   ⚠ 부르는 곳을 만들 때 이력 문구는 화면 라벨과 맞춘다 —
//                                                     `'${meetup.title}'에서 신고로 제재를 받았어요`
//
// ── 일부러 0점인 것 (물어보면 답할 수 있어야 한다) ─────────────────────────
//   모임에 참여했다              실제로 왔는지 확인할 방법이 없다. 함께한 분들의 평가로만 움직인다
//   미리 취소 (24시간 전까지)    미리 알려 주는 건 손해가 없어야 한다
//   신청 중(승인 전) 취소        아무 자리도 맡지 않았다
//   참여자 없는 모임 취소        아무도 영향받지 않았다
//   호스트가 내보냈다            본인이 한 일이 아니다 (늦은 취소와 다르다)
//   '또 만나고 싶어요' 받음      한쪽만 고른 건 상대에게 드러나지 않는 게 약속이다. 점수가 움직이면
//                                역추적 여지가 생기고 본인에게도 설명할 수 없다.
//                                상호 선택은 '친구가 됐다 +1' 로만 반영한다
//   노쇼                         출석을 판정하지 않는다. 대신 함께한 분들이 아쉬움 평가를 내면
//                                그걸로 깎인다 (전에 적혀 있던 "평가를 보낼 수 없다" 는 거짓이었다)
//   신고 접수                    관리자가 확인하기 전에는 깎지 않는다. 접수만으로 깎으면 신고가 무기가 된다
//   차단 · 친구 끊기             양쪽 중 누가 잘못인지 알 수 없다

const BASE = 50;
const MIN = 0;
const MAX = 100;
const RECENT_DAYS = 10; // cron 이 거슬러 보는 범위 — 이보다 오래된 모임은 이미 처리됐다

// '매너가 아쉬웠어요'가 이 수 미만이면 반 이상이어도 **개설 가점을 박탈하지 않는다** (조정 지점).
// ⚠ 감점 문턱이 아니다 — 아쉬움 감점은 1건당 -1 로 문턱 없이 들어간다 (위 ★★★)
const MIN_LOW_COUNT = 2;

const SCORES = {
  // 승인된 참여자 1명 이상 + 평가 제출 + 반 이상이 아쉬워하지 않음 — 세 조건 (위 ★★)
  meetup_open: 5,
  // meetup_join(참여 +2)은 없앴다 — 참석을 확인할 방법이 없다 (위 ★★). 되살리지 말 것
  review_submit: 1,
  review_praise: 1, // '매너가 좋았어요' 1건당 — 문턱 없음, 한 명만 골라도 오른다
  review_low: -1, // '매너가 아쉬웠어요' 1건당 — 칭찬과 대칭. 문턱도 상한도 없다 (위 ★★★)
  friend_matched: 1,
  leave_early: 0, // 미리 취소는 손해가 없다 — move() 가 0 에서 바로 반환해 이력에도 안 남는다
  leave_late: -1,
  host_cancel: -5,
  review_skip: -1,
  // 관리자가 신고를 인정했을 때 — **가장 무겁다.** 호스트 취소(-5)보다 커야 한다.
  // 다른 감점은 전부 행동에서 추론한 것(평가를 안 냈다 · 취소했다 · 아쉽다는 평가를 받았다)이고
  // 이것만 **사람이 판단한 사실**이다. -3 은 호스트 취소보다 가벼워 서열이 뒤집혀서 버렸다.
  // 이유별(rude · ad · privacy …) 차등은 두지 않는다 — "왜 내 건 더 깎여" 가 생긴다.
  // 경중은 관리자가 '인정할지 말지' 로 조절한다.
  // ⚠ 거는 곳이 아직 없다 — 관리자 화면에서 연결한다 (알림 manner_down 과 같은 모양이니 지우지 말 것)
  manner_report: -7,
};

/**
 * **활동 가점(개설 +5)을 박탈하는 문턱** — 아쉬움 평가가 2명 이상 **그리고** 반 이상일 때.
 * `count * 2 > raters` 는 '반 이상'(= `floor(raters/2) + 1`)과 같은 식이다.
 *   raters 1명 → 박탈 안 함 (한 사람 판단으로 +5 를 날리지 않는다)
 *   raters 2명 → 2명(전원)   ·   3명 → 2명   ·   4명 → 3명   ·   7명 → 4명
 *
 * ⚠ **감점 문턱이 아니다.** 감점은 1건당 -1 로 문턱이 없다 (위 ★★★).
 *   여기만 문턱이 필요한 이유 — 한 사람의 악의로 +5 가 날아가면 안 된다.
 * 순수 함수로 빼 둔 건 가장 논쟁적인 부분이라 DB 없이 검사할 수 있어야 하기 때문이다.
 * @param count  '아쉬웠어요'를 고른 사람 수
 * @param raters 나를 평가할 수 있었던 평가자 수 (내가 낸 평가는 세지 않는다)
 */
const forfeitsActivity = (count, raters) => count >= MIN_LOW_COUNT && count * 2 > raters;

const DAY = 24 * 60 * 60 * 1000;
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const clamp = (n) => Math.min(MAX, Math.max(MIN, n));

const participantsOf = (meetup) => [meetup.host, ...(meetup.members || []).filter((m) => m.status === 'approved').map((m) => m.user)];
/** 승인된 참여자 수 (호스트 제외) — 개설 가점이 빈 모임에 붙지 않게 막는 데 쓴다 */
const approvedCountOf = (meetup) => (meetup.members || []).filter((m) => m.status === 'approved').length;

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
 * 참여 자체에는 가점이 없다 (2026-11-06 에 없앴다) — 그래서 여기는 감점만 본다
 * 화면 문구는 '만나기 하루 전에' 다 (frontend/src/utils/manner.js 와 짝) — 기준점 없는
 * '하루 안에' 가 *일찍 취소한 쪽*으로 읽혔다 (2026-11-07)
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

// ---------- cron 반영 (schedulers/reviewDaily.js) ----------

/**
 * 평가 마감 반영 — 이 모임에서 점수가 움직이는 모든 일을 한 번에 처리한다
 *   ① 개설 가점 +5: **호스트에게만.** 승인 참여자 있음 · 평가 제출 · 반 이상이 아쉬워하지 않음
 *   ② 매너가 좋았다는 평가 +1/건 — 문턱 없음
 *   ③ 매너가 아쉬웠다는 평가 -1/건 — 문턱 없음 (② 와 대칭)
 *   ④ 평가 미제출 -1
 *
 * **집계를 먼저 하고 지급을 나중에 한다.** ① 이 아쉬움 집계에 의존하기 때문이다 — 순서를 되돌리면
 * 반 이상이 아쉬워한 호스트에게 +5 가 먼저 붙는다.
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

    // 활동 가점을 박탈할 대상 — 아쉬움이 2명 이상 **그리고** 반 이상일 때만.
    // 감점 자체는 문턱이 없다(아래 ③) — 여기만 문턱이 필요하다.
    // raters 는 '나를 평가할 수 있었던 평가자 수' — 내가 낸 평가는 세지 않는다
    const forfeitSet = new Set();
    for (const [userId, count] of low) {
      const raters = reviews.filter((r) => String(r.reviewer) !== userId).length;
      if (forfeitsActivity(count, raters)) forfeitSet.add(userId);
    }

    // ── 지급 ──
    // ① 개설 가점 — **호스트에게만.** 참여 가점(+2)은 없앴다 (참석을 확인할 수 없다 — 위 ★★).
    //    세 조건: 승인된 참여자가 있다 · 호스트가 평가를 보냈다 · 반 이상이 아쉬워하지 않았다.
    //    ⚠ 승인 참여자 조건이 없으면 빈 모임을 반복해 열고 혼자 평가를 내서 +6 을 무제한 받을 수 있다
    //      (participantsOf 는 호스트를 항상 넣으므로 'reviewers.size === 0' 보호에 안 걸린다)
    const hostId = String(m.host);
    if (approvedCountOf(m) > 0 && reviewers.has(hostId) && !forfeitSet.has(hostId)) {
      await move(hostId, 'meetup_open', SCORES.meetup_open, { message: `'${m.title}' 모임을 열었어요`, meetup: m._id });
    }

    // ② 매너가 좋았다는 평가 — 문턱이 없다. 한 명만 골라도 오른다. ③ 과 비대칭인 건 의도다
    //    (설명 못 하는 +1 은 항의를 만들지 않지만 설명 못 하는 -1 은 이 기능의 목적을 깬다)
    for (const [userId, count] of praised) {
      await move(userId, 'review_praise', SCORES.review_praise * count, {
        message: `'${m.title}'에서 매너가 좋았다는 평가를 ${count}번 받았어요`,
        meetup: m._id,
      });
    }

    // ③ 매너가 아쉬웠다는 평가 — ② 칭찬과 똑같이 **1건당**. 문턱이 없다
    //    **인원수를 문구에 적지 않는다** — 작은 모임에서 누가 눌렀는지 역산된다.
    //    (scoreChange 가 -2 면 2명이었다는 건 드러나지만 그건 점수 자체라 피할 수 없다)
    for (const [userId, count] of low) {
      await move(userId, 'review_low', SCORES.review_low * count, {
        message: `'${m.title}'에서 매너가 아쉬웠다는 평가를 받았어요`,
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
  applyReviewClosed,
  listLog,
};
