const mongoose = require('mongoose');

// 매너 점수 변동 이력 — 마이 화면에 "왜 올랐는지 · 왜 깎였는지"를 한 줄씩 보여주는 기록
//
// 불변식: 점수 = 50 + Σ(scoreChange)
//   그래서 scoreChange 에는 **실제 적용된 값**을 적는다. 0 · 100 경계에 걸려 덜 적용됐으면
//   적용분을 적고 requested 에 요청분을 남겨 화면이 그 이유를 설명할 수 있게 한다.
//   이 불변식은 scripts/checkMannerLedger.js 가 전원에 대해 검사한다.
//
// message 는 화면에 그대로 나가는 문구다 — 사용자가 "왜?"를 묻지 않게 하는 것이 이 기능의 목적이라
// 문구를 여기(services/mannerService.js)에서만 만들고 화면은 받아 적는다.
//
// ⚠ v1(Moyeobom)과 같은 Atlas DB(moyeobom)를 쓴다. v1 의 Activity 가 'activities' 컬렉션을
//   점유하고 있어서(meeting_create · meeting_join 81건) 이름을 겹치지 않게 MannerLog / 'mannerlogs' 로 둔다
const TYPES = [
  'meetup_open', // 모임을 열었고 그 자리가 실제로 열렸다 +5 (cron)
  // ⚠ 더 이상 주지 않는다 (2026-11-06) — 참석을 확인할 방법이 없어 참여 가점을 없앴다.
  //   이미 쌓인 이력이 이 타입을 쓰고 있어 **지우면 읽을 수 없다.** enum 에 남겨 둘 것
  'meetup_join', // (옛) 참여가 확정됐다 +2
  'meetup_leave', // 확정된 참여를 취소했다 -1 / -3
  'meetup_cancel', // 참여자가 있는 모임을 호스트가 취소했다 -5
  'review_submit', // 평가를 보냈다 +1
  'review_skip', // 평가를 안 냈다 -1 (cron, 평가 마감)
  'review_praise', // 매너가 좋았다는 평가를 받았다 +1/건 (cron, 평가 마감) — 1건이어도 오른다
  'review_low', // 매너가 아쉬웠다는 평가를 받았다 -1/건 (cron, 평가 마감) — 칭찬과 대칭, 문턱 없음
  'friend_matched', // 친구가 됐다 +1
  // 아래 둘은 관리자 화면에서 건다 (2026-11-12 연결 완료 —
  // services/adminService.js resolveReport · revertReport → mannerService.reportAccepted · reportReverted)
  'manner_report', // 관리자가 신고를 받아들여 제재했다 -7 (화면 말은 '제재')
  'manner_revert', // 제재를 취소했다 — 이력을 지우면 불변식이 깨지므로 반대 부호로 쌓는다 (7 고정 아님)
];

const mannerLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    message: { type: String, required: true }, // 화면에 그대로 보이는 한 줄
    scoreChange: { type: Number, required: true }, // 실제 적용분 — 이 값들의 합 + 50 이 현재 점수다
    requested: { type: Number, required: true }, // 규칙상 요청분. scoreChange 와 다르면 경계에 걸린 것
    meetup: { type: mongoose.Schema.Types.ObjectId, ref: 'Meetup' }, // 이력 줄에서 모임으로 이동
    friend: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // friend_matched 상대
    // manner_report · manner_revert 가 가리키는 신고.
    // ⚠ 되돌릴 때 **그때 적용된 분**(scoreChange)을 찾는 데 쓴다 — +7 고정으로 되돌리면
    //   0 경계에 걸려 덜 깎인 사람에게 점수가 생겨 불변식이 깨진다 (mannerService.reportReverted)
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  },
  { timestamps: true }
);

mannerLogSchema.index({ user: 1, createdAt: -1 }); // 내 이력 최근 순
// 되돌릴 금액을 찾는 조회 (report + type). 신고 이력만 있으면 되므로 부분 인덱스로 둔다
mannerLogSchema.index({ report: 1, type: 1 }, { partialFilterExpression: { report: { $exists: true } } });

module.exports = mongoose.model('MannerLog', mannerLogSchema, 'mannerlogs');
module.exports.TYPES = TYPES;
