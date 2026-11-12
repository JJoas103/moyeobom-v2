const mongoose = require('mongoose');

// 신고 — 채팅 메시지 또는 참여자. 할 때마다 한 건씩 쌓임 (대상 1 : 신고 n)
// pending 인 신고가 있는 방은 90일이 지나도 대화를 지우지 않음
// 처리 화면은 /admin (services/adminService.js) — 제재하면 매너 점수 7점이 깎이고, 취소하면 그만큼 돌아온다
// ⚠ 항목을 바꾸면 frontend/src/data/constants.js REPORT_REASONS 도 같이 수정
const REASONS = ['rude', 'ad', 'promise', 'privacy', 'other', 'noshow']; // 불쾌한 말 · 행동 / 광고 · 영업 / 약속 안 지킴 / 개인 정보 요구 / 기타 / 호스트 노쇼(참여자가 호스트를 신고할 때만)
const DETAIL_MAX = 200;
const NOTE_MAX = 200; // 관리자 메모 — 신고 내용(detail)과 같은 길이
const APPEAL_MAX = 500; // 이의제기 글 — 사정을 설명하는 자리라 신고(200자)보다 넉넉히

// 상태 넷 + 옛것 하나. **rejected 와 reverted 를 갈라 둔다** — 둘 다 '지금 제재가 없는' 상태지만
// 점수가 움직인 적이 있는지가 다르다. 한 값으로 묶으면 화면이 제재를 취소한 건에도
// "점수는 움직이지 않았어요" 라고 **거짓말을 한다** (실제로는 깎였다 돌아왔다).
//   pending  대기 중            accepted 제재함 (-7)
//   rejected 처음부터 기각 (변동 0)   reverted 제재했다가 취소 (깎인 만큼 돌려줌)
//
// 'done' 은 관리자 화면이 없던 동안 **DB 에서 손으로 바꿔 둔** 값이다 (예전 주석의 안내).
// 제재인지 기각인지 구분이 없어 새 코드는 쓰지 않지만, enum 에서 빼면 그 문서를 읽을 수 없으므로
// 남겨 두고 화면에서 '예전 처리'로 보여 준다 (MannerLog 가 옛 meetup_join 을 남겨 둔 것과 같은 이유)
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
    // 취소 사유는 따로 받는다. 같은 칸에 덮어쓰면 **왜 제재했는지가 사라진다** —
    // "취소를 검토할 때 보라" 고 적게 한 메모가 취소하는 순간 지워지면 앞뒤가 안 맞는다
    revertNote: { type: String, trim: true, maxlength: NOTE_MAX },

    // 처리 시점에 복사해 두는 신고 메시지 본문.
    // ⚠ services/chatService.js purgeClosedRooms 는 **pending 인 신고가 있는 방만** 90일 정리에서
    //   빼 준다. 처리하면 보존이 풀려 방 · 메시지가 지워지고, 그러면 되돌리기를 검토할 때 증거가
    //   사라진다. 판단의 근거는 판단한 자리에 남겨 둔다
    evidenceText: { type: String },


    // ---------- 이의제기 (제재 1건당 한 번) ----------
    // 따로 컬렉션을 두지 않는다 — 제재 하나에 이의 하나라 조인만 늘고 얻는 게 없다.
    // status: open = 관리자가 볼 차례 · accepted = 무효처리(점수 복구) · rejected = 이의 기각
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
// 이의제기가 들어온 건 — 관리자가 **먼저 봐야 할 줄**이라 따로 건다. 들어온 것만 색인하면 된다
reportSchema.index({ 'appeal.status': 1, 'appeal.at': 1 }, { partialFilterExpression: { 'appeal.status': 'open' } });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REASONS = REASONS;
module.exports.DETAIL_MAX = DETAIL_MAX;
module.exports.NOTE_MAX = NOTE_MAX;
module.exports.APPEAL_MAX = APPEAL_MAX;
module.exports.STATUSES = STATUSES;
