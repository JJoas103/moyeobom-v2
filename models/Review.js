const mongoose = require('mongoose');

// 모임 평가 — 확정 참여자(호스트 포함)가 같은 모임의 다른 확정 참여자를 평가. 한 사람이 모임마다 한 번
//   praised: 칭찬하기 (매너 점수 재료 — 산정 방식 · 노출은 미결정이라 저장만)
//   again:   또 만나고 싶어요 (비공개 — 서로 골랐을 때만 FriendLink 생성)
const reviewSchema = new mongoose.Schema(
  {
    meetup: { type: mongoose.Schema.Types.ObjectId, ref: 'Meetup', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    praised: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    again: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

reviewSchema.index({ meetup: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ praised: 1 }); // 받은 칭찬 수

module.exports = mongoose.model('Review', reviewSchema);
