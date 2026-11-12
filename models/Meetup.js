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
      // 정확한 장소 — place · address · location 셋 다 호스트 · 승인된 참여자에게만 (meetupService.serialize)
      place: { type: String, required: true }, // 장소 이름 (카카오맵 검색으로 고르면 그 이름, 못 쓰면 직접 입력)
      address: { type: String, trim: true }, // 도로명(없으면 지번) 주소 — 검색으로 골랐을 때만
      location: { lat: Number, lng: Number }, // 검색으로 골랐을 때만
      area: { type: String, required: true }, // 목록에 보이는 '혜화역 근처' — 고른 장소에서 가장 가까운 역으로 채우고 호스트가 고칠 수 있다
      // 타임라인 첫 줄 제목 — 2026-11-09 부터 받지 않는다 (소개에 써도 되는 내용). 그 전 모임에만 남아 있다
      startTitle: { type: String, trim: true, maxlength: 30 },
    },

    // 타임라인 — 이야기 자리 시작 뒤로 호스트가 쓰는 줄 (2026-11-09). 공개.
    //   첫 줄(이야기 자리 시작)은 talk.startAt 이라 여기 넣지 않는다. 시각순으로 저장
    timeline: {
      type: [{ _id: false, at: { type: Date, required: true }, title: { type: String, required: true, trim: true, maxlength: 30 } }],
      default: [],
    },

    // 신청 전에 공개할 조건
    alcohol: { type: Boolean, default: false },
    budget: { type: String, enum: BUDGETS, required: true },
    capacity: { type: Number, required: true, min: 2, max: 10 }, // 참여자 정원 (호스트 제외)

    // 관람도 함께 (선택) — 받을지 말지만. 회차는 승인 뒤 채팅에서 정한다 (2026-11-09)
    //   신청은 이야기 자리 전날까지 (socialRules.watchApplyOpen)
    watch: {
      enabled: { type: Boolean, default: false },
      // 아래 셋은 2026-11-09 부터 저장하지 않는다 — 그 전에 만든 모임에만 남아 있고 타임라인이 그대로 그린다
      sessionAt: { type: Date }, // 관람 회차
      meetAt: { type: Date }, // 만나는 시각
      meetPlace: { type: String }, // 만나는 곳 (공연장 1층 로비)
    },

    members: [memberSchema],
    status: { type: String, enum: ['open', 'closed', 'cancelled'], default: 'open' },

    // 승인한 적 있는 사람 수 — **내보내기 · 거절 · 참여 취소로 줄지 않는다.** members 는 $pull 로
    // 지워져(위 주석) 승인했던 사실이 남지 않으므로 따로 센다.
    // 호스트 취소 감점(-5)의 판정 기준이다 — '지금 승인 인원'으로 판정하던 때는 전원 내보낸 뒤
    // 취소해 감점을 피할 수 있었다 (2026-11-10). 줄이는 코드를 넣지 말 것
    approvedEver: { type: Number, default: 0 },

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
