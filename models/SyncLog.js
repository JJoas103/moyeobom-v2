const mongoose = require('mongoose');

// 외부 데이터 동기화 실행 기록 — 실행마다 1건. 'running' 은 동시 실행 방지에도 사용
// source: SEOUL = 서울시 문화행사 · SEOUL_TOILET = 공중화장실 · SEOUL_STATION = 지하철역
const SOURCES = ['SEOUL', 'SEOUL_TOILET', 'SEOUL_STATION', 'KOPIS', 'KOBIS'];

const syncLogSchema = new mongoose.Schema({
  source: { type: String, enum: SOURCES, required: true },
  trigger: { type: String, enum: ['cron', 'manual'], required: true },
  status: { type: String, enum: ['running', 'success', 'failed'], default: 'running' },
  startedAt: { type: Date, default: Date.now },
  finishedAt: { type: Date },

  fetched: { type: Number, default: 0 }, // 출처에서 받은 행 수
  inserted: { type: Number, default: 0 }, // 새로 추가
  updated: { type: Number, default: 0 }, // 내용이 바뀐 것
  unchanged: { type: Number, default: 0 }, // 그대로인 것
  removed: { type: Number, default: 0 }, // 출처에서 사라져 지운 것 (화장실 · 역만)
  failed: { type: Number, default: 0 }, // 변환·검증·저장 실패
  skipped: {
    category: { type: Number, default: 0 }, // 교육/체험 · 기타 (행사)
    ended: { type: Number, default: 0 }, // 이미 끝난 행사
    invalid: { type: Number, default: 0 }, // 필수 값 없음 · 좌표 이상 · ID 없음
  },
  errorMessages: [{ type: String }], // 실패 메시지 앞쪽 일부만
});

syncLogSchema.index({ source: 1, startedAt: -1 });
// 출처마다 'running' 1건만 — 스케줄러 · 수동 실행이 겹쳐도 한쪽만 실행
syncLogSchema.index({ source: 1 }, { unique: true, partialFilterExpression: { status: 'running' } });

module.exports = mongoose.model('SyncLog', syncLogSchema);
