const mongoose = require('mongoose');

// 신고 — 채팅 메시지 또는 참여자. pending 인 신고가 있는 방은 90일이 지나도 대화를 지우지 않음
// 처리 화면(관리자)은 아직 없음 — DB에서 status 를 'done' 으로 바꾸면 처리 끝
const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 신고 대상 사람
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' }, // 메시지 신고일 때
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
  },
  { timestamps: true }
);

reportSchema.index({ room: 1, status: 1 });
reportSchema.index({ reporter: 1, target: 1, room: 1, message: 1 }, { unique: true }); // 같은 신고 중복 방지

module.exports = mongoose.model('Report', reportSchema);
