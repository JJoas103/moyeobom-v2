const mongoose = require('mongoose');

// 알림 — 헤더 종 아이콘 안에 쌓이는 목록 (services/notificationService.js)
//   읽음은 문서마다 readAt 하나 (null = 안 읽음). 채팅방의 reads 배열처럼 사람별로 둘 필요가 없다
//   90일이 지나면 정리한다 (schedulers/socialCleanup.js — 채팅 보존 기간과 같게)
//
// 보내지 않는 것 (결정 사항, CLAUDE.md)
//   · 채팅 새 메시지 — 헤더에 안 읽은 수 점이 이미 따로 있어서 상자가 채팅으로 도배된다
//   · 매너 점수가 **오를** 때 — 조용히 이력에만 남긴다. 깎일 때만 알린다
//   · 차단 · 차단 해제 — 상대가 알면 안 된다
//   · 친구 끊기 — 탈퇴도 같은 함수(endFriendship)를 지나서 구분할 수 없다
//   · 평가 제출 — 누가 평가했는지는 비공개다
//
// ⚠ v1(Moyeobom)과 같은 Atlas DB(moyeobom)를 쓴다. v1 의 Notification 이 'notifications' 컬렉션에
//   9건(type: 'comment', isRead · relatedLink 모양) 남아 있다. 그대로 쓰면 v1 알림이 v2 상자에 섞이고
//   (readAt 이 없어서 전부 '안 읽음'으로 세진다) 90일 정리가 v1 기록을 지운다 → 컬렉션을 따로 쓴다
const TYPES = [
  'meetup_apply', // 호스트에게 — 참여 신청이 왔어요
  'meetup_approved', // 신청자에게 — 참여가 확정됐어요
  'meetup_left', // 호스트에게 — 참여를 취소했어요
  'meetup_cancelled', // 신청 중 · 승인된 사람에게 — 모임이 취소됐어요
  'meetup_updated', // 승인된 참여자에게 — 모임 내용이 바뀌었어요
  'review_open', // 확정 참여자에게 — 평가가 열렸어요 (cron)
  'review_closing', // 아직 안 낸 사람에게만 — 평가가 곧 마감돼요 (cron)
  'friend_matched', // 양쪽에게 — 친구가 됐어요
  'manner_down', // 본인에게 — 매너 점수가 깎였어요
  'appeal_done', // 본인에게 — 이의제기가 처리됐어요 (수용 · 기각 둘 다)
];

// cron 이 보내는 알림 — 하루 한 번 도는 작업이 두 번 돌아도 중복되지 않아야 한다
const CRON_TYPES = ['review_open', 'review_closing'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 받는 사람
    type: { type: String, enum: TYPES, required: true },
    message: { type: String, required: true }, // 화면에 그대로 보이는 한 줄
    link: { type: String }, // 누르면 갈 프론트 경로 (예: /meetup/<id>)
    meetup: { type: mongoose.Schema.Types.ObjectId, ref: 'Meetup' },
    readAt: { type: Date }, // null = 안 읽음
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 }); // 내 알림 최근 순
notificationSchema.index({ user: 1, readAt: 1 }); // 안 읽은 수
notificationSchema.index({ createdAt: 1 }); // 90일 정리

// cron 중복 발송 방지 — 같은 사람 · 같은 종류 · 같은 모임은 한 번만.
// 모임이 없는 알림(manner_down 등)과 cron 이 아닌 종류는 걸리지 않게 부분 인덱스로 둔다
notificationSchema.index(
  { user: 1, type: 1, meetup: 1 },
  { unique: true, partialFilterExpression: { type: { $in: CRON_TYPES } } }
);

module.exports = mongoose.model('Notification', notificationSchema, 'notifications_v2');
module.exports.TYPES = TYPES;
module.exports.CRON_TYPES = CRON_TYPES;
