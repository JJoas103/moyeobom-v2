const mongoose = require('mongoose');

// 행사 — 공공데이터(KOPIS · KOBIS · 서울시 문화행사)에서 가져옴 · 사용자 수정 불가
// ⚠ 필드 이름 변경 시 frontend/src/data/mock/events.js 도 같이 수정
const CATEGORIES = ['performance', 'play', 'film', 'exhibition', 'festival', 'classic'];
// 공연 · 연극 · 영화 · 전시 · 축제 · 클래식·국악

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true }, // 포스터 위 영문 라벨 (MUSICAL, FILM ...)
    category: { type: String, enum: CATEGORIES, required: true },
    genre: { type: String, trim: true }, // 세부 장르 (뮤지컬, 무용 ...)
    runType: { type: String, enum: ['session', 'period', 'screening'], default: 'period' },
    // session = 회차형(공연) / period = 기간형(전시·축제) / screening = 상영(영화)

    startDate: { type: Date, required: true }, // 영화는 개봉일
    endDate: { type: Date }, // 영화는 비워 둘 수 있음
    sessionsText: { type: String }, // '화–금 19:30 · 토·일 14:00, 18:30'
    runningTime: { type: Number }, // 분 — 예상 종료 시각 계산용

    venue: { type: String, trim: true },
    address: { type: String, trim: true },
    district: { type: String, trim: true }, // 서울 자치구 (종로구)
    area: { type: String, trim: true }, // 동네 이름 (대학로)
    location: {
      lat: Number,
      lng: Number,
    }, // 없으면 지도 미표시 (영화)

    priceText: { type: String },
    posterUrl: { type: String },
    bookingUrl: { type: String }, // 예매·주최 측 페이지
    ageLimit: { type: String, trim: true }, // '15세 이상 관람가', '누구나'
    cast: { type: String, trim: true }, // 출연진 (없는 행사 많음)
    description: { type: String, trim: true }, // 행사 소개 (없는 행사 많음)

    source: {
      name: { type: String, enum: ['KOPIS', 'KOBIS', 'SEOUL'], required: true },
      id: { type: String, required: true },
      url: { type: String },
      syncedAt: { type: Date }, // 마지막으로 출처에서 가져온 시각
    },
  },
  { timestamps: true }
);

eventSchema.index({ 'source.name': 1, 'source.id': 1 }, { unique: true });
eventSchema.index({ category: 1, endDate: 1 });

module.exports = mongoose.model('Event', eventSchema);
module.exports.CATEGORIES = CATEGORIES;
