const mongoose = require('mongoose');

// 매너 점수 변동 이력 — 마이 화면의 "왜 올랐고 왜 깎였는지"
// 불변식: 점수 = 50 + Σ(scoreChange) (npm run manner:check)
//   scoreChange 는 실제 적용분, 0 · 100 경계에 걸려 덜 적용됐으면 requested 에 요청분
// message 는 화면에 그대로 나가는 문구 — mannerService 에서만 만든다
// 컬렉션 'mannerlogs' — v1 이 'activities' 를 쓰고 있어 이름을 피했다
const TYPES = [
  'meetup_open', // 모임을 열었고 그 자리가 실제로 열렸다 +5 (cron)
  'meetup_join', // (옛) 참여 +2 — 더 주지 않지만 옛 이력이 써서 enum 에서 빼면 안 된다
  'meetup_leave', // 확정된 참여를 취소했다 -1 / -3
  'meetup_cancel', // 참여자가 있는 모임을 호스트가 취소했다 -5
  'review_submit', // 평가를 보냈다 +1
  'review_skip', // 평가를 안 냈다 -1 (cron, 평가 마감)
  'review_praise', // 매너가 좋았다는 평가를 받았다 +1/건 (cron, 평가 마감) — 1건이어도 오른다
  'review_low', // 매너가 아쉬웠다는 평가를 받았다 -1/건 (cron, 평가 마감) — 칭찬과 대칭, 문턱 없음
  'friend_matched', // 친구가 됐다 +1
  // 아래 둘은 관리자 화면에서 (adminService → mannerService.reportAccepted · reportReverted)
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
    // 제재 · 취소가 가리키는 신고 — 취소할 때 그때 실제 적용분을 찾아 되돌린다 (7 고정이면 불변식이 깨짐)
    report: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  },
  { timestamps: true }
);

mannerLogSchema.index({ user: 1, createdAt: -1 }); // 내 이력 최근 순
// 되돌릴 금액을 찾는 조회 (report + type). 신고 이력만 있으면 되므로 부분 인덱스로 둔다
mannerLogSchema.index({ report: 1, type: 1 }, { partialFilterExpression: { report: { $exists: true } } });

module.exports = mongoose.model('MannerLog', mannerLogSchema, 'mannerlogs');
module.exports.TYPES = TYPES;
