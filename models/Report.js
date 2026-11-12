const mongoose = require('mongoose');

// 신고 — 채팅 메시지 또는 참여자. 할 때마다 한 건씩 쌓임 (대상 1 : 신고 n)
// pending 인 신고가 있는 방은 90일이 지나도 대화를 지우지 않음
// 처리 화면은 /admin (services/adminService.js) — 제재하면 매너 점수 7점이 깎이고, 취소하면 그만큼 돌아온다
// ⚠ 항목을 바꾸면 frontend/src/data/constants.js REPORT_REASONS 도 같이 수정
const REASONS = ['rude', 'ad', 'promise', 'privacy', 'other', 'noshow']; // 불쾌한 말 · 행동 / 광고 · 영업 / 약속 안 지킴 / 개인 정보 요구 / 기타 / 호스트 노쇼(참여자가 호스트를 신고할 때만)
const DETAIL_MAX = 200;
const NOTE_MAX = 200; // 관리자 메모 — 신고 내용(detail)과 같은 길이
const APPEAL_MAX = 500; // 이의제기 글 — 사정을 설명하는 자리라 신고(200자)보다 넉넉히

// pending 대기 · accepted 제재(-7) · rejected 기각(변동 0) · reverted 제재 뒤 취소(돌려줌)
// rejected 와 reverted 는 점수가 움직였는지가 달라 합치지 않는다
// done 은 관리자 화면 전 DB 에서 손으로 넣던 옛 값 — 새로 쓰지 않지만 읽어야 해서 남긴다
const STATUSES = ['pending', 'accepted', 'rejected', 'reverted', 'done'];

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 신고 대상 사람
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' }, // 메시지 신고일 때
    reason: { type: String, enum: REASONS, required: true }, // 이 필드가 생기기 전 신고엔 없을 수 있음
    detail: { type: String, trim: true, maxlength: DETAIL_MAX }, // 기타일 때 입력 내용
    status: { type: String, enum: STATUSES, default: 'pending' },

    // ---------- 처리 기록 (관리자 화면) ----------
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    adminNote: { type: String, trim: true, maxlength: NOTE_MAX }, // 왜 제재했는지 · 왜 기각했는지
    revertNote: { type: String, trim: true, maxlength: NOTE_MAX }, // 취소 사유 — adminNote 를 덮어쓰지 않게 따로
    // 처리 때 복사한 신고 메시지 — 처리하면 방이 90일 정리 대상이 되어 원본이 지워질 수 있다
    evidenceText: { type: String },

    // ---------- 이의제기 (제재 1건당 한 번) ----------
    // status: open 관리자 차례 · accepted 무효처리(점수 복구) · rejected 이의 기각
    appeal: {
      text: { type: String, trim: true, maxlength: APPEAL_MAX },
      at: { type: Date }, // 이 값이 있으면 이미 낸 것 — 두 번째 제출을 막는 기준
      status: { type: String, enum: ['open', 'accepted', 'rejected'] },
      reply: { type: String, trim: true, maxlength: NOTE_MAX }, // 관리자 답 — **당사자에게 보인다**
      decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      decidedAt: { type: Date },
    },
  },
  { timestamps: true }
);

reportSchema.index({ room: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: 1 }); // 대기 목록 — 오래 기다린 것 먼저
reportSchema.index({ target: 1, createdAt: -1 }); // 회원 상세 '받은 신고'
// 처리할 이의제기 — 관리자가 먼저 볼 줄
reportSchema.index({ 'appeal.status': 1, 'appeal.at': 1 }, { partialFilterExpression: { 'appeal.status': 'open' } });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REASONS = REASONS;
module.exports.DETAIL_MAX = DETAIL_MAX;
module.exports.NOTE_MAX = NOTE_MAX;
module.exports.APPEAL_MAX = APPEAL_MAX;
module.exports.STATUSES = STATUSES;
