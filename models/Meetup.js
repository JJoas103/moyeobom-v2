const mongoose = require('mongoose');

// 모임 — 행사 하나에 연결. 본체는 '이야기 자리', 관람 동행은 선택
// ⚠ 필드 이름 변경 시 frontend/src/data/mock/meetups.js 도 같이 수정
const BUDGETS = ['under1', '1to2', '2to3', 'over3']; // 1만 원 이하 / 1~2만 / 2~3만 / 3만 이상

// 신청자 — 모임 문서 안 배열 (정원 2~10명 · 중복 신청 · 정원 초과는 문서 하나의 조건부 수정으로 방지)
// 거절 · 내보내기 · 참여 취소는 배열에서 빼기만 해서 status 에 없음 — 다시 신청할 수 있음
const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinType: { type: String, enum: ['watch', 'talk'], required: true }, // 관람부터 함께 / 이야기 자리만
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' }, // 호스트 승인제
    appliedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
  },
  { _id: false }
);

const meetupSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    title: { type: String, required: true, trim: true, maxlength: 40 },
    intro: { type: String, trim: true, maxlength: 200 }, // 호스트의 한마디
    imageUrl: { type: String }, // 선택 — '/images/upload/파일'. 없으면 행사 포스터 사용

    // 이야기 자리 (필수)
    talk: {
      startAt: { type: Date, required: true },
      place: { type: String, required: true }, // 정확한 장소 — 호스트 · 승인된 참여자에게만
      area: { type: String, required: true }, // 목록에 보이는 '혜화역 근처'
      startTitle: { type: String, required: true, trim: true, maxlength: 30 }, // 타임라인 '모두' 칸 제목 (호스트 작성)
    },

    // 신청 전에 공개할 조건
    alcohol: { type: Boolean, default: false },
    budget: { type: String, enum: BUDGETS, required: true },
    capacity: { type: Number, required: true, min: 2, max: 10 }, // 참여자 정원 (호스트 제외)

    // 관람도 함께 (선택)
    watch: {
      enabled: { type: Boolean, default: false },
      sessionAt: { type: Date }, // 관람 회차
      meetAt: { type: Date }, // 만나는 시각
      meetPlace: { type: String }, // 만나는 곳 (공연장 1층 로비)
    },

    members: [memberSchema],
    status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },

    // 하루 한 번 도는 cron 이 같은 일을 두 번 하지 않게 하는 표식 (schedulers/reviewDaily.js).
    // 평가 열림 · 마감 시각은 저장하지 않고 socialRules.reviewWindow 로 계산하는 값이라
    // 쿼리로 못 걸러진다 → talk.startAt 범위로 좁히고 메모리에서 거른 뒤 이 표식을 남긴다
    reviewAppliedAt: { type: Date }, // 평가 마감분(활동 가점 · 매너 평가 · 미제출 감점)을 반영한 시각
    reviewOpenNoticedAt: { type: Date }, // '평가가 열렸어요' 알림을 보낸 시각
    reviewClosingNoticedAt: { type: Date }, // '평가가 곧 마감돼요' 알림을 보낸 시각
  },
  { timestamps: true }
);

meetupSchema.index({ event: 1, 'talk.startAt': 1 });
meetupSchema.index({ status: 1, 'talk.startAt': 1 });
meetupSchema.index({ 'members.user': 1 }); // 내가 신청한 모임
meetupSchema.index({ host: 1 }); // 내가 연 모임 · 호스트가 연 모임 수
meetupSchema.index({ reviewAppliedAt: 1, 'talk.startAt': 1 }); // cron — 평가 마감분 미반영

// 승인된 참여자 수 (호스트 제외)
meetupSchema.virtual('approvedCount').get(function () {
  return (this.members || []).filter((m) => m.status === 'approved').length;
});

meetupSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Meetup', meetupSchema);
module.exports.BUDGETS = BUDGETS;
