const mongoose = require('mongoose');

// 친구 요청 자리 — 한 모임 평가에서 '또 만나고 싶어요'를 서로 고른 두 사람
//   평가 마감(visibleAt)에 '요청 가능'으로 보이고, 그로부터 7일(expiresAt)에 '요청 가능' · '보낸 요청' 이 함께 만료
//   거절 버튼 없음 — 기한이 지나면 조용히 만료. 만료된 뒤 다시 요청할 수 없음
//   두 사람이 모두 요청하면(= 받은 요청 수락 · 동시 요청) 바로 친구
// userA < userB (문자열 순) 로 저장 — 같은 쌍 중복 방지
const requestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const friendLinkSchema = new mongoose.Schema(
  {
    meetup: { type: mongoose.Schema.Types.ObjectId, ref: 'Meetup', required: true }, // 만난 모임
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requests: [requestSchema], // 요청 보낸 사람
    status: { type: String, enum: ['open', 'friends', 'expired'], default: 'open' },
    visibleAt: { type: Date, required: true }, // 평가 마감 시각
    expiresAt: { type: Date, required: true }, // 평가 마감 + 7일
  },
  { timestamps: true }
);

friendLinkSchema.index({ meetup: 1, userA: 1, userB: 1 }, { unique: true });
friendLinkSchema.index({ userA: 1, status: 1 });
friendLinkSchema.index({ userB: 1, status: 1 });
friendLinkSchema.index({ status: 1, expiresAt: 1 }); // 만료 처리

module.exports = mongoose.model('FriendLink', friendLinkSchema);
