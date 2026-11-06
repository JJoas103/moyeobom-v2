const mongoose = require('mongoose');

// 찜 — 행사 · 모임. 끝난 행사도 찜에 남고, 취소된 모임은 찜 목록에서 빠짐 (services/likeService.js)
const TYPES = ['event', 'meetup'];

const likeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    target: { type: mongoose.Schema.Types.ObjectId, required: true }, // 행사 또는 모임 _id
  },
  { timestamps: true }
);

likeSchema.index({ user: 1, type: 1, target: 1 }, { unique: true }); // 같은 대상은 한 번만
likeSchema.index({ user: 1, createdAt: -1 }); // 내 찜 최근 순

module.exports = mongoose.model('Like', likeSchema);
module.exports.TYPES = TYPES;
