const mongoose = require('mongoose');

// 차단 — 친구 끊김 · 1:1 방 닫힘 · 친구 요청 안 보임 · 모임 채팅에서 상대 메시지 숨김
const blockSchema = new mongoose.Schema(
  {
    blocker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blocked: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
blockSchema.index({ blocked: 1 });

module.exports = mongoose.model('Block', blockSchema);
