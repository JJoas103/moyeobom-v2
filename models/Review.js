const mongoose = require('mongoose');

// 모임 평가 — 확정 참여자(호스트 포함)가 서로를 평가, 모임마다 한 번
//   praised 좋았어요(+1) · disappointed 아쉬웠어요(-1) · again 또 만나고 싶어요(비공개, 서로 고르면 친구)
//   '보통이에요'는 저장하지 않는다 — 나머지가 보통. praised 와 disappointed 는 겹치지 않는다
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
