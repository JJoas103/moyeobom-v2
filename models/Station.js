const mongoose = require('mongoose');

// 지하철역 — 서울시 역사마스터 정보(subwayStationMaster). 호선마다 한 건 (서울역 = 1호선 · 4호선 · ...)
const stationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // '서울역' · '시청' (출처 표기 그대로)
    line: { type: String, required: true, trim: true }, // '1호선' · '경의중앙선' (출처 표기 그대로)
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [경도, 위도]
    },

    source: {
      name: { type: String, enum: ['SEOUL'], required: true },
      id: { type: String, required: true }, // BLDN_ID
      syncedAt: { type: Date },
    },
  },
  { timestamps: true }
);

stationSchema.index({ location: '2dsphere' });
stationSchema.index({ 'source.name': 1, 'source.id': 1 }, { unique: true });

module.exports = mongoose.model('Station', stationSchema);
