const mongoose = require('mongoose');

// 친구 — 두 사람 한 문서 (userA < userB). 친구 끊기 · 차단하면 문서 삭제 + 1:1 방 닫힘
const memoSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 메모 쓴 사람 (본인만 봄)
    text: { type: String, trim: true, maxlength: 30 },
  },
  { _id: false }
);

const friendshipSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    meetup: { type: mongoose.Schema.Types.ObjectId, ref: 'Meetup' }, // 처음 만난 모임
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' }, // 1:1 채팅방
    memos: [memoSchema],
  },
  { timestamps: true }
);

friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });
friendshipSchema.index({ userB: 1 });
friendshipSchema.index({ room: 1 });

module.exports = mongoose.model('Friendship', friendshipSchema);
module.exports.MEMO_MAX = 30;
