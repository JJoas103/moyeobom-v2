const mongoose = require('mongoose');

// 신고 — 채팅 메시지 또는 참여자. 할 때마다 한 건씩 쌓임 (대상 1 : 신고 n)
// pending 인 신고가 있는 방은 90일이 지나도 대화를 지우지 않음
// 처리 화면(관리자)은 아직 없음 — DB에서 status 를 'done' 으로 바꾸면 처리 끝
// ⚠ 항목을 바꾸면 frontend/src/data/constants.js REPORT_REASONS 도 같이 수정
const REASONS = ['rude', 'ad', 'promise', 'privacy', 'other', 'noshow']; // 불쾌한 말 · 행동 / 광고 · 영업 / 약속 안 지킴 / 개인 정보 요구 / 기타 / 호스트 노쇼(참여자가 호스트를 신고할 때만)
const DETAIL_MAX = 200;

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 신고 대상 사람
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' }, // 메시지 신고일 때
    reason: { type: String, enum: REASONS, required: true }, // 이 필드가 생기기 전 신고엔 없을 수 있음
    detail: { type: String, trim: true, maxlength: DETAIL_MAX }, // 기타일 때 입력 내용
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
  },
  { timestamps: true }
);

reportSchema.index({ room: 1, status: 1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REASONS = REASONS;
module.exports.DETAIL_MAX = DETAIL_MAX;
