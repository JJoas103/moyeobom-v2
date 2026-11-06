const mongoose = require('mongoose');

// 모임 평가 — 확정 참여자(호스트 포함)가 같은 모임의 다른 확정 참여자를 평가. 한 사람이 모임마다 한 번
//
// 매너는 3단계로 받는다 — 좋았어요 / 보통이에요 / 아쉬웠어요.
//   praised:       매너가 좋았어요 (1건당 +1 — 한 명만 골라도 오른다)
//   disappointed:  매너가 아쉬웠어요 (1건당 -1 — 칭찬과 대칭, 문턱 없음. 반 이상이면 호스트 개설 가점도 없음)
//   again:         또 만나고 싶어요 (비공개 — 서로 골랐을 때만 친구 성립)
//
// **'보통이에요'는 저장하지 않는다** — 대상 − praised − disappointed 로 유도된다.
// 올리는 쪽과 깎는 쪽의 문턱이 다른 건 의도다 (services/mannerService.js 맨 위 주석).
// praised 와 disappointed 는 같은 사람을 동시에 담지 않는다 (reviewService 가 막는다).
const reviewSchema = new mongoose.Schema(
  {
    meetup: { type: mongoose.Schema.Types.ObjectId, ref: 'Meetup', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    praised: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    disappointed: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    again: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

reviewSchema.index({ meetup: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ praised: 1 }); // 받은 칭찬 수
reviewSchema.index({ disappointed: 1 });

module.exports = mongoose.model('Review', reviewSchema);
