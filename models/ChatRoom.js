const mongoose = require('mongoose');

// 채팅방 — 모임 방(호스트 + 승인된 참여자) · 친구 1:1 방
//   closesAt: 모임 방 = 평가 마감(취소하면 취소 시각) → 그때부터 읽기 전용, 30일 동안 목록에 흐리게 · 신고 가능
//             1:1 방 = 친구 끊기 · 차단 시각 (평소엔 null) → 목록에서 바로 사라짐
//   닫힌 뒤 90일 지나면 대화 삭제 (신고 처리 중인 방은 보류) — schedulers/socialCleanup.js
const readSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true }, // 여기까지 읽음
  },
  { _id: false }
);

const chatRoomSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['meetup', 'direct'], required: true },
    meetup: { type: mongoose.Schema.Types.ObjectId, ref: 'Meetup' }, // 모임 방: 그 모임 / 1:1: 처음 만난 모임
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reads: [readSchema],
    notices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' }], // 호스트가 고정한 공지 (최근 고정 먼저)
    lastMessage: {
      text: { type: String },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },
    closesAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// 모임 하나에 모임 방 하나
chatRoomSchema.index({ meetup: 1 }, { unique: true, partialFilterExpression: { type: 'meetup' } });
chatRoomSchema.index({ users: 1, 'lastMessage.at': -1 });
chatRoomSchema.index({ closesAt: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
