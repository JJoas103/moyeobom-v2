const mongoose = require('mongoose');

// 공중화장실 — 서울시 공중화장실 위치정보(mgisToiletPoi). 행사장 근처 안내용
// VALUE_03(휴무일?) · VALUE_05(장애인 화장실?)는 뜻 미확인이라 저장 안 함
const toiletSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    district: { type: String, trim: true }, // 자치구
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [경도, 위도] — GeoJSON 순서
    },
    openType: { type: String, trim: true }, // 공공개방 · 민간개방
    hoursText: { type: String, trim: true }, // '상시(24시간)' · '정시(09:00~18:00)'
    is24h: { type: Boolean, default: false },
    emergencyBell: { type: Boolean, default: false },
    cctv: { type: Boolean, default: false },
    diaperTable: { type: Boolean, default: false },
    placeType: { type: String, trim: true }, // 공공시설 · 공원 및 하천변 · 지하철 ...

    source: {
      name: { type: String, enum: ['SEOUL'], required: true },
      id: { type: String, required: true }, // OBJECTID
      syncedAt: { type: Date },
    },
  },
  { timestamps: true }
);

toiletSchema.index({ location: '2dsphere' });
toiletSchema.index({ 'source.name': 1, 'source.id': 1 }, { unique: true });

module.exports = mongoose.model('Toilet', toiletSchema);
